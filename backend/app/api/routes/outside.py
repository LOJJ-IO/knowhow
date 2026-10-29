"""A team's link for people outside the organization, and the owner's /
Super Admin's keep-or-remove once they're in (ADR-0035)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.members.outside import (
    create_outside_link,
    keep_outside_member,
    outside_link_url,
    outside_link_view,
    remove_outside_member,
    set_outside_ask_first,
)
from app.models.org_member import OrgMember

router = APIRouter(prefix="/organizations/{org_id}", tags=["outside"])


def _run(fn, *args):
    try:
        return fn(*args)
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/teams/{team_id}/outside-link")
def get_outside_link(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    return _run(outside_link_view, org_id, team_id, member, db)


class OutsideLinkCreate(BaseModel):
    lifetime: str


@router.post("/teams/{team_id}/outside-link")
def post_outside_link(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    body: OutsideLinkCreate,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    link = _run(create_outside_link, org_id, team_id, body.lifetime, member, db)
    return {
        "url": outside_link_url(link),
        "expires_at": link.expires_at.isoformat() if link.expires_at else None,
    }


class OutsideLinkSettings(BaseModel):
    ask_first: bool


@router.patch("/teams/{team_id}/outside-link")
def patch_outside_link(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    body: OutsideLinkSettings,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    team = _run(set_outside_ask_first, org_id, team_id, body.ask_first, member, db)
    return {"ask_first": team.outside_ask_first}


@router.post("/outside-members/{member_id}/keep")
def keep_outside(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    _run(keep_outside_member, org_id, member_id, member, db)
    return {"kept": True}


@router.post("/outside-members/{member_id}/remove")
def remove_outside(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    return _run(remove_outside_member, org_id, member_id, member, db)
