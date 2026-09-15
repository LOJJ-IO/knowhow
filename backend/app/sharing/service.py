import uuid
from datetime import datetime, timezone

from googleapiclient.errors import HttpError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.exceptions import CrossOrgAccessDenied
from app.google.drive_client import get_drive_client_for_user
from app.google.retry import google_api_call
from app.members.lookup import member_team
from app.models.file_index import FileIndex
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, OrgMember
from app.models.org_membership import OrgRole
from app.models.pending_reassignment import PendingReassignment, ReassignmentStatus
from app.models.suggested_share import SuggestedShare, SuggestedShareStatus
from app.models.team import Team
from app.models.unresolved_ownership import UnresolvedOwnership, UnresolvedOwnershipReason
from app.sharing.visibility import resolve_auto_share_recipients
from app.transfers.service import PlannedTransfer, auto_own_single_file, create_transfer_batch


def _grant_access(drive, file_id: str, email: str, role: str = "writer") -> None:
    try:
        google_api_call(
            drive.permissions().create(fileId=file_id, body={"role": role, "type": "user", "emailAddress": email}).execute
        )
    except HttpError:
        # Best-effort: a single recipient failing to be granted access (e.g.
        # they've since left, or a transient error) must not abort sharing
        # for the rest of the recipients.
        pass


def _auto_own_target(org_id: uuid.UUID, team_id: uuid.UUID | None, db: Session) -> OrgMember | None:
    """The institutional ownership target for a team's files: that team's
    leader if one is assigned and is a domain member, else the org's
    confirmed owner (OrgChart.owner_member_id) if they are a domain member.
    Returns None if neither is configured/eligible — Auto-Own is then
    skipped for lack of a target, not misfiled as a personal-account
    platform limitation (see handle_file_created)."""
    if team_id is not None:
        team = db.get(Team, team_id)
        if team is not None and team.team_leader_id is not None:
            leader = db.get(OrgMember, team.team_leader_id)
            if leader is not None and leader.auth_type == AuthType.DOMAIN_DELEGATED:
                return leader

    org_chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    if org_chart is not None and org_chart.owner_member_id is not None:
        owner = db.get(OrgMember, org_chart.owner_member_id)
        if owner is not None and owner.auth_type == AuthType.DOMAIN_DELEGATED:
            return owner

    return None


