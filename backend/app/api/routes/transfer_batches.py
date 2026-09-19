import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_approved_member, get_db
from app.models.org_member import OrgMember
from app.transfers.service import PlannedTransfer, confirm_transfer_batch, create_transfer_batch, reverse_transfer_batch

router = APIRouter(tags=["transfer-batches"])


class PlannedTransferBody(BaseModel):
    file_id: str
    current_owner_member_id: uuid.UUID | None = None
    proposed_owner_member_id: uuid.UUID


class CreateBatchRequest(BaseModel):
    reason: str
    items: list[PlannedTransferBody]


def _serialize(batch) -> dict:
    return {
        "id": str(batch.id),
        "org_id": str(batch.org_id),
        "batch_type": batch.batch_type.value,
        "status": batch.status.value,
        "reason": batch.reason,
        "created_at": batch.created_at.isoformat(),
        "confirmed_at": batch.confirmed_at.isoformat() if batch.confirmed_at else None,
        "executed_at": batch.executed_at.isoformat() if batch.executed_at else None,
        "reversed_at": batch.reversed_at.isoformat() if batch.reversed_at else None,
        "items": [
            {
                "id": str(i.id),
                "file_id": i.file_id,
                "current_owner_member_id": str(i.current_owner_member_id) if i.current_owner_member_id else None,
                "proposed_owner_member_id": str(i.proposed_owner_member_id),
                "eligibility": i.eligibility.value,
                "status": i.status.value,
                "detail": i.detail,
            }
            for i in batch.items
        ],
    }


@router.post("/transfer-batches")
def create_batch(
    body: CreateBatchRequest, db: Session = Depends(get_db), member: OrgMember = Depends(get_approved_member)
) -> dict:
    """Computes and persists the dry-run PLAN for a bulk/retroactive
    transfer — nothing executes until POST .../confirm. (Routine
    single-file Auto-Own on creation bypasses this endpoint entirely — see
    app/transfers/service.py::auto_own_single_file, called from the
    sharing engine, not from here.)
    """
    planned = [PlannedTransfer(i.file_id, i.current_owner_member_id, i.proposed_owner_member_id) for i in body.items]
    batch = create_transfer_batch(member.organization_id, body.reason, member.id, planned, db)
    return _serialize(batch)


@router.post("/transfer-batches/{batch_id}/confirm")
def confirm(
    batch_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(get_approved_member)
) -> dict:
    batch = confirm_transfer_batch(batch_id, member.organization_id, member.id, db)
    return _serialize(batch)


@router.post("/transfer-batches/{batch_id}/reverse")
def reverse(
    batch_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(get_approved_member)
) -> dict:
    batch = reverse_transfer_batch(batch_id, member.organization_id, member.id, db)
    return _serialize(batch)
