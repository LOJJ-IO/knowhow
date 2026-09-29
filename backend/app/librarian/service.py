"""The librarian (ADR-0022): go through a member's Drive, suggest which files
are company work, let the member propose, let a lead confirm, and file the
confirmed ones into Knohow folders.

The chain is FEAT-drive-file-classification's, unchanged:
rules suggest → the file's owner proposes → a lead / owner / Super Admin
confirms → only then does the file enter `FileIndex`.

Privacy, enforced here rather than by convention:
- Nothing about a file is stored until it is confirmed company work, except
  its Drive id, the suggestion and reason *counts*.
- A file marked Personal leaves no row behind (only an irreversible hash so
  a rescan doesn't ask again).
- Titles are fetched live from Google for whoever is looking, and never
  logged or persisted before confirmation.
"""

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from googleapiclient.errors import HttpError
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.config import get_settings
from app.google.drive_client import get_drive_client_for_user
from app.librarian.rules import DRIVE_FIELDS, classify, contradicts
from app.models.file_index import FileIndex
from app.models.librarian import (
    FolderFile,
    KnohowFolder,
    LibrarianCandidate,
    LibrarianPersonalMark,
    LibrarianStatus,
    LibrarianSuggestion,
)
from app.models.org_member import OrgMember
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.team import Team
from app.onboarding.service import is_owner, is_verified_super_admin
from app.sharing.visibility import can_view_file

# How much of a Drive one scan walks, newest first. A pilot-sized cap: the
# scan runs inside a request, so it has to finish in one.
SCAN_LIMIT = 500
# How many titles one review screen fetches live.
REVIEW_PAGE = 50

LIVE_FIELDS = "id,name,mimeType,modifiedTime,createdTime,webViewLink"


class LibrarianError(ValueError):
    pass


def _org_domain(org: Organization) -> str:
    return (org.verified_domain or org.observed_domain or "").lower()