def handle_file_created(
    org_id: uuid.UUID,
    file_id: str,
    title: str,
    file_type: str,
    creator_user_id: uuid.UUID,
    created_via_knohow: bool,
    detected_via: str,
    db: Session,
) -> dict:
    """The core reaction to a detected file creation. created_via_knohow
    distinguishes files created through Knohow's own create flow (eligible
    for AUTO-SHARE/AUTO-OWN) from everything else (which only ever gets a
    SuggestedShare confirm/decline prompt — see the module docstring in
    app/models/suggested_share.py for why). detected_via is opaque here —
    whatever activity-detection source called this, the logic below does
    not branch on it, which is what keeps the detection source swappable
    (see app/activity/detection.py).
    """
    creator = db.get(OrgMember, creator_user_id)
    if creator is None:
        raise ValueError(f"no OrgMember with id={creator_user_id}")

    team_id = member_team(org_id, creator_user_id, db)
    now = datetime.now(timezone.utc)

    file_row = db.get(FileIndex, file_id)
    if file_row is None:
        file_row = FileIndex(
            file_id=file_id,
            org_id=org_id,
            owner_user_id=creator_user_id,
            team_id=team_id,
            file_type=file_type,
            title=title,
            created_at=now,
            modified_at=now,
            sharing_state={},
            last_synced_at=now,
        )
        db.add(file_row)
    db.commit()

    if not created_via_knohow:
        recipients = sorted(str(m) for m in resolve_auto_share_recipients(org_id, team_id, db)) if team_id else []
        suggestion = SuggestedShare(
            id=uuid.uuid4(),
            org_id=org_id,
            file_id=file_id,
            creator_user_id=creator_user_id,
            proposed_recipients=recipients,
            detected_via=detected_via,
        )
        db.add(suggestion)
        db.commit()

        record_audit_entry(
            org_id=org_id,
            actor_user_id=creator_user_id,
            action_type="sharing.suggested_share_created",
            target_resource_id=file_id,
            details={"detected_via": detected_via, "proposed_recipients": recipients},
            db=db,
        )
        return {"action": "suggested_share_created", "suggested_share_id": str(suggestion.id)}

    result: dict = {"action": "indexed"}

    if team_id is not None:
        recipient_ids = resolve_auto_share_recipients(org_id, team_id, db) - {creator_user_id}
        if recipient_ids:
            drive = get_drive_client_for_user(creator_user_id, db=db)
            recipient_emails = []
            for member_id in recipient_ids:
                recipient = db.get(OrgMember, member_id)
                if recipient is not None:
                    _grant_access(drive, file_id, recipient.email)
                    recipient_emails.append(recipient.email)
            file_row.sharing_state = {
                **file_row.sharing_state,
                "shared_with_member_ids": [str(m) for m in recipient_ids],
            }
            db.commit()
            result["auto_share"] = {"recipient_count": len(recipient_emails)}

    target = _auto_own_target(org_id, team_id, db)

    if creator.auth_type == AuthType.DOMAIN_DELEGATED and target is not None and target.id != creator_user_id:
        team = db.get(Team, team_id) if team_id else None
        if team is not None and team.auto_own_enabled:
            batch = auto_own_single_file(org_id, file_id, creator_user_id, target.id, db)
            result["auto_own"] = {"mode": "immediate", "batch_id": str(batch.id)}
        else:
            batch = create_transfer_batch(
                org_id,
                reason=f"Auto-Own queued for file {file_id} (standing rule disabled for this team)",
                created_by_member_id=creator_user_id,
                planned=[PlannedTransfer(file_id, creator_user_id, target.id)],
                db=db,
            )
            result["auto_own"] = {"mode": "queued_for_confirmation", "batch_id": str(batch.id)}
    elif creator.auth_type == AuthType.PERSONAL_OAUTH and target is not None:
        drive = get_drive_client_for_user(creator_user_id, db=db)
        _grant_access(drive, file_id, target.email, role="writer")
        db.add(
            UnresolvedOwnership(
                id=uuid.uuid4(),
                org_id=org_id,
                file_id=file_id,
                current_owner_member_id=creator_user_id,
                intended_recipient_member_id=target.id,
                reason=UnresolvedOwnershipReason.PERSONAL_ACCOUNT_OWNER,
                detail=(
                    f"File {file_id} was created by a personal-account member. Google does not permit "
                    "Drive ownership transfer across the Workspace domain boundary, so ownership was not "
                    f"transferred — {target.email} was granted editor access instead."
                ),
            )
        )
        db.commit()
        result["auto_own"] = {"mode": "personal_account_editor_grant", "target": target.email}

    record_audit_entry(
        org_id=org_id,
        actor_user_id=creator_user_id,
        action_type="sharing.file_created_handled",
        target_resource_id=file_id,
        details=result,
        db=db,
    )
    return result


def mark_file_personal(org_id: uuid.UUID, file_id: str, actor_member_id: uuid.UUID, db: Session, personal: bool = True) -> FileIndex:
    """Lets an individual keep a draft hidden from their team while leaders
    (the team's team_leader, plus org-wide top_leader/authorized_user roles,
    which already always see everything) retain background access — see
    app/sharing/visibility.py::can_view_file for the enforcement side."""
    file_row = db.get(FileIndex, file_id)
    if file_row is None:
        raise ValueError(f"no FileIndex row for file_id={file_id}")
    if file_row.org_id != org_id:
        raise CrossOrgAccessDenied(f"file {file_id} does not belong to organization {org_id}")

    file_row.sharing_state = {**file_row.sharing_state, "personal": personal}
    db.commit()
    db.refresh(file_row)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="sharing.file_personal_designation_set",
        target_resource_id=file_id,
        details={"personal": personal},
        db=db,
    )
    return file_row


def confirm_suggested_share(suggested_share_id: uuid.UUID, org_id: uuid.UUID, actor_member_id: uuid.UUID, db: Session) -> SuggestedShare:
    suggestion = db.get(SuggestedShare, suggested_share_id)
    if suggestion is None:
        raise ValueError(f"no SuggestedShare with id={suggested_share_id}")
    if suggestion.org_id != org_id:
        raise CrossOrgAccessDenied(f"suggested share {suggested_share_id} does not belong to organization {org_id}")
    if suggestion.status != SuggestedShareStatus.PENDING:
        raise ValueError(f"suggested share {suggested_share_id} is already {suggestion.status.value}")

    drive = get_drive_client_for_user(suggestion.creator_user_id, db=db)
    for member_id_str in suggestion.proposed_recipients:
        recipient = db.get(OrgMember, uuid.UUID(member_id_str))
        if recipient is not None:
            _grant_access(drive, suggestion.file_id, recipient.email)

    suggestion.status = SuggestedShareStatus.CONFIRMED
    suggestion.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(suggestion)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="sharing.suggested_share_confirmed",
        target_resource_id=suggestion.file_id,
        details={"recipient_count": len(suggestion.proposed_recipients)},
        db=db,
    )
    return suggestion


