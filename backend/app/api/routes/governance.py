"""Read endpoints for the Ownership, Sharing and Offboarding screens.

One call per screen, shaped for it, over the existing engines (transfers,
sharing, offboarding). Writes stay on the engines' own endpoints:
/transfer-batches, /files/{id}/suggested-share/*, PATCH .../teams/{id},
and POST /offboard."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from googleapiclient.errors import HttpError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.audit.service import record_audit_entry
from app.exceptions import DelegationNotApproved, PersonalAccountNotConsented
from app.google.drive_client import get_drive_client_for_user
from app.models.audit_log import AuditLogEntry
from app.models.file_index import FileIndex
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.suggested_share import SuggestedShare, SuggestedShareStatus
from app.models.team import Team
from app.models.transfer_batch import TransferBatch
from app.models.unresolved_ownership import UnresolvedOwnership
from app.onboarding.service import is_owner, is_verified_super_admin
from app.sharing.visibility import can_view_file

router = APIRouter(prefix="/organizations/{org_id}", tags=["governance"])


# ---------------------------------------------------------------- shared


def _people(org_id: uuid.UUID, db: Session) -> list[dict]:
    members = db.execute(select(OrgMember).where(OrgMember.organization_id == org_id)).scalars().all()
    memberships = db.execute(select(OrgMembership).where(OrgMembership.org_id == org_id)).scalars().all()
    teams_of: dict[uuid.UUID, list[str]] = {}
    for m in memberships:
        if m.team_id is not None:
            teams_of.setdefault(m.user_id, []).append(str(m.team_id))
    return [
        {
            "id": str(m.id),
            "name": m.display_name or m.email.split("@")[0],
            "email": m.email,
            "personal": m.auth_type == AuthType.PERSONAL_OAUTH,
            "team_ids": teams_of.get(m.id, []),
        }
        for m in members
    ]


def _teams(org_id: uuid.UUID, db: Session) -> list[Team]:
    return list(db.execute(select(Team).where(Team.org_id == org_id).order_by(Team.name)).scalars())


def _manages_org(member: OrgMember, db: Session) -> bool:
    return is_owner(member.organization_id, member, db) or is_verified_super_admin(member.organization_id, member)


def _led_team_ids(member: OrgMember, db: Session) -> set[uuid.UUID]:
    return set(
        db.execute(
            select(OrgMembership.team_id).where(
                OrgMembership.org_id == member.organization_id,
                OrgMembership.user_id == member.id,
                OrgMembership.role == OrgRole.TEAM_LEADER,
            )
        ).scalars()
    ) - {None}


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _file_view(f: FileIndex) -> dict:
    return {
        "file_id": f.file_id,
        "title": f.title,
        "mime_type": f.file_type,
        "modified_at": _iso(f.modified_at),
        "owner_id": str(f.owner_user_id) if f.owner_user_id else None,
        "team_id": str(f.team_id) if f.team_id else None,
        "private": bool((f.sharing_state or {}).get("private")),
    }


# ------------------------------------------------------------- ownership


@router.get("/ownership")
def ownership(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    """Every company file the caller may see, with its owner; recent and
    waiting ownership moves; and files whose ownership can't move."""
    files = db.execute(
        select(FileIndex).where(FileIndex.org_id == org_id).order_by(FileIndex.modified_at.desc())
    ).scalars().all()
    visible = [f for f in files if can_view_file(member.id, f, org_id, db)]
    titles = {f.file_id: f.title for f in files}

    batches = db.execute(
        select(TransferBatch).where(TransferBatch.org_id == org_id).order_by(TransferBatch.created_at.desc()).limit(20)
    ).scalars().all()
    unresolved = db.execute(
        select(UnresolvedOwnership)
        .where(UnresolvedOwnership.org_id == org_id, UnresolvedOwnership.resolved_at.is_(None))
        .order_by(UnresolvedOwnership.created_at.desc())
    ).scalars().all()

    return {
        "can_manage": _manages_org(member, db) or bool(_led_team_ids(member, db)),
        "people": _people(org_id, db),
        "teams": [{"id": str(t.id), "name": t.name} for t in _teams(org_id, db)],
        "files": [_file_view(f) for f in visible],
        "batches": [
            {
                "id": str(b.id),
                "reason": b.reason,
                "status": b.status.value,
                "kind": b.batch_type.value,
                "created_by": str(b.created_by_member_id) if b.created_by_member_id else None,
                "created_at": _iso(b.created_at),
                "executed_at": _iso(b.executed_at),
                "reversed_at": _iso(b.reversed_at),
                "items": [
                    {
                        "file_id": i.file_id,
                        "title": titles.get(i.file_id, "Untitled"),
                        "from_id": str(i.current_owner_member_id) if i.current_owner_member_id else None,
                        "to_id": str(i.proposed_owner_member_id),
                        "eligible": i.eligibility.value == "eligible",
                        "status": i.status.value,
                    }
                    for i in b.items
                ],
            }
            for b in batches
        ],
        "unresolved": [
            {
                "id": str(u.id),
                "file_id": u.file_id,
                "title": titles.get(u.file_id, "Untitled"),
                "owner_id": str(u.current_owner_member_id) if u.current_owner_member_id else None,
                "recipient_id": str(u.intended_recipient_member_id) if u.intended_recipient_member_id else None,
                "reason": u.reason.value,
                "created_at": _iso(u.created_at),
            }
            for u in unresolved
        ],
    }


