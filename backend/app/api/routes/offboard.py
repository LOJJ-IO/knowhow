import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.models.org_member import OrgMember
from app.offboarding.service import revoke_and_offboard

router = APIRouter(prefix="/organizations/{org_id}", tags=["offboarding"])


class OffboardRequest(BaseModel):
    user_id: uuid.UUID
    transfer_to_user_id: uuid.UUID | None = None


@router.post("/offboard")
def offboard(
    org_id: uuid.UUID,
    body: OffboardRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    result = revoke_and_offboard(body.user_id, org_id, body.transfer_to_user_id, db)
    return {
        "user_id": str(result.user_id),
        "org_id": str(result.org_id),
        "transfer_to_user_id": str(result.transfer_to_user_id) if result.transfer_to_user_id else None,
        "unresolved_count": result.unresolved_count,
        "files": [
            {"file_id": f.file_id, "file_name": f.file_name, "action": f.action, "detail": f.detail}
            for f in result.files
        ],
    }
