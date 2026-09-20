import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.auth.delegation import (
    DelegationCheckError,
    check_delegation,
    delegation_setup,
    initiate_delegation,
    revoke_delegation,
)
from app.models.org_member import OrgMember

router = APIRouter(prefix="/organizations/{org_id}/delegation", tags=["delegation"])


class InitiateDelegationRequest(BaseModel):
    verified_domain: str


def _serialize(grant) -> dict:
    return {
        "id": str(grant.id),
        "organization_id": str(grant.organization_id),
        "status": grant.status.value,
        "verified_domain": grant.verified_domain,
        "approving_admin_email": grant.approving_admin_email,
        "approved_at": grant.approved_at.isoformat() if grant.approved_at else None,
        "revoked_at": grant.revoked_at.isoformat() if grant.revoked_at else None,
        "granted_scopes": grant.granted_scopes,
    }


@router.post("/initiate")
def initiate(
    org_id: uuid.UUID,
    body: InitiateDelegationRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    grant = initiate_delegation(org_id, body.verified_domain, member.id, db)
    return _serialize(grant)


@router.get("/setup")
def setup(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    """The Admin console guide: exactly what the Super Admin enters, plus
    where things stand."""
    guide = delegation_setup()
    return {
        "client_id": guide.client_id,
        "scopes": guide.scopes,
        "scopes_csv": guide.scopes_csv,
        "admin_console_url": guide.admin_console_url,
        **_check(org_id, db),
    }


@router.post("/check")
def check(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    """Checks now (the scheduler also checks every few minutes): an
    impersonated call as the verified Super Admin — approves on success."""
    return _check(org_id, db)


@router.post("/approve")
def approve(org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)) -> dict:
    """Kept for existing callers. Approval is no longer taken on anyone's
    word — this runs the same check as /check."""
    return _check(org_id, db)


def _check(org_id: uuid.UUID, db: Session) -> dict:
    try:
        result = check_delegation(org_id, db)
    except DelegationCheckError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"couldn't check delegation: {exc}") from exc
    return {"status": result.status, "missing_scopes": result.missing_scopes}


@router.post("/revoke")
def revoke(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    grant = revoke_delegation(org_id, member.id, db)
    return _serialize(grant)
