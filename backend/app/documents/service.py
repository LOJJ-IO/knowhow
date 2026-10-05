"""Create a blank Google file from the topbar's New button.

Minimal slice (user 2026-09-29): New → Doc / Sheet / Slide makes an empty
Google file **owned by the org** (created through the member's delegated
Workspace client), files it in the member's team folder, and hands back the
link so the frontend opens it in a new tab. No share form and no Upload yet —
those are the fuller [[FEAT-doc-creation-auto-share]] flow, deferred.

Named and placed up front (Ronald, 2026-10-04): the New dialog sends the
file's name and the teams it belongs to. Anyone picks among their own teams;
the owner picks among every team. The first team is the file's team; any
others go in `sharing_state["extra_team_ids"]`, which visibility and the
updates feed both read, and the file lands in every chosen team's folder."""

import uuid
from datetime import datetime, timezone

from googleapiclient.errors import HttpError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.google.drive_client import get_drive_client_for_user
from app.librarian.service import LibrarianError, _add_to_folder, _member_team_ids, _team_folder
from app.models.file_index import FileIndex
from app.models.team import Team
from app.onboarding.service import is_owner

# The blank Google types the New button offers, with Google's own default
# names for an untitled file. Form added 2026-10-02 (Ronald).
KINDS = {
    "doc": ("application/vnd.google-apps.document", "Untitled document"),
    "sheet": ("application/vnd.google-apps.spreadsheet", "Untitled spreadsheet"),
    "slide": ("application/vnd.google-apps.presentation", "Untitled presentation"),
    "form": ("application/vnd.google-apps.form", "Untitled form"),
}

CREATE_FIELDS = "id,name,mimeType,webViewLink,createdTime,modifiedTime"


#: Google's own limit on a file name is far longer; this keeps a pasted
#: paragraph from becoming a title.
MAX_NAME = 200


def _placeable_team_ids(member, db: Session) -> list[uuid.UUID]:
    """Teams this member may put a new file in: their own, or every team for
    the owner."""
    if is_owner(member.organization_id, member, db):
        return list(
            db.execute(select(Team.id).where(Team.org_id == member.organization_id).order_by(Team.created_at)).scalars()
        )
    return _member_team_ids(member.organization_id, member.id, db)


def _chosen_teams(member, team_ids: list[uuid.UUID] | None, db: Session) -> list[uuid.UUID]:
    allowed = _placeable_team_ids(member, db)
    if not team_ids:
        # Nothing picked: the dialog only skips the picker when there's one
        # team to choose, so file it there. Older callers sent no teams at
        # all; they keep landing in the member's first team.
        if len(allowed) == 1:
            return allowed
        own = _member_team_ids(member.organization_id, member.id, db)
        return own[:1]
    chosen = list(dict.fromkeys(team_ids))
    if any(t not in allowed for t in chosen):
        raise PermissionError("you can only add a file to your own teams")
    return chosen


def create_document(
    member,
    kind: str,
    db: Session,
    name: str | None = None,
    team_ids: list[uuid.UUID] | None = None,
) -> dict:
    if kind not in KINDS:
        raise LibrarianError("that isn't a file type we can create")
    mime, default_name = KINDS[kind]
    name = (name or "").strip()[:MAX_NAME] or default_name
    teams = _chosen_teams(member, team_ids, db)

    drive = get_drive_client_for_user(member.id, db)
    try:
        created = drive.files().create(body={"name": name, "mimeType": mime}, fields=CREATE_FIELDS).execute()
    except HttpError as exc:
        raise LibrarianError("Google wouldn't create the file") from exc

    now = datetime.now(timezone.utc)

    def _ts(value: str | None) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else now

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
            sharing_state={"extra_team_ids": [str(t) for t in teams[1:]]} if len(teams) > 1 else {},
            last_synced_at=now,
        )
    )
    db.flush()

    for chosen in teams:
        folder = _team_folder(member.organization_id, chosen, db)
        if folder is not None:
            _add_to_folder(folder, file_id, member.id, db)

    db.commit()
    record_audit_entry(
        org_id=member.organization_id,
        actor_user_id=member.id,
        action_type="document.created",
        target_resource_id=file_id,
        # Every chosen team, so the updates feed tells each of them.
        details={"kind": kind, "team_ids": [str(t) for t in teams]},
        db=db,
    )
    return {
        "id": file_id,
        "name": created.get("name", name),
        "url": created.get("webViewLink"),
        "team_ids": [str(t) for t in teams],
    }
