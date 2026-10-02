"""Create a blank Google file from the topbar's New button.

Minimal slice (user 2026-09-29): New → Doc / Sheet / Slide makes an empty
Google file **owned by the org** (created through the member's delegated
Workspace client), files it in the member's team folder, and hands back the
link so the frontend opens it in a new tab. No share form and no Upload yet —
those are the fuller [[FEAT-doc-creation-auto-share]] flow, deferred."""

import uuid
from datetime import datetime, timezone

from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.google.drive_client import get_drive_client_for_user
from app.librarian.service import LibrarianError, _add_to_folder, _member_team_ids, _team_folder
from app.models.file_index import FileIndex

# The blank Google types the New button offers, with Google's own default
# names for an untitled file. Form added 2026-10-02 (Ronald).
KINDS = {
    "doc": ("application/vnd.google-apps.document", "Untitled document"),
    "sheet": ("application/vnd.google-apps.spreadsheet", "Untitled spreadsheet"),
    "slide": ("application/vnd.google-apps.presentation", "Untitled presentation"),
    "form": ("application/vnd.google-apps.form", "Untitled form"),
}

CREATE_FIELDS = "id,name,mimeType,webViewLink,createdTime,modifiedTime"


def create_document(member, kind: str, db: Session) -> dict:
    if kind not in KINDS:
        raise LibrarianError("that isn't a file type we can create")
    mime, name = KINDS[kind]

    drive = get_drive_client_for_user(member.id, db)
    try:
        created = drive.files().create(body={"name": name, "mimeType": mime}, fields=CREATE_FIELDS).execute()
    except HttpError as exc:
        raise LibrarianError("Google wouldn't create the file") from exc

    now = datetime.now(timezone.utc)

    def _ts(value: str | None) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else now

    teams = _member_team_ids(member.organization_id, member.id, db)
    team_id = teams[0] if teams else None
    file_id = created["id"]

    db.add(
        FileIndex(
            file_id=file_id,
            org_id=member.organization_id,
            owner_user_id=member.id,
            team_id=team_id,
            file_type=created.get("mimeType", mime),
            title=created.get("name", name),
            created_at=_ts(created.get("createdTime")),
            modified_at=_ts(created.get("modifiedTime")),
            sharing_state={},
            last_synced_at=now,
        )
    )
    db.flush()

    if team_id is not None:
        folder = _team_folder(member.organization_id, team_id, db)
        if folder is not None:
            _add_to_folder(folder, file_id, member.id, db)

    db.commit()
    record_audit_entry(
        org_id=member.organization_id,
        actor_user_id=member.id,
        action_type="document.created",
        target_resource_id=file_id,
        details={"kind": kind},
        db=db,
    )
    return {"id": file_id, "name": created.get("name", name), "url": created.get("webViewLink")}