def _file_hash(file_id: str) -> str:
    key = get_settings().jwt_signing_key.encode()
    return hmac.new(key, file_id.encode(), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- scanning


@dataclass
class ScanResult:
    scanned: int
    suggested: int
    already_known: int


def scan_member_drive(member: OrgMember, db: Session) -> ScanResult:
    """Walks the member's own files (newest first, up to SCAN_LIMIT) and
    records a suggestion for each one Knohow hasn't already settled."""
    org = db.get(Organization, member.organization_id)
    if org is None:
        raise LibrarianError("organization not found")
    domain = _org_domain(org)
    if not domain:
        raise LibrarianError("this organization has no Workspace domain to compare against")

    drive = get_drive_client_for_user(member.id, db)

    indexed = set(db.execute(select(FileIndex.file_id).where(FileIndex.org_id == org.id)).scalars())
    known = {
        c.file_id: c
        for c in db.execute(
            select(LibrarianCandidate).where(LibrarianCandidate.org_id == org.id)
        ).scalars()
    }
    marked_personal = set(
        db.execute(
            select(LibrarianPersonalMark.file_hash).where(LibrarianPersonalMark.member_id == member.id)
        ).scalars()
    )

    scanned = suggested = already = 0
    page_token = None
    while scanned < SCAN_LIMIT:
        response = (
            drive.files()
            .list(
                q="'me' in owners and trashed = false",
                orderBy="modifiedTime desc",
                pageSize=min(100, SCAN_LIMIT - scanned),
                pageToken=page_token,
                fields=f"nextPageToken,files({DRIVE_FIELDS})",
            )
            .execute()
        )
        for f in response.get("files", []):
            scanned += 1
            file_id = f["id"]
            if file_id in indexed or _file_hash(file_id) in marked_personal:
                already += 1
                continue
            verdict = classify(f, domain)
            if verdict is None:
                continue
            existing = known.get(file_id)
            if existing is not None:
                already += 1
                if existing.status == LibrarianStatus.SUGGESTED:
                    existing.suggestion = verdict.suggestion
                    existing.reasons = verdict.reasons
                continue
            db.add(
                LibrarianCandidate(
                    org_id=org.id,
                    member_id=member.id,
                    file_id=file_id,
                    suggestion=verdict.suggestion,
                    reasons=verdict.reasons,
                    status=LibrarianStatus.SUGGESTED,
                )
            )
            suggested += 1
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    db.commit()
    record_audit_entry(
        org_id=org.id,
        actor_user_id=member.id,
        action_type="librarian.scanned",
        target_resource_id=str(member.id),
        # Counts only: an audit row naming files would retain them.
        details={"scanned": scanned, "suggested": suggested},
        db=db,
    )
    return ScanResult(scanned=scanned, suggested=suggested, already_known=already)


# ------------------------------------------------------------ live titles


def _live_files(member_id: uuid.UUID, file_ids: list[str], db: Session) -> dict[str, dict]:
    """Titles and types for these ids, read from Google through the member's
    own client. Files that are gone or unreadable are simply absent."""
    if not file_ids:
        return {}
    drive = get_drive_client_for_user(member_id, db)
    found: dict[str, dict] = {}
    for file_id in file_ids:
        try:
            found[file_id] = drive.files().get(fileId=file_id, fields=LIVE_FIELDS).execute()
        except HttpError:
            continue
    return found


def _candidate_view(c: LibrarianCandidate, live: dict) -> dict:
    return {
        "id": str(c.id),
        "file_id": c.file_id,
        "name": live.get("name", "Untitled"),
        "mime_type": live.get("mimeType", ""),
        "modified_at": live.get("modifiedTime"),
        "web_view_link": live.get("webViewLink"),
        "suggestion": c.suggestion.value,
        "reasons": c.reasons or {},
        "status": c.status.value,
    }


def review_queue(member: OrgMember, db: Session) -> dict:
    """The member's own files waiting for them: suggested, not yet answered."""
    rows = list(
        db.execute(
            select(LibrarianCandidate)
            .where(
                LibrarianCandidate.member_id == member.id,
                LibrarianCandidate.status == LibrarianStatus.SUGGESTED,
            )
            .order_by(LibrarianCandidate.created_at)
        ).scalars()
    )
    total = len(rows)
    # Company suggestions first: the quickest yeses.
    order = {LibrarianSuggestion.COMPANY: 0, LibrarianSuggestion.UNSURE: 1, LibrarianSuggestion.PERSONAL: 2}
    rows.sort(key=lambda c: order[c.suggestion])
    page = rows[:REVIEW_PAGE]
    live = _live_files(member.id, [c.file_id for c in page], db)
    items = []
    for c in page:
        if c.file_id not in live:
            # Deleted or no longer theirs: nothing to ask about.
            db.delete(c)
            total -= 1
            continue
        items.append(_candidate_view(c, live[c.file_id]))
    db.commit()
    waiting = db.execute(
        select(func.count())
        .select_from(LibrarianCandidate)
        .where(LibrarianCandidate.member_id == member.id, LibrarianCandidate.status == LibrarianStatus.PROPOSED)
    ).scalar_one()
    return {"total": total, "items": items, "awaiting_confirmation": waiting}


# -------------------------------------------------------------- deciding


def decide(member: OrgMember, candidate_id: uuid.UUID, label: str, confirmed_again: bool, db: Session) -> dict:
    """The file's owner answers Company or Personal. An answer against a
    strong suggestion is asked once more before it counts (AskAgain)."""
    if label not in ("company", "personal"):
        raise LibrarianError("label must be company or personal")
    c = db.get(LibrarianCandidate, candidate_id)
    if c is None or c.member_id != member.id or c.status != LibrarianStatus.SUGGESTED:
        raise LookupError("nothing to decide for this file")

    if contradicts(c.suggestion, label) and not confirmed_again:
        return {"result": "ask_again"}

    if label == "personal":
        db.add(LibrarianPersonalMark(member_id=member.id, file_hash=_file_hash(c.file_id)))
        db.delete(c)
        db.commit()
        return {"result": "personal"}

    c.status = LibrarianStatus.PROPOSED
    c.proposed_at = datetime.now(timezone.utc)
    db.commit()

    # Owner and verified Super Admin may confirm their own proposals (rule 6's
    # owner exception), as may the only person in the organization.
    if _may_confirm_own(member, db):
        confirm(member, c.id, db)
        return {"result": "confirmed"}
    return {"result": "proposed"}


def _may_confirm_own(member: OrgMember, db: Session) -> bool:
    org_id = member.organization_id
    if is_owner(org_id, member, db) or is_verified_super_admin(org_id, member):
        return True
    others = db.execute(
        select(func.count()).select_from(OrgMember).where(
            OrgMember.organization_id == org_id, OrgMember.id != member.id
        )
    ).scalar_one()
    return others == 0


def _member_team_ids(org_id: uuid.UUID, member_id: uuid.UUID, db: Session) -> list[uuid.UUID]:
    return [
        t
        for t in db.execute(
            select(OrgMembership.team_id)
            .where(OrgMembership.org_id == org_id, OrgMembership.user_id == member_id)
            .order_by(OrgMembership.created_at)
        ).scalars()
        if t is not None
    ]


def _can_confirm_for(actor: OrgMember, proposer_id: uuid.UUID, db: Session) -> bool:
    org_id = actor.organization_id
    if is_owner(org_id, actor, db) or is_verified_super_admin(org_id, actor):
        return True
    if actor.id == proposer_id:
        return False  # confirmer ≠ proposer (rule 6)
    proposer_teams = _member_team_ids(org_id, proposer_id, db)
    if not proposer_teams:
        return False
    return (
        db.execute(
            select(Team.id).where(Team.id.in_(proposer_teams), Team.team_leader_id == actor.id).limit(1)
        ).first()
        is not None
    )


def proposals_for(actor: OrgMember, db: Session) -> dict:
    """Company proposals this person may confirm, titles read live from the
    proposer's Drive (the confirmer may not have access to the file)."""
    rows = [
        c
        for c in db.execute(
            select(LibrarianCandidate)
            .where(
                LibrarianCandidate.org_id == actor.organization_id,
                LibrarianCandidate.status == LibrarianStatus.PROPOSED,
            )
            .order_by(LibrarianCandidate.proposed_at)
        ).scalars()
        if _can_confirm_for(actor, c.member_id, db)
    ]
    total = len(rows)
    page = rows[:REVIEW_PAGE]
    by_member: dict[uuid.UUID, list[LibrarianCandidate]] = {}
    for c in page:
        by_member.setdefault(c.member_id, []).append(c)

    items = []
    for member_id, cands in by_member.items():
        proposer = db.get(OrgMember, member_id)
        try:
            live = _live_files(member_id, [c.file_id for c in cands], db)
        except Exception:
            live = {}
        for c in cands:
            if c.file_id not in live:
                continue
            view = _candidate_view(c, live[c.file_id])
            view["proposed_by"] = {
                "id": str(member_id),
                "name": proposer.display_name if proposer else None,
                "email": proposer.email if proposer else None,
            }
            items.append(view)
    return {"total": total, "items": items}


def confirm(actor: OrgMember, candidate_id: uuid.UUID, db: Session) -> dict:
    """A company file, confirmed: it enters `FileIndex` (now allowed to keep
    its title) and goes into the proposer's team folder."""
    c = db.get(LibrarianCandidate, candidate_id)
    if c is None or c.org_id != actor.organization_id or c.status != LibrarianStatus.PROPOSED:
        raise LookupError("no proposal to confirm")
    if not _can_confirm_for(actor, c.member_id, db):
        raise PermissionError("only a lead of the proposer's team, the owner, or a verified Super Admin can confirm")

    org_id, file_id, proposer_id = c.org_id, c.file_id, c.member_id
    live = _live_files(proposer_id, [file_id], db).get(file_id)
    if live is None:
        db.delete(c)
        db.commit()
        raise LookupError("that file is no longer in Drive")

    teams = _member_team_ids(org_id, proposer_id, db)
    team_id = teams[0] if teams else None
    now = datetime.now(timezone.utc)

    def _ts(value: str | None) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else now

    row = db.get(FileIndex, file_id)
    if row is None:
        row = FileIndex(
            file_id=file_id,
            org_id=org_id,
            owner_user_id=proposer_id,
            team_id=team_id,
            file_type=live.get("mimeType", ""),
            title=live.get("name", "Untitled"),
            created_at=_ts(live.get("createdTime")),
            modified_at=_ts(live.get("modifiedTime")),
            sharing_state={},
            last_synced_at=now,
        )
        db.add(row)
    db.delete(c)
    db.flush()

    folder_id = None
    if team_id is not None:
        folder = _team_folder(org_id, team_id, db)
        if folder is not None:
            _add_to_folder(folder, file_id, actor.id, db)
            folder_id = folder.id
    db.commit()

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="librarian.confirmed_company",
        target_resource_id=file_id,
        details={"proposer_id": str(proposer_id), "team_id": str(team_id) if team_id else None},
        db=db,
    )
    return {"file_id": file_id, "folder_id": str(folder_id) if folder_id else None}