def decline_suggested_share(suggested_share_id: uuid.UUID, org_id: uuid.UUID, actor_member_id: uuid.UUID, db: Session) -> SuggestedShare:
    suggestion = db.get(SuggestedShare, suggested_share_id)
    if suggestion is None:
        raise ValueError(f"no SuggestedShare with id={suggested_share_id}")
    if suggestion.org_id != org_id:
        raise CrossOrgAccessDenied(f"suggested share {suggested_share_id} does not belong to organization {org_id}")
    if suggestion.status != SuggestedShareStatus.PENDING:
        raise ValueError(f"suggested share {suggested_share_id} is already {suggestion.status.value}")

    suggestion.status = SuggestedShareStatus.DECLINED
    suggestion.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(suggestion)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="sharing.suggested_share_declined",
        target_resource_id=suggestion.file_id,
        details={},
        db=db,
    )
    return suggestion


def request_team_reassignment(
    org_id: uuid.UUID, member_id: uuid.UUID, new_team_id: uuid.UUID, requested_by_member_id: uuid.UUID, db: Session
) -> PendingReassignment:
    old_team_id = member_team(org_id, member_id, db)
    affected_file_ids = db.execute(
        select(FileIndex.file_id).where(FileIndex.org_id == org_id, FileIndex.owner_user_id == member_id)
    ).scalars().all()

    reassignment = PendingReassignment(
        id=uuid.uuid4(),
        org_id=org_id,
        member_id=member_id,
        old_team_id=old_team_id,
        new_team_id=new_team_id,
        affected_file_ids=list(affected_file_ids),
    )
    db.add(reassignment)
    db.commit()
    db.refresh(reassignment)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=requested_by_member_id,
        action_type="sharing.reassignment_requested",
        target_resource_id=str(reassignment.id),
        details={
            "member_id": str(member_id),
            "old_team_id": str(old_team_id) if old_team_id else None,
            "new_team_id": str(new_team_id),
            "affected_file_count": len(affected_file_ids),
        },
        db=db,
    )
    return reassignment


def confirm_reassignment(reassignment_id: uuid.UUID, org_id: uuid.UUID, actor_member_id: uuid.UUID, db: Session) -> PendingReassignment:
    from app.org_chart.service import upsert_membership  # local import: avoids a service-to-service import cycle

    reassignment = db.get(PendingReassignment, reassignment_id)
    if reassignment is None:
        raise ValueError(f"no PendingReassignment with id={reassignment_id}")
    if reassignment.org_id != org_id:
        raise CrossOrgAccessDenied(f"reassignment {reassignment_id} does not belong to organization {org_id}")
    if reassignment.status != ReassignmentStatus.PENDING_CONFIRMATION:
        raise ValueError(f"reassignment {reassignment_id} is already {reassignment.status.value}")

    upsert_membership(org_id, reassignment.new_team_id, reassignment.member_id, OrgRole.MEMBER, db, actor_member_id)

    for file_id in reassignment.affected_file_ids:
        file_row = db.get(FileIndex, file_id)
        if file_row is not None:
            file_row.team_id = reassignment.new_team_id

    reassignment.status = ReassignmentStatus.CONFIRMED
    reassignment.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reassignment)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="sharing.reassignment_confirmed",
        target_resource_id=str(reassignment.id),
        details={"affected_file_count": len(reassignment.affected_file_ids)},
        db=db,
    )
    return reassignment


def decline_reassignment(reassignment_id: uuid.UUID, org_id: uuid.UUID, actor_member_id: uuid.UUID, db: Session) -> PendingReassignment:
    reassignment = db.get(PendingReassignment, reassignment_id)
    if reassignment is None:
        raise ValueError(f"no PendingReassignment with id={reassignment_id}")
    if reassignment.org_id != org_id:
        raise CrossOrgAccessDenied(f"reassignment {reassignment_id} does not belong to organization {org_id}")
    if reassignment.status != ReassignmentStatus.PENDING_CONFIRMATION:
        raise ValueError(f"reassignment {reassignment_id} is already {reassignment.status.value}")

    reassignment.status = ReassignmentStatus.DECLINED
    reassignment.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reassignment)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="sharing.reassignment_declined",
        target_resource_id=str(reassignment.id),
        details={},
        db=db,
    )
    return reassignment
