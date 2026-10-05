"""The librarian (ADR-0028): go through a member's Drive, suggest which files
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
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from googleapiclient.errors import HttpError
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.config import get_settings
from app.google.drive_client import get_drive_client_for_user
from app.librarian.rules import (
    DRIVE_FIELDS,
    classify_workspace,
    contradicts,
    org_collaborator_emails,
)
from app.models.file_index import FileIndex
from app.models.librarian import (
    FolderFile,
    KnohowFolder,
    LibrarianCandidate,
    LibrarianPersonalMark,
    LibrarianStatus,
    LibrarianSuggestion,
)
from app.logging_config import get_logger
from app.models.org_member import AuthType, OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.organization import Organization
from app.models.team import Team
from app.sandbox import SANDBOX_DOMAIN, is_sandbox_org
from app.onboarding.service import is_owner, is_verified_super_admin
from app.sharing.visibility import can_view_file

# How much of a Drive one scan walks, newest first. A pilot-sized cap: the
# scan runs inside a request, so it has to finish in one.
SCAN_LIMIT = 500
# How many titles one review screen fetches live.
REVIEW_PAGE = 50

logger = get_logger(__name__)

LIVE_FIELDS = "id,name,mimeType,modifiedTime,createdTime,webViewLink"
# LIVE_FIELDS plus the sharing metadata used to route a file to a team folder.
CONFIRM_FIELDS = f"{LIVE_FIELDS},permissions(type,role,emailAddress,domain),lastModifyingUser(me,emailAddress)"


class LibrarianError(ValueError):
    pass


def _org_domain(org: Organization) -> str:
    if is_sandbox_org(org.id):
        return SANDBOX_DOMAIN
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
            # A Workspace account's files are the organization's (ADR-0029):
            # Company by default, no company-vs-personal quiz.
            verdict = classify_workspace(f, domain)
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


def _route_team(org_id: uuid.UUID, proposer_id: uuid.UUID, file_meta: dict, db: Session) -> uuid.UUID | None:
    """Which team folder a confirmed file belongs in (ADR-0029): the team the
    most of its org-domain collaborators are on. Falls back to the proposer's
    own team when the file's collaborators point nowhere in particular. Emails
    are mapped to teams here and never stored."""
    proposer_teams = _member_team_ids(org_id, proposer_id, db)
    fallback = proposer_teams[0] if proposer_teams else None

    org = db.get(Organization, org_id)
    domain = _org_domain(org) if org else ""
    # The proposer is already out of the vote: their owner permission is
    # skipped, and they are the `me` the fetch runs as, so lastModifyingUser is
    # skipped too. What's left is other people the file touches.
    emails = org_collaborator_emails(file_meta, domain) if domain else []
    if not emails:
        return fallback

    votes: dict[uuid.UUID, int] = {}
    rows = db.execute(
        select(OrgMembership.team_id)
        .join(OrgMember, OrgMembership.user_id == OrgMember.id)
        .where(
            OrgMember.organization_id == org_id,
            func.lower(OrgMember.email).in_(emails),
            OrgMembership.team_id.is_not(None),
        )
    ).scalars()
    for team_id in rows:
        votes[team_id] = votes.get(team_id, 0) + 1
    if not votes:
        return fallback

    best = max(votes.values())
    leaders = [t for t, n in votes.items() if n == best]
    # A tie that includes the proposer's own team resolves to it; otherwise the
    # first winner (dict keeps insertion order for a stable pick).
    if fallback in leaders:
        return fallback
    return leaders[0]


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


def task_counts(actor: OrgMember, db: Session) -> tuple[int, int]:
    """(files to sort, proposals to review) for the Notifications dialog's
    Librarian section. Counts only: no Drive call, so the bell stays cheap."""
    to_sort = db.execute(
        select(func.count())
        .select_from(LibrarianCandidate)
        .where(LibrarianCandidate.member_id == actor.id, LibrarianCandidate.status == LibrarianStatus.SUGGESTED)
    ).scalar_one()
    proposers = db.execute(
        select(LibrarianCandidate.member_id).where(
            LibrarianCandidate.org_id == actor.organization_id,
            LibrarianCandidate.status == LibrarianStatus.PROPOSED,
        )
    ).scalars()
    allowed: dict[uuid.UUID, bool] = {}
    to_review = 0
    for member_id in proposers:
        if member_id not in allowed:
            allowed[member_id] = _can_confirm_for(actor, member_id, db)
        to_review += allowed[member_id]
    return to_sort, to_review


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
    # One fetch: the title/type for FileIndex and the sharing metadata used to
    # route the file to a team folder.
    try:
        drive = get_drive_client_for_user(proposer_id, db)
        live = drive.files().get(fileId=file_id, fields=CONFIRM_FIELDS).execute()
    except HttpError:
        live = None
    if live is None:
        db.delete(c)
        db.commit()
        raise LookupError("that file is no longer in Drive")

    team_id = _route_team(org_id, proposer_id, live, db)
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
        .where(
            FolderFile.folder_id == folder_id,
            FileIndex.org_id == actor.organization_id,
            FileIndex.trashed_at.is_(None),
        )
        .order_by(FileIndex.modified_at.desc())
    ).scalars()
    return [f for f in rows if _can_see(actor, f, everything, db)]


def file_link(f: FileIndex) -> str | None:
    """Where a file card opens (Ronald, 2026-10-04). Real orgs: the file in
    Google; `drive.google.com/open` resolves to the right editor for any type.
    The sandbox's files don't exist in Google, so its cards open a blank file
    with the same name instead (Ronald picked that over no link), a new one
    each click."""
    if is_sandbox_org(f.org_id):
        from app.sandbox.drive import _new_file_link

        return _new_file_link(f.file_type, f.title)
    return f"https://drive.google.com/open?id={f.file_id}"


def _file_view(f: FileIndex) -> dict:
    return {
        "file_id": f.file_id,
        "name": f.title,
        "mime_type": f.file_type,
        "web_view_link": file_link(f),
        "modified_at": f.modified_at.isoformat(),
        "owner_user_id": str(f.owner_user_id) if f.owner_user_id else None,
        "team_id": str(f.team_id) if f.team_id else None,
    }


#: How long a file's stored name counts as fresh. Opening a folder re-reads
#: older ones from Google, so a rename in Docs shows up when you come back
#: (Ronald, 2026-10-04) instead of at the 6-hourly reconciliation sweep.
REFRESH_AFTER = timedelta(seconds=15)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _refresh_from_drive(files: list[FileIndex], db: Session) -> None:
    """Re-read name and edit time for stale rows, through each file's owner.
    Best effort: a file or owner Google won't answer for keeps what we had."""
    now = datetime.now(timezone.utc)
    stale: dict[uuid.UUID, list[FileIndex]] = {}
    for f in files:
        if f.owner_user_id and now - _as_utc(f.last_synced_at) > REFRESH_AFTER:
            stale.setdefault(f.owner_user_id, []).append(f)
    if not stale:
        return
    for owner_id, rows in stale.items():
        try:
            drive = get_drive_client_for_user(owner_id, db)
        except Exception:
            # No usable connection for this owner (not consented, delegation
            # not approved yet): the folder still opens with stored names.
            logger.info("librarian.refresh_skipped", owner_id=str(owner_id))
            continue
        for f in rows:
            try:
                live = drive.files().get(fileId=f.file_id, fields="name,modifiedTime").execute()
            except HttpError:
                continue
            f.title = live.get("name") or f.title
            if live.get("modifiedTime"):
                f.modified_at = datetime.fromisoformat(live["modifiedTime"].replace("Z", "+00:00"))
            f.last_synced_at = now
    db.commit()


