from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_approved_member, get_db
from app.models.org_member import OrgMember
from app.models.suggested_share import SuggestedShare, SuggestedShareStatus
from app.sharing.service import confirm_suggested_share, decline_suggested_share

router = APIRouter(tags=["suggested-share"])


def _find_pending(file_id: str, org_id, db: Session) -> SuggestedShare:
    suggestion = db.execute(
        select(SuggestedShare)
        .where(
            SuggestedShare.file_id == file_id,
            SuggestedShare.org_id == org_id,
            SuggestedShare.status == SuggestedShareStatus.PENDING,
        )
        .order_by(SuggestedShare.created_at.desc())
    ).scalars().first()
    if suggestion is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"no pending suggested share for file {file_id}")
    return suggestion


@router.post("/files/{file_id}/suggested-share/confirm")
def confirm(file_id: str, db: Session = Depends(get_db), member: OrgMember = Depends(get_approved_member)) -> dict:
    suggestion = _find_pending(file_id, member.organization_id, db)
    result = confirm_suggested_share(suggestion.id, member.organization_id, member.id, db)
    return {"id": str(result.id), "status": result.status.value}


@router.post("/files/{file_id}/suggested-share/decline")
def decline(file_id: str, db: Session = Depends(get_db), member: OrgMember = Depends(get_approved_member)) -> dict:
    suggestion = _find_pending(file_id, member.organization_id, db)
    result = decline_suggested_share(suggestion.id, member.organization_id, member.id, db)
    return {"id": str(result.id), "status": result.status.value}
