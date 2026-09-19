import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_approved_member, get_db
from app.models.org_member import OrgMember
from app.sharing.service import confirm_reassignment, decline_reassignment, request_team_reassignment

router = APIRouter(tags=["reassignments"])


class RequestReassignmentBody(BaseModel):
    member_id: uuid.UUID
    new_team_id: uuid.UUID


def _serialize(r) -> dict:
    return {
        "id": str(r.id),
        "member_id": str(r.member_id),
        "old_team_id": str(r.old_team_id) if r.old_team_id else None,
        "new_team_id": str(r.new_team_id),
        "affected_file_ids": r.affected_file_ids,
        "status": r.status.value,
    }


@router.post("/reassignments")
def request_reassignment(
    body: RequestReassignmentBody, db: Session = Depends(get_db), member: OrgMember = Depends(get_approved_member)
) -> dict:
    reassignment = request_team_reassignment(member.organization_id, body.member_id, body.new_team_id, member.id, db)
    return _serialize(reassignment)


@router.post("/reassignments/{reassignment_id}/confirm")
def confirm(
    reassignment_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(get_approved_member)
) -> dict:
    reassignment = confirm_reassignment(reassignment_id, member.organization_id, member.id, db)
    return _serialize(reassignment)


@router.post("/reassignments/{reassignment_id}/decline")
def decline(
    reassignment_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(get_approved_member)
) -> dict:
    reassignment = decline_reassignment(reassignment_id, member.organization_id, member.id, db)
    return _serialize(reassignment)