def _detail_view(
    f: FileIndex, owners: dict[uuid.UUID, OrgMember], team_names: dict[uuid.UUID, str], can_manage: bool
) -> dict:
    """A file plus who owns it and its team, for the folder's details view
    (the same columns as Ownership)."""
    owner = owners.get(f.owner_user_id) if f.owner_user_id else None
    return {
        **_file_view(f),
        "owner": (
            {
                "name": owner.display_name or owner.email.split("@")[0],
                "email": owner.email,
                "personal": owner.auth_type == AuthType.PERSONAL_OAUTH,
            }
            if owner
            else None
        ),
        "team_name": team_names.get(f.team_id) if f.team_id else None,
        "private": bool((f.sharing_state or {}).get("private")),
        "can_manage": can_manage,
    }


def list_folders(actor: OrgMember, db: Session) -> list[dict]:
    ensure_team_folders(actor.organization_id, db)
    folders = db.execute(
        select(KnohowFolder)
        .where(KnohowFolder.org_id == actor.organization_id)
        .order_by(KnohowFolder.team_id.is_(None), KnohowFolder.name)
    ).scalars()
    everything = _sees_everything(actor, db)
    out = []
    for folder in folders:
        files = _visible_files(actor, folder.id, db)
        out.append(
            {
                "id": str(folder.id),
                "name": folder.name,
                "team_id": str(folder.team_id) if folder.team_id else None,
                "color": folder.color,
                "file_count": len(files),
                "preview": [_file_view(f) for f in files[:3]],
                # Rename / delete in the folder's pop-over; team folders follow
                # their team (Ronald, 2026-10-04).
                "can_manage": folder.team_id is None and (folder.created_by == actor.id or everything),
            }
        )
    return out


