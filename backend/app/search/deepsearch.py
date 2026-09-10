import uuid
from dataclasses import dataclass, field

from googleapiclient.errors import HttpError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.exceptions import PersonalAccountNotConsented
from app.google.drive_client import get_drive_client_for_user
from app.google.retry import google_api_call
from app.members.lookup import member_team, resolve_member_by_email
from app.models.file_index import FileIndex
from app.models.org_member import OrgMember
from app.sharing.visibility import can_view_file, visible_team_ids_for_member


def _escape_drive_query(query: str) -> str:
    return query.replace("\\", "\\\\").replace("'", "\\'")


@dataclass
class SearchResult:
    file_id: str
    title: str
    file_type: str
    owner_email: str | None
    modified_at: str | None
    matched_via_member_ids: list[str] = field(default_factory=list)


def _is_visible_live(requester_id: uuid.UUID, file_id: str, owner_email: str | None, org_id: uuid.UUID, db: Session) -> bool:
    """Same role-based visibility rule DeepSearch results go through as
    everything else — the whole point of this feature is surfacing files
    the searcher was never individually Drive-shared on, filtered by the
    org's role hierarchy rather than Drive's own ACLs. Prefers the indexed
    FileIndex row (has the "Personal" designation and any explicit grants);
    falls back to a live team-membership check for a file DeepSearch found
    that hasn't been indexed yet."""
    file_row = db.get(FileIndex, file_id)
    if file_row is not None:
        return can_view_file(requester_id, file_row, org_id, db)

    visible_team_ids = visible_team_ids_for_member(requester_id, org_id, db)
    if visible_team_ids is None:
        return True

    owner = resolve_member_by_email(org_id, owner_email, db)
    if owner is None:
        return False
    if owner.id == requester_id:
        return True
    owner_team_id = member_team(org_id, owner.id, db)
    return owner_team_id in visible_team_ids if owner_team_id else False


def search(org_id: uuid.UUID, requester_member_id: uuid.UUID, query: str, db: Session, limit: int = 25) -> list[SearchResult]:
    """DeepSearch: fans a fullText query out across every org member's own
    Drive via their own authenticated client (delegation for domain
    members, stored consent for personal-account members), merges and
    dedupes by file_id, then filters through the requester's role-based
    visibility. Google's own index performs the content matching — nothing
    from result bodies is ever persisted here; FileIndex (queried for the
    "Personal" flag and explicit grants above) serves metadata filtering
    and dashboards, this is a separate, live path layered on top of it —
    see the module docstring on FileIndex for why these stay two paths.
    """
    members = db.execute(select(OrgMember).where(OrgMember.organization_id == org_id)).scalars().all()
    escaped = _escape_drive_query(query)
    drive_query = f"fullText contains '{escaped}' and trashed = false"

    merged: dict[str, SearchResult] = {}

    for member in members:
        try:
            drive = get_drive_client_for_user(member.id, db=db)
        except PersonalAccountNotConsented:
            continue

        try:
            response = google_api_call(
                drive.files()
                .list(q=drive_query, fields="files(id,name,mimeType,owners,modifiedTime)", pageSize=50)
                .execute
            )
        except HttpError:
            continue

        for f in response.get("files", []):
            file_id = f["id"]
            owners = f.get("owners") or []
            owner_email = owners[0].get("emailAddress") if owners else None

            if file_id in merged:
                merged[file_id].matched_via_member_ids.append(str(member.id))
                continue

            merged[file_id] = SearchResult(
                file_id=file_id,
                title=f.get("name", ""),
                file_type=f.get("mimeType", "unknown"),
                owner_email=owner_email,
                modified_at=f.get("modifiedTime"),
                matched_via_member_ids=[str(member.id)],
            )

    visible_results = [
        r for r in merged.values() if _is_visible_live(requester_member_id, r.file_id, r.owner_email, org_id, db)
    ]
    # Rank: files found via more members' searches first (a rough proxy for
    # relevance/shared significance), then most recently modified.
    visible_results.sort(key=lambda r: (len(r.matched_via_member_ids), r.modified_at or ""), reverse=True)
    return visible_results[:limit]
