from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_member, get_db
from app.models.org_member import OrgMember
from app.search.deepsearch import search

router = APIRouter(tags=["search"])


@router.get("/search")
def deepsearch(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=25, le=100),
    db: Session = Depends(get_db),
    member: OrgMember = Depends(get_current_member),
) -> dict:
    results = search(member.organization_id, member.id, q, db, limit=limit)
    return {
        "query": q,
        "results": [
            {
                "file_id": r.file_id,
                "title": r.title,
                "file_type": r.file_type,
                "owner_email": r.owner_email,
                "modified_at": r.modified_at,
                "matched_via_member_ids": r.matched_via_member_ids,
            }
            for r in results
        ],
    }