def folder_detail(actor: OrgMember, folder_id: uuid.UUID, db: Session) -> dict:
    folder = db.get(KnohowFolder, folder_id)
    if folder is None or folder.org_id != actor.organization_id:
        raise LookupError("folder not found")
    files = _visible_files(actor, folder.id, db)
    _refresh_from_drive(files, db)
    # A refreshed edit time can change the order.
    files.sort(key=lambda f: _as_utc(f.modified_at), reverse=True)
    org_id = actor.organization_id
    owners = {
        m.id: m
        for m in db.execute(select(OrgMember).where(OrgMember.organization_id == org_id)).scalars()
    }
    team_names = {
        t.id: t.name for t in db.execute(select(Team).where(Team.org_id == org_id)).scalars()
    }
    return {
        "id": str(folder.id),
        "name": folder.name,
        "team_id": str(folder.team_id) if folder.team_id else None,
        "color": folder.color,
        "files": [_detail_view(f, owners, team_names, _can_manage_file(actor, f, db)) for f in files],
    }


_HEX_COLOR = re.compile(r"#[0-9a-f]{6}")


def create_folder(actor: OrgMember, name: str, db: Session, color: str | None = None) -> dict:
    name = name.strip()
    if not name:
        raise LibrarianError("a folder needs a name")
    if len(name) > 255:
        raise LibrarianError("that name is too long")
    if color is not None:
        color = color.strip().lower()
        if not _HEX_COLOR.fullmatch(color):
            raise LibrarianError("a colour must look like #1a2b3c")
    folder = KnohowFolder(org_id=actor.organization_id, name=name, color=color, created_by=actor.id)
    db.add(folder)
    db.commit()
    return {
        "id": str(folder.id),
        "name": folder.name,
        "team_id": None,
        "color": folder.color,
        "file_count": 0,
        "preview": [],
        "can_manage": True,
    }


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
    name = folder.name
    db.delete(folder)
    db.commit()
    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="folder.deleted",
        target_resource_id=str(folder_id),
        details={"name": name},
        db=db,
    )


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
        .where(FileIndex.org_id == actor.organization_id, FileIndex.trashed_at.is_(None))
        .order_by(FileIndex.modified_at.desc())
    ).scalars()
    everything = _sees_everything(actor, db)
    return [_file_view(f) for f in rows if _can_see(actor, f, everything, db)]


# ------------------------------------------- rename, trash, restore (2026-10-04)

#: Google empties Drive's Trash after this long (ADR-0010).
TRASH_DAYS = 30


def _can_manage_file(actor: OrgMember, f: FileIndex, db: Session) -> bool:
    """The file's owner, a lead of its team, the org owner or a verified Super
    Admin (Ronald, 2026-10-04: the same people who can delete a folder)."""
    if f.owner_user_id == actor.id or _sees_everything(actor, db):
        return True
    if f.team_id is None:
        return False
    return (
        db.execute(
            select(OrgMembership.id).where(
                OrgMembership.org_id == actor.organization_id,
                OrgMembership.team_id == f.team_id,
                OrgMembership.user_id == actor.id,
                OrgMembership.role == OrgRole.TEAM_LEADER,
            )
        ).first()
        is not None
    )


def _managed_file(actor: OrgMember, file_id: str, db: Session) -> FileIndex:
    f = db.get(FileIndex, file_id)
    if f is None or f.org_id != actor.organization_id:
        raise LookupError("file not found")
    if not _can_manage_file(actor, f, db):
        raise PermissionError("only the file's owner, its team's lead, the owner or a Super Admin can change it")
    if f.owner_user_id is None:
        raise LibrarianError("this file has no owner Knohow can act for")
    return f


