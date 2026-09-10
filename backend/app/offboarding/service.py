import uuid
from dataclasses import dataclass, field

from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.db import SessionLocal
from app.exceptions import CrossOrgAccessDenied, PersonalAccountNotConsented
from app.google.drive_client import get_drive_client_for_user
from app.google.ownership import revoke_permission_if_not_owner, transfer_ownership
from app.google.retry import google_api_call
from app.models.org_member import AuthType, OrgMember
from app.models.unresolved_ownership import UnresolvedOwnership, UnresolvedOwnershipReason


@dataclass
class FileOffboardResult:
    file_id: str
    file_name: str
    action: str  # "ownership_transferred" | "unresolved_ownership" | "error"
    detail: str | None = None


@dataclass
class OffboardResult:
    user_id: uuid.UUID
    org_id: uuid.UUID
    transfer_to_user_id: uuid.UUID | None
    files: list[FileOffboardResult] = field(default_factory=list)
    unresolved_count: int = 0


def _require_member_in_org(member_id: uuid.UUID, org_id: uuid.UUID, db: Session) -> OrgMember:
    member = db.get(OrgMember, member_id)
    if member is None:
        raise ValueError(f"no OrgMember with id={member_id}")
    if member.organization_id != org_id:
        # Enforced at the function boundary, not left to caller discipline: a
        # request for one org must never touch a member of another org.
        raise CrossOrgAccessDenied(f"member {member_id} does not belong to organization {org_id}")
    return member




def revoke_and_offboard(
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    transfer_to_user_id: uuid.UUID | None,
    db: Session | None = None,
) -> OffboardResult:
    """Revokes a departing member's access and, where the Google platform
    allows it, transfers ownership of the files they own to
    transfer_to_user_id.

    Scope: this module has no file index (FileIndex is owned by the
    org-engine module built on top of this one), so it discovers files via a
    live Drive query for files the departing member *owns*. Files owned by
    someone else but merely shared with the departing member are out of
    scope here — a complete org-wide sweep of those requires cross-member
    indexing, which belongs to that later module's reconciliation sweep.

    Domain members transferring to a domain member recipient: ownership
    transfer is executed immediately via delegation. Any other combination
    (either side is a personal-account member) hits Google's hard platform
    rule that Drive ownership cannot cross the Workspace domain boundary —
    never attempted; each such file is recorded in UnresolvedOwnership with
    enough detail for a human to act on it, and the count is in the return
    value, not swallowed.
    """
    owns_session = db is None
    session = db or SessionLocal()
    try:
        departing = _require_member_in_org(user_id, org_id, session)
        recipient: OrgMember | None = None
        if transfer_to_user_id is not None:
            recipient = _require_member_in_org(transfer_to_user_id, org_id, session)

        if departing.auth_type == AuthType.DOMAIN_DELEGATED and recipient is None:
            raise ValueError(
                "transfer_to_user_id is required when offboarding a domain-delegated member"
            )

        result = OffboardResult(user_id=user_id, org_id=org_id, transfer_to_user_id=transfer_to_user_id)

        can_transfer_ownership = (
            departing.auth_type == AuthType.DOMAIN_DELEGATED
            and recipient is not None
            and recipient.auth_type == AuthType.DOMAIN_DELEGATED
        )

        try:
            drive = get_drive_client_for_user(user_id, db=session)
        except PersonalAccountNotConsented:
            # Nothing to revoke via the API if they never consented in the
            # first place — still write the audit trail, not a silent no-op.
            record_audit_entry(
                org_id=org_id,
                actor_user_id=None,
                action_type="offboard.completed",
                target_resource_id=str(user_id),
                details={
                    "note": "member had no personal OAuth consent on file; nothing to revoke via API",
                    "files_affected": 0,
                    "unresolved_count": 0,
                },
                db=session,
            )
            return result

        page_token = None
        while True:
            response = google_api_call(
                drive.files()
                .list(
                    q="'me' in owners and trashed = false",
                    fields="nextPageToken, files(id, name)",
                    pageSize=100,
                    pageToken=page_token,
                )
                .execute
            )

            for f in response.get("files", []):
                file_id, file_name = f["id"], f.get("name", "")

                if can_transfer_ownership:
                    try:
                        transfer_ownership(drive, file_id, recipient.email)
                        result.files.append(FileOffboardResult(file_id, file_name, "ownership_transferred"))
                        revoke_permission_if_not_owner(drive, file_id, departing.email)
                    except HttpError as exc:
                        result.files.append(FileOffboardResult(file_id, file_name, "error", str(exc)))
                else:
                    reason = (
                        UnresolvedOwnershipReason.PERSONAL_ACCOUNT_OWNER
                        if departing.auth_type == AuthType.PERSONAL_OAUTH
                        else UnresolvedOwnershipReason.PERSONAL_ACCOUNT_RECIPIENT
                    )
                    session.add(
                        UnresolvedOwnership(
                            id=uuid.uuid4(),
                            org_id=org_id,
                            file_id=file_id,
                            current_owner_member_id=departing.id,
                            intended_recipient_member_id=recipient.id if recipient else None,
                            reason=reason,
                            detail=(
                                f"Ownership of '{file_name}' ({file_id}) could not be transferred: Google "
                                "does not permit Drive ownership transfer across the Workspace domain "
                                "boundary. A human must manually re-share or copy this file to the "
                                "intended recipient."
                            ),
                        )
                    )
                    result.unresolved_count += 1
                    result.files.append(FileOffboardResult(file_id, file_name, "unresolved_ownership"))

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        session.commit()

        record_audit_entry(
            org_id=org_id,
            actor_user_id=None,
            action_type="offboard.completed",
            target_resource_id=str(user_id),
            details={
                "transfer_to_user_id": str(transfer_to_user_id) if transfer_to_user_id else None,
                "files_affected": len(result.files),
                "unresolved_count": result.unresolved_count,
            },
            db=session,
        )
        for item in result.files:
            record_audit_entry(
                org_id=org_id,
                actor_user_id=None,
                action_type=f"offboard.file.{item.action}",
                target_resource_id=item.file_id,
                details={"file_name": item.file_name, "detail": item.detail},
                db=session,
            )

        return result
    finally:
        if owns_session:
            session.close()