def decline(actor: OrgMember, candidate_id: uuid.UUID, db: Session) -> None:
    c = db.get(LibrarianCandidate, candidate_id)
    if c is None or c.org_id != actor.organization_id or c.status != LibrarianStatus.PROPOSED:
        raise LookupError("no proposal to decline")
    if not _can_confirm_for(actor, c.member_id, db):
        raise PermissionError("only a lead of the proposer's team, the owner, or a verified Super Admin can decline")
    c.status = LibrarianStatus.DECLINED
    db.commit()


# ---------------------------------------------------------------- folders


def _team_folder(org_id: uuid.UUID, team_id: uuid.UUID, db: Session) -> KnohowFolder | None:
    folder = db.execute(select(KnohowFolder).where(KnohowFolder.team_id == team_id)).scalar_one_or_none()
    if folder is None:
        team = db.get(Team, team_id)
        if team is None or team.org_id != org_id:
            return None
        folder = KnohowFolder(org_id=org_id, team_id=team_id, name=team.name)
        db.add(folder)
        db.flush()
    return folder


def ensure_team_folders(org_id: uuid.UUID, db: Session) -> None:
    """Every team has its own folder, named after the team."""
    have = set(
        db.execute(
            select(KnohowFolder.team_id).where(KnohowFolder.org_id == org_id, KnohowFolder.team_id.is_not(None))
        ).scalars()
    )
    for team in db.execute(select(Team).where(Team.org_id == org_id)).scalars():
        if team.id not in have:
            db.add(KnohowFolder(org_id=org_id, team_id=team.id, name=team.name))
    db.commit()


