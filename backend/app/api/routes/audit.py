import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.audit.service import verify_audit_chain
from app.models.org_member import OrgMember

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
