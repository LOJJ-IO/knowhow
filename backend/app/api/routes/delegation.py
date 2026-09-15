import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.auth.delegation import approve_delegation, initiate_delegation, revoke_delegation
from app.models.org_member import OrgMember

router = APIRouter(prefix="/organizations/{org_id}/delegation", tags=["delegation"])


class InitiateDelegationRequest(BaseModel):
    verified_domain: str


class ApproveDelegationRequest(BaseModel):
    approving_admin_email: str


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


@router.post("/approve")
def approve(
    org_id: uuid.UUID,
    body: ApproveDelegationRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    grant = approve_delegation(org_id, body.approving_admin_email, db)
    return _serialize(grant)


@router.post("/revoke")
def revoke(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    grant = revoke_delegation(org_id, member.id, db)
    return _serialize(grant)