def _add_to_folder(folder: KnohowFolder, file_id: str, actor_id: uuid.UUID, db: Session) -> None:
    exists = db.execute(
        select(FolderFile.id).where(FolderFile.folder_id == folder.id, FolderFile.file_id == file_id)
    ).first()
    if exists is None:
        db.add(FolderFile(folder_id=folder.id, file_id=file_id, added_by=actor_id))


def _sees_everything(actor: OrgMember, db: Session) -> bool:
    org_id = actor.organization_id
    return is_owner(org_id, actor, db) or is_verified_super_admin(org_id, actor)


def _can_see(actor: OrgMember, f: FileIndex, everything: bool, db: Session) -> bool:
    return everything or can_view_file(actor.id, f, actor.organization_id, db)


def _visible_files(actor: OrgMember, folder_id: uuid.UUID, db: Session) -> list[FileIndex]:
    everything = _sees_everything(actor, db)
    rows = db.execute(
        select(FileIndex)
        .join(FolderFile, FolderFile.file_id == FileIndex.file_id)
        .where(FolderFile.folder_id == folder_id, FileIndex.org_id == actor.organization_id)
        .order_by(FileIndex.modified_at.desc())
    ).scalars()
    return [f for f in rows if _can_see(actor, f, everything, db)]


def _file_view(f: FileIndex) -> dict:
    return {
        "file_id": f.file_id,
        "name": f.title,
        "mime_type": f.file_type,
        "modified_at": f.modified_at.isoformat(),
        "owner_user_id": str(f.owner_user_id) if f.owner_user_id else None,
        "team_id": str(f.team_id) if f.team_id else None,
    }