def rename_file(actor: OrgMember, file_id: str, name: str, db: Session) -> dict:
    name = name.strip()
    if not name:
        raise LibrarianError("a file needs a name")
    if len(name) > 1024:
        raise LibrarianError("that name is too long")
    f = _managed_file(actor, file_id, db)
    old = f.title
    # Through the owner, who can always rename; the actor may only be a viewer
    # in Drive.
    drive = get_drive_client_for_user(f.owner_user_id, db)
    live = drive.files().update(fileId=file_id, body={"name": name}, fields="name,modifiedTime").execute()
    f.title = live.get("name") or name
    if live.get("modifiedTime"):
        f.modified_at = datetime.fromisoformat(live["modifiedTime"].replace("Z", "+00:00"))
    f.last_synced_at = datetime.now(timezone.utc)
    db.commit()
    record_audit_entry(
        org_id=actor.organization_id,
        actor_user_id=actor.id,
        action_type="document.renamed",
        target_resource_id=file_id,
        details={"from": old, "to": f.title, "team_id": str(f.team_id) if f.team_id else None},
        db=db,
    )
    return _file_view(f)


def trash_file(actor: OrgMember, file_id: str, db: Session) -> None:
    """Into the owner's Drive Trash, never deleted (ADR-0010). The row and its
    folders stay, hidden, so a restore puts it back where it was."""
    f = _managed_file(actor, file_id, db)
    if f.trashed_at is not None:
        return
    drive = get_drive_client_for_user(f.owner_user_id, db)
    drive.files().update(fileId=file_id, body={"trashed": True}).execute()
    f.trashed_at = datetime.now(timezone.utc)
    f.trashed_by = actor.id
    db.commit()
    record_audit_entry(
        org_id=actor.organization_id,
        actor_user_id=actor.id,
        action_type="document.trashed",
        target_resource_id=file_id,
        details={"title": f.title, "team_id": str(f.team_id) if f.team_id else None},
        db=db,
    )


def restore_file(actor: OrgMember, file_id: str, db: Session) -> None:
    f = _managed_file(actor, file_id, db)
    if f.trashed_at is None:
        return
    drive = get_drive_client_for_user(f.owner_user_id, db)
    drive.files().update(fileId=file_id, body={"trashed": False}).execute()
    f.trashed_at = None
    f.trashed_by = None
    db.commit()
    record_audit_entry(
        org_id=actor.organization_id,
        actor_user_id=actor.id,
        action_type="document.restored",
        target_resource_id=file_id,
        details={"title": f.title, "team_id": str(f.team_id) if f.team_id else None},
        db=db,
    )


def trash(actor: OrgMember, db: Session) -> list[dict]:
    """Files deleted through Knohow that Google still holds and this person
    may restore, newest first."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=TRASH_DAYS)
    rows = db.execute(
        select(FileIndex)
        .where(FileIndex.org_id == actor.organization_id, FileIndex.trashed_at.is_not(None))
        .order_by(FileIndex.trashed_at.desc())
    ).scalars()
    out = []
    for f in rows:
        trashed = _as_utc(f.trashed_at)
        if trashed < cutoff or not _can_manage_file(actor, f, db):
            continue
        by = db.get(OrgMember, f.trashed_by) if f.trashed_by else None
        out.append(
            {
                **_file_view(f),
                "trashed_at": trashed.isoformat(),
                "gone_at": (trashed + timedelta(days=TRASH_DAYS)).isoformat(),
                "trashed_by": (by.display_name or by.email.split("@")[0]) if by else None,
            }
        )
    return out


def rename_folder(actor: OrgMember, folder_id: uuid.UUID, name: str, db: Session) -> dict:
    folder = db.get(KnohowFolder, folder_id)
    if folder is None or folder.org_id != actor.organization_id:
        raise LookupError("folder not found")
    if folder.team_id is not None:
        raise LibrarianError("a team's folder takes the team's name")
    name = name.strip()
    if not name:
        raise LibrarianError("a folder needs a name")
    if len(name) > 255:
        raise LibrarianError("that name is too long")
    org_id = actor.organization_id
    if not (folder.created_by == actor.id or is_owner(org_id, actor, db) or is_verified_super_admin(org_id, actor)):
        raise PermissionError("only whoever made this folder, the owner, or a verified Super Admin can rename it")
    old = folder.name
    folder.name = name
    db.commit()
    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="folder.renamed",
        target_resource_id=str(folder.id),
        details={"from": old, "to": name},
        db=db,
    )
    return {"id": str(folder.id), "name": folder.name}
