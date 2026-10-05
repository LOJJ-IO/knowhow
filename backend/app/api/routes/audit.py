import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.audit.service import verify_audit_chain
from app.models.audit_log import AuditLogEntry
from app.models.org_member import OrgMember
from app.onboarding.service import is_owner, is_verified_super_admin

router = APIRouter(prefix="/organizations/{org_id}/audit", tags=["audit"])


@router.get("/verify")
def verify(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    result = verify_audit_chain(org_id, db)
    return {
        "valid": result.valid,
        "entries_checked": result.entries_checked,
        "broken_at_sequence": result.broken_at_sequence,
        "detail": result.detail,
    }


#: How much of the log Settings' Logs shows: recent history, not an archive.
LOG_LIMIT = 200


@router.get("/log")
def log(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    """Settings' Logs (Ronald, 2026-10-04): what happened in the organization,
    newest first. The whole org's history, so the owner and Super Admins only."""
    if not (is_owner(org_id, member, db) or is_verified_super_admin(org_id, member)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only the owner or a Super Admin can see the logs")
    entries = db.execute(
        select(AuditLogEntry)
        .where(AuditLogEntry.org_id == org_id)
        .order_by(AuditLogEntry.created_at.desc())
        .limit(LOG_LIMIT)
    ).scalars().all()
    names = {
        m.id: m.display_name or m.email.split("@")[0]
        for m in db.execute(select(OrgMember).where(OrgMember.organization_id == org_id)).scalars()
    }
    return {
        "entries": [
            {
                "id": str(e.id),
                "action": e.action_type,
                "actor": names.get(e.actor_user_id) if e.actor_user_id else None,
                # What it was about, when the entry names it.
                "subject": next(
                    (
                        e.details[k]
                        for k in ("to", "title", "name")
                        if isinstance((e.details or {}).get(k), str)
                    ),
                    None,
                ),
                "at": e.created_at.isoformat(),
            }
            for e in entries
        ]
    }