def list_folders(actor: OrgMember, db: Session) -> list[dict]:
    ensure_team_folders(actor.organization_id, db)
    folders = db.execute(
        select(KnohowFolder)
        .where(KnohowFolder.org_id == actor.organization_id)
        .order_by(KnohowFolder.team_id.is_(None), KnohowFolder.name)
    ).scalars()
    out = []
    for folder in folders:
        files = _visible_files(actor, folder.id, db)
        out.append(
            {
                "id": str(folder.id),
                "name": folder.name,
                "team_id": str(folder.team_id) if folder.team_id else None,
                "file_count": len(files),
                "preview": [_file_view(f) for f in files[:3]],
            }
        )
    return out


def folder_detail(actor: OrgMember, folder_id: uuid.UUID, db: Session) -> dict:
    folder = db.get(KnohowFolder, folder_id)
    if folder is None or folder.org_id != actor.organization_id:
        raise LookupError("folder not found")
    files = _visible_files(actor, folder.id, db)
    return {
        "id": str(folder.id),
        "name": folder.name,
        "team_id": str(folder.team_id) if folder.team_id else None,
        "files": [_file_view(f) for f in files],
    }


def create_folder(actor: OrgMember, name: str, db: Session) -> dict:
    name = name.strip()
    if not name:
        raise LibrarianError("a folder needs a name")
    if len(name) > 255:
        raise LibrarianError("that name is too long")
    folder = KnohowFolder(org_id=actor.organization_id, name=name, created_by=actor.id)
    db.add(folder)
    db.commit()
    return {"id": str(folder.id), "name": folder.name, "team_id": None, "file_count": 0, "preview": []}


def delete_folder(actor: OrgMember, folder_id: uuid.UUID, db: Session) -> None:
    folder = db.get(KnohowFolder, folder_id)
    if folder is None or folder.org_id != actor.organization_id:
        raise LookupError("folder not found")
    if folder.team_id is not None:
        raise LibrarianError("a team's own folder can't be deleted")
    org_id = actor.organization_id
    if not (folder.created_by == actor.id or is_owner(org_id, actor, db) or is_verified_super_admin(org_id, actor)):
        raise PermissionError("only whoever made this folder, the owner, or a verified Super Admin can delete it")
    db.execute(delete(FolderFile).where(FolderFile.folder_id == folder.id))
    db.delete(folder)
    db.commit()


def set_file_in_folder(actor: OrgMember, folder_id: uuid.UUID, file_id: str, present: bool, db: Session) -> None:
    folder = db.get(KnohowFolder, folder_id)
    if folder is None or folder.org_id != actor.organization_id:
        raise LookupError("folder not found")
    f = db.get(FileIndex, file_id)
    if f is None or f.org_id != actor.organization_id or not _can_see(actor, f, _sees_everything(actor, db), db):
        raise LookupError("file not found")
    if present:
        _add_to_folder(folder, file_id, actor.id, db)
    else:
        db.execute(delete(FolderFile).where(FolderFile.folder_id == folder.id, FolderFile.file_id == file_id))
    db.commit()


def all_company_files(actor: OrgMember, db: Session) -> list[dict]:
    """Every indexed file this person can see, for "add to folder"."""
    rows = db.execute(
        select(FileIndex)
        .where(FileIndex.org_id == actor.organization_id)
        .order_by(FileIndex.modified_at.desc())
    ).scalars()
    everything = _sees_everything(actor, db)
    return [_file_view(f) for f in rows if _can_see(actor, f, everything, db)]
