"""Bring files from a personal Google account into the organization
(ADR-0022, "teams migrating to their first Workspace").

The person picks files in Google's own Picker, which hands the browser a
short-lived `drive.file` token scoped to only the files they picked. The
frontend sends that token plus the file ids here. Knohow never stores the
token or scans the rest of their Drive — it uses the token once and drops it.

Because Google won't transfer ownership from a consumer account to a
Workspace one, each picked file is **copied** into the org, not moved:
1. the person's token shares the picked file with the importing member,
2. the member's delegated (Workspace) client copies it, so the **copy is
   owned by the Workspace account** — the org has it,
3. the share on the original is removed, leaving the person's file untouched.

The copy gets a new id and loses the original's revision history and
comments; the person keeps the original. This is the trade-off the user
accepted (2026-09-27)."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.librarian.service import _member_team_ids, _team_folder, _add_to_folder, LibrarianError
from app.models.file_index import FileIndex
from app.models.org_member import OrgMember
from app.google.drive_client import get_drive_client_for_user

COPY_FIELDS = "id,name,mimeType,createdTime,modifiedTime"
MAX_IMPORT = 50


@dataclass
class ImportResult:
    imported: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)


def _personal_client_from_token(access_token: str):
    """A Drive client for the person's picked files, from the browser's
    short-lived Picker token. No refresh token: it is used once, not kept."""
    return build("drive", "v3", credentials=Credentials(token=access_token))


def import_picked_files(
    member: OrgMember,
    access_token: str,
    file_ids: list[str],
    db: Session,
) -> ImportResult:
    if not access_token:
        raise LibrarianError("no access to the personal account")
    if not file_ids:
        raise LibrarianError("no files were picked")
    if len(file_ids) > MAX_IMPORT:
        raise LibrarianError(f"pick at most {MAX_IMPORT} files at a time")

    personal = _personal_client_from_token(access_token)
    org = get_drive_client_for_user(member.id, db)

    teams = _member_team_ids(member.organization_id, member.id, db)
    team_id = teams[0] if teams else None
    now = datetime.now(timezone.utc)

    def _ts(value: str | None) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else now

    result = ImportResult()
    for file_id in file_ids:
        permission_id = None
        try:
            # 1. Let the importing member's Workspace account reach the file.
            grant = (
                personal.permissions()
                .create(
                    fileId=file_id,
                    body={"type": "user", "role": "writer", "emailAddress": member.email},
                    sendNotificationEmail=False,
                    fields="id",
                )
                .execute()
            )
            permission_id = grant.get("id")
            # 2. Copy it as the org (Workspace owns the copy).
            copy = org.files().copy(fileId=file_id, fields=COPY_FIELDS).execute()
        except HttpError:
            result.failed.append(file_id)
            # Best-effort: don't leave the member on the original if the copy failed.
            if permission_id:
                try:
                    personal.permissions().delete(fileId=file_id, permissionId=permission_id).execute()
                except HttpError:
                    pass
            continue

        # 3. Take the member back off the person's original.
        if permission_id:
            try:
                personal.permissions().delete(fileId=file_id, permissionId=permission_id).execute()
            except HttpError:
                pass

        copy_id = copy["id"]
        if db.get(FileIndex, copy_id) is None:
            db.add(
                FileIndex(
                    file_id=copy_id,
                    org_id=member.organization_id,
                    owner_user_id=member.id,
                    team_id=team_id,
                    file_type=copy.get("mimeType", ""),
                    title=copy.get("name", "Untitled"),
                    created_at=_ts(copy.get("createdTime")),
                    modified_at=_ts(copy.get("modifiedTime")),
                    sharing_state={},
                    last_synced_at=now,
                )
            )
            db.flush()
            if team_id is not None:
                folder = _team_folder(member.organization_id, team_id, db)
                if folder is not None:
                    _add_to_folder(folder, copy_id, member.id, db)
        result.imported.append(copy_id)

    db.commit()
    record_audit_entry(
        org_id=member.organization_id,
        actor_user_id=member.id,
        action_type="librarian.imported_personal",
        target_resource_id=str(member.id),
        details={"imported": len(result.imported), "failed": len(result.failed)},
        db=db,
    )
    return result
