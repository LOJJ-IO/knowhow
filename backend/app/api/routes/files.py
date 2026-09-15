import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_member, get_db
from app.exceptions import CrossOrgAccessDenied
from app.models.file_index import FileIndex
from app.models.org_member import OrgMember
from app.sharing.service import mark_file_personal
from app.sharing.visibility import can_view_file, visible_team_ids_for_member

router = APIRouter(tags=["files"])


def _serialize(f: FileIndex) -> dict:
    """Full resource representation, stable field names — composable for
    whatever view a future frontend builds, per this endpoint's contract:
    return more fields than any single screen needs rather than adding
    narrower endpoints later."""
    return {
        "file_id": f.file_id,
        "org_id": str(f.org_id),
        "owner_user_id": str(f.owner_user_id) if f.owner_user_id else None,
        "team_id": str(f.team_id) if f.team_id else None,
        "file_type": f.file_type,
        "title": f.title,
        "created_at": f.created_at.isoformat(),
        "modified_at": f.modified_at.isoformat(),
        "sharing_state": f.sharing_state,
        "last_synced_at": f.last_synced_at.isoformat(),
    }


_SORTABLE_COLUMNS = {"modified_at": FileIndex.modified_at, "created_at": FileIndex.created_at, "title": FileIndex.title}


@router.get("/files")
def list_files(
    org_id: uuid.UUID,
    team_id: uuid.UUID | None = None,
    type: str | None = Query(default=None, alias="type"),
    since: datetime | None = None,
    owner_id: uuid.UUID | None = None,
    q: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    sort: str = Query(default="-modified_at"),
    db: Session = Depends(get_db),
    member: OrgMember = Depends(get_current_member),
) -> dict:
    """A generic, filterable primitive — GET /files?org_id=&team_id=&type=&
    since=&owner_id=&q= — not shaped around any current screen, so a future
    frontend can compose any view from it without new endpoints.

    Role/visibility rules are enforced here, server-side, on every read:
    a Marketing member cannot retrieve Finance file metadata by crafting
    query parameters — the visible-team-id restriction below is applied
    regardless of what team_id the caller asks for.
    """
    if member.organization_id != org_id:
        raise CrossOrgAccessDenied(f"member {member.id} does not belong to organization {org_id}")

    stmt = select(FileIndex).where(FileIndex.org_id == org_id)

    visible_team_ids = visible_team_ids_for_member(member.id, org_id, db)
    if visible_team_ids is not None:
        stmt = stmt.where(
            or_(FileIndex.team_id.in_(visible_team_ids), FileIndex.owner_user_id == member.id)
        )

    if team_id is not None:
        stmt = stmt.where(FileIndex.team_id == team_id)
    if type is not None:
        stmt = stmt.where(FileIndex.file_type == type)
    if since is not None:
        stmt = stmt.where(FileIndex.modified_at >= since)
    if owner_id is not None:
        stmt = stmt.where(FileIndex.owner_user_id == owner_id)
    if q:
        stmt = stmt.where(FileIndex.title.ilike(f"%{q}%"))

    sort_column = _SORTABLE_COLUMNS.get(sort.lstrip("-"), FileIndex.modified_at)
    stmt = stmt.order_by(sort_column.desc() if sort.startswith("-") else sort_column.asc())

    candidates = db.execute(stmt).scalars().all()
    # The SQL filter above narrows by team_id/ownership; can_view_file still
    # runs per row for the "Personal" designation nuance (background access
    # for the file's own team_leader, hidden from everyone else on the team)
    # that isn't expressible as a single SQL predicate here.
    visible = [f for f in candidates if can_view_file(member.id, f, org_id, db)]
    page = visible[offset : offset + limit]

    return {"total": len(visible), "limit": limit, "offset": offset, "files": [_serialize(f) for f in page]}


@router.post("/files/{file_id}/personal")
def set_file_personal(
    file_id: str,
    personal: bool = True,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(get_current_member),
) -> dict:
    file_row = mark_file_personal(member.organization_id, file_id, member.id, db, personal=personal)
    return _serialize(file_row)
