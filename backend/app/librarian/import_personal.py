"""Bring files from a personal Google account into the organization
(ADR-0028, "teams migrating to their first Workspace").

Two ways in:
- a personal account **linked** to the member (ADR-0025), through the Drive
  consent already stored for it (`import_linked_files`) — no Picker, no API
  key (user 2026-10-13: "just fix it");
- Google's Picker, which hands the browser a short-lived `drive.file` token
  scoped to only the picked files (`import_picked_files`). Knohow never stores
  that token; it uses it once and drops it.

Because Google won't transfer ownership from a consumer account to a
Workspace one, each file is **copied** into the org, not moved:
1. the personal account shares the file with the importing member,
2. the member's delegated (Workspace) client copies it, so the **copy is
   owned by the Workspace account** — the org has it,
3. the share on the original is removed, leaving the person's file untouched.
When step 1 isn't open (the file was only shared *with* the personal account,
or resharing is off) the personal account reads it and the org uploads it.

The copy gets a new id and loses the original's revision history and
comments; the person keeps the original. This is the trade-off the user
accepted (2026-09-27)."""

import io
from dataclasses import dataclass, field
from datetime import datetime, timezone

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2.credentials import Credentials
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.librarian.service import _member_team_ids, _team_folder, _add_to_folder, LibrarianError
from app.models.file_index import FileIndex
from app.models.org_member import OrgMember
from app.google.drive_client import get_drive_client_for_user
from app.logging_config import get_logger

logger = get_logger(__name__)

COPY_FIELDS = "id,name,mimeType,createdTime,modifiedTime"
MAX_IMPORT = 50

# Google files have no bytes of their own: when the share-and-copy path is
# closed they're exported to Office formats and converted back on upload.
_EXPORT_AS = {
    "application/vnd.google-apps.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.google-apps.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


@dataclass
class ImportResult:
    imported: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)


def _personal_client_from_token(access_token: str):
    """A Drive client for the person's picked files, from the browser's
    short-lived Picker token. No refresh token: it is used once, not kept."""
    return build("drive", "v3", credentials=Credentials(token=access_token))


def _check_batch(file_ids: list[str]) -> None:
    if not file_ids:
        raise LibrarianError("no files were picked")
    if len(file_ids) > MAX_IMPORT:
        raise LibrarianError(f"pick at most {MAX_IMPORT} files at a time")


def import_picked_files(
    member: OrgMember,
    access_token: str,
    file_ids: list[str],
    db: Session,
) -> ImportResult:
    if not access_token:
        raise LibrarianError("no access to the personal account")
    return import_with_personal_client(member, _personal_client_from_token(access_token), file_ids, db)


def import_linked_files(
    member: OrgMember,
    email: str,
    file_ids: list[str],
    to: str,
    db: Session,
) -> ImportResult:
    """From a personal account linked to this member.

    `to="company"`: copied into the org as Company files, filed in the
    member's team folder.
    `to="me"`: the originals are shared with the member's own work account
    as editor. They stay owned by the personal account and are not indexed;
    they show up in the work account's "Shared with me", for that person only."""
    from app.auth.linked_drive import NotLinked, linked_drive_client

    try:
        personal = linked_drive_client(member, email, db)
    except NotLinked as exc:
        raise LibrarianError("that account isn't linked to you") from exc
    if personal is None:
        raise LibrarianError("connect that account's Drive first")
    if to == "me":
        return _share_with_work_account(member, personal, file_ids, db)
    if to != "company":
        raise LibrarianError("choose the company or just you")
    return import_with_personal_client(member, personal, file_ids, db)


def _grant_member(personal, file_id: str, member: OrgMember) -> str | None:
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
    return grant.get("id")


def _share_with_work_account(member: OrgMember, personal, file_ids: list[str], db: Session) -> ImportResult:
    _check_batch(file_ids)
    result = ImportResult()
    for file_id in file_ids:
        try:
            _grant_member(personal, file_id, member)
            result.imported.append(file_id)
        except HttpError:
            result.failed.append(file_id)
    record_audit_entry(
        org_id=member.organization_id,
        actor_user_id=member.id,
        action_type="librarian.shared_personal_with_self",
        target_resource_id=str(member.id),
        details={"shared": len(result.imported), "failed": len(result.failed)},
        db=db,
    )
    return result


def _copy_by_upload(personal, org, file_id: str) -> dict:
    """Read the file with the personal account and upload it as the org:
    still a copy the org owns, minus whatever doesn't survive an export."""
    meta = personal.files().get(fileId=file_id, fields="id,name,mimeType").execute()
    mime = meta.get("mimeType", "")
    if mime in _EXPORT_AS:
        data = personal.files().export(fileId=file_id, mimeType=_EXPORT_AS[mime]).execute()
        upload_mime = _EXPORT_AS[mime]
        body = {"name": meta.get("name", "Untitled"), "mimeType": mime}
    elif mime.startswith("application/vnd.google-apps."):
        # Folders, forms, shortcuts…: nothing to carry across this way.
        raise LibrarianError("that kind of file can't be copied")
    else:
        data = personal.files().get_media(fileId=file_id).execute()
        upload_mime = mime or "application/octet-stream"
        body = {"name": meta.get("name", "Untitled")}
    media = MediaIoBaseUpload(io.BytesIO(data), mimetype=upload_mime, resumable=False)
    return org.files().create(body=body, media_body=media, fields=COPY_FIELDS).execute()


def import_with_personal_client(member: OrgMember, personal, file_ids: list[str], db: Session) -> ImportResult:
    _check_batch(file_ids)
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
            permission_id = _grant_member(personal, file_id, member)
            # 2. Copy it as the org (Workspace owns the copy).
            copy = org.files().copy(fileId=file_id, fields=COPY_FIELDS).execute()
        except HttpError:
            # Don't leave the member on the original, then try the upload way.
            if permission_id:
                try:
                    personal.permissions().delete(fileId=file_id, permissionId=permission_id).execute()
                except HttpError:
                    pass
                permission_id = None
            try:
                copy = _copy_by_upload(personal, org, file_id)
            except Exception:  # noqa: BLE001 — one bad file mustn't sink the batch
                logger.warning("librarian.import_fallback_failed", file_id=file_id, exc_info=True)
                result.failed.append(file_id)
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