@router.post("/unresolved-ownership/{item_id}/resolve")
def resolve_unresolved(
    org_id: uuid.UUID, item_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    """Someone moved it by hand (re-shared or copied it): clear it from the list."""
    item = db.get(UnresolvedOwnership, item_id)
    if item is None or item.org_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    if not (_manages_org(member, db) or _led_team_ids(member, db)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only an owner, Super Admin or team lead can do this")
    item.resolved_at = datetime.now(timezone.utc)
    db.commit()
    record_audit_entry(
        org_id=org_id,
        actor_user_id=member.id,
        action_type="ownership.unresolved_cleared",
        target_resource_id=item.file_id,
        details={"unresolved_id": str(item.id)},
        db=db,
    )
    return {"id": str(item.id), "resolved": True}


# --------------------------------------------------------------- sharing


def _ownership_target(team: Team, owner_id: uuid.UUID | None) -> uuid.UUID | None:
    return team.team_leader_id or owner_id


@router.get("/sharing")
def sharing(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    """Each team's standing rules — who a new file is shared with and who
    ends up owning it — and the caller's own files waiting on a share
    decision (titles read live, shown only to their creator)."""
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    owner_id = chart.owner_member_id if chart else None
    top_leaders = list(
        db.execute(
            select(OrgMembership.user_id).where(
                OrgMembership.org_id == org_id, OrgMembership.role == OrgRole.TOP_LEADER
            )
        ).scalars()
    )
    counts = dict(
        db.execute(
            select(OrgMembership.team_id, func.count())
            .where(OrgMembership.org_id == org_id, OrgMembership.team_id.is_not(None))
            .group_by(OrgMembership.team_id)
        ).all()
    )
    file_counts = dict(
        db.execute(
            select(FileIndex.team_id, func.count())
            .where(FileIndex.org_id == org_id, FileIndex.team_id.is_not(None))
            .group_by(FileIndex.team_id)
        ).all()
    )
    manages = _manages_org(member, db)
    led = _led_team_ids(member, db)

    pending = db.execute(
        select(SuggestedShare)
        .where(
            SuggestedShare.org_id == org_id,
            SuggestedShare.creator_user_id == member.id,
            SuggestedShare.status == SuggestedShareStatus.PENDING,
        )
        .order_by(SuggestedShare.created_at.desc())
    ).scalars().all()
    live: dict[str, dict] = {}
    if pending:
        try:
            drive = get_drive_client_for_user(member.id, db)
            for s in pending:
                try:
                    live[s.file_id] = drive.files().get(
                        fileId=s.file_id, fields="id,name,mimeType,modifiedTime,webViewLink"
                    ).execute()
                except HttpError:
                    continue
        except (DelegationNotApproved, PersonalAccountNotConsented):
            pass

    return {
        "people": _people(org_id, db),
        "top_leader_ids": [str(m) for m in top_leaders],
        "teams": [
            {
                "id": str(t.id),
                "name": t.name,
                "lead_id": str(t.team_leader_id) if t.team_leader_id else None,
                "member_count": counts.get(t.id, 0),
                "file_count": file_counts.get(t.id, 0),
                "auto_own": t.auto_own_enabled,
                "owner_target_id": str(target) if (target := _ownership_target(t, owner_id)) else None,
                "can_edit": manages or t.id in led,
            }
            for t in _teams(org_id, db)
        ],
        "suggestions": [
            {
                "id": str(s.id),
                "file_id": s.file_id,
                "title": live[s.file_id].get("name", "Untitled"),
                "mime_type": live[s.file_id].get("mimeType", ""),
                "modified_at": live[s.file_id].get("modifiedTime"),
                "web_view_link": live[s.file_id].get("webViewLink"),
                "recipient_ids": list(s.proposed_recipients),
                "created_at": _iso(s.created_at),
            }
            for s in pending
            if s.file_id in live
        ],
    }


# ------------------------------------------------------------ offboarding


def _may_offboard(actor: OrgMember, target_id: uuid.UUID, db: Session) -> bool:
    if _manages_org(actor, db):
        return True
    if actor.id == target_id:
        return False
    target_teams = set(
        db.execute(
            select(OrgMembership.team_id).where(
                OrgMembership.org_id == actor.organization_id, OrgMembership.user_id == target_id
            )
        ).scalars()
    ) - {None}
    return bool(target_teams & _led_team_ids(actor, db))


@router.get("/offboarding")
def offboarding(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    """Everyone still on a team (with how many company files they own and
    whether the caller may offboard them), and who has already left."""
    people = _people(org_id, db)
    owned = dict(
        db.execute(
            select(FileIndex.owner_user_id, func.count())
            .where(FileIndex.org_id == org_id)
            .group_by(FileIndex.owner_user_id)
        ).all()
    )
    led_by: dict[str, list[str]] = {}
    for t in _teams(org_id, db):
        if t.team_leader_id:
            led_by.setdefault(str(t.team_leader_id), []).append(str(t.id))
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    owner_id = str(chart.owner_member_id) if chart and chart.owner_member_id else None

    history = db.execute(
        select(AuditLogEntry)
        .where(AuditLogEntry.org_id == org_id, AuditLogEntry.action_type == "offboard.completed")
        .order_by(AuditLogEntry.created_at.desc())
        .limit(20)
    ).scalars().all()
    left = {e.target_resource_id for e in history}

    active = []
    for p in people:
        if p["id"] in left or (not p["team_ids"] and p["id"] != owner_id):
            continue
        active.append(
            {
                **p,
                "files_owned": owned.get(uuid.UUID(p["id"]), 0),
                "leads_team_ids": led_by.get(p["id"], []),
                "is_owner": p["id"] == owner_id,
                "can_offboard": p["id"] != owner_id and _may_offboard(member, uuid.UUID(p["id"]), db),
            }
        )

    return {
        "people": people,
        "teams": [{"id": str(t.id), "name": t.name, "lead_id": str(t.team_leader_id) if t.team_leader_id else None} for t in _teams(org_id, db)],
        "active": active,
        "history": [
            {
                "member_id": e.target_resource_id,
                "at": _iso(e.created_at),
                "by_id": str(e.actor_user_id) if e.actor_user_id else None,
                "files_moved": (e.details or {}).get("files_affected", 0) - (e.details or {}).get("unresolved_count", 0),
                "needs_attention": (e.details or {}).get("unresolved_count", 0),
                "to_id": (e.details or {}).get("transfer_to_user_id"),
            }
            for e in history
        ],
    }


@router.get("/offboarding/preview")
def offboarding_preview(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    transfer_to: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    """What offboarding `user_id` would do, before it's done: every file they
    own in Drive and whether it can move to `transfer_to`."""
    if not _may_offboard(member, user_id, db):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only an owner, Super Admin or their team lead can do this")
    departing = db.get(OrgMember, user_id)
    recipient = db.get(OrgMember, transfer_to)
    if departing is None or recipient is None or departing.organization_id != org_id or recipient.organization_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    movable = departing.auth_type == AuthType.DOMAIN_DELEGATED and recipient.auth_type == AuthType.DOMAIN_DELEGATED

    files: list[dict] = []
    try:
        drive = get_drive_client_for_user(user_id, db)
        response = drive.files().list(
            q="'me' in owners and trashed = false",
            orderBy="modifiedTime desc",
            pageSize=200,
            fields="files(id,name,mimeType,modifiedTime)",
        ).execute()
        files = [
            {
                "file_id": f["id"],
                "title": f.get("name", "Untitled"),
                "mime_type": f.get("mimeType", ""),
                "modified_at": f.get("modifiedTime"),
                "movable": movable,
            }
            for f in response.get("files", [])
        ]
    except (DelegationNotApproved, PersonalAccountNotConsented):
        # Their Drive can't be read: the preview falls back to Knohow's own
        # record of what they own.
        rows = db.execute(
            select(FileIndex).where(FileIndex.org_id == org_id, FileIndex.owner_user_id == user_id)
        ).scalars().all()
        files = [
            {
                "file_id": f.file_id,
                "title": f.title,
                "mime_type": f.file_type,
                "modified_at": _iso(f.modified_at),
                "movable": movable,
            }
            for f in rows
        ]
    except HttpError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Google didn't answer. Try again in a moment.") from exc

    return {"files": files, "movable": movable}
