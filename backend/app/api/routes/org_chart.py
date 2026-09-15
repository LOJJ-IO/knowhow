import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_member, get_db, require_same_org
from app.models.org_member import OrgMember
from app.models.org_membership import OrgRole
from app.org_chart.service import (
    assign_leader,
    create_team,
    edit_team,
    get_org_chart,
    offboard_member,
    remove_membership,
    upsert_membership,
)

router = APIRouter(tags=["org-chart"])


@router.get("/org-chart/{org_id}")
def read_org_chart(
    org_id: uuid.UUID, db: Session = Depends(get_db), member: OrgMember = Depends(require_same_org)
) -> dict:
    return get_org_chart(org_id, db)


class CreateTeamRequest(BaseModel):
    name: str
    parent_team_id: uuid.UUID | None = None


@router.post("/organizations/{org_id}/teams")
def create_team_route(
    org_id: uuid.UUID,
    body: CreateTeamRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    team = create_team(org_id, body.name, body.parent_team_id, member.id, db)
    return {"id": str(team.id), "name": team.name, "parent_team_id": str(team.parent_team_id) if team.parent_team_id else None}


class EditTeamRequest(BaseModel):
    name: str | None = None
    parent_team_id: uuid.UUID | None = None
    auto_own_enabled: bool | None = None


@router.patch("/organizations/{org_id}/teams/{team_id}")
def edit_team_route(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    body: EditTeamRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    team = edit_team(
        org_id, team_id, member.id, db, name=body.name, parent_team_id=body.parent_team_id, auto_own_enabled=body.auto_own_enabled
    )
    return {
        "id": str(team.id),
        "name": team.name,
        "parent_team_id": str(team.parent_team_id) if team.parent_team_id else None,
        "auto_own_enabled": team.auto_own_enabled,
    }


class AssignLeaderRequest(BaseModel):
    member_id: uuid.UUID


@router.post("/organizations/{org_id}/teams/{team_id}/leader")
def assign_leader_route(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    body: AssignLeaderRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    team = assign_leader(org_id, team_id, body.member_id, member.id, db)
    return {"id": str(team.id), "team_leader_id": str(team.team_leader_id)}


class UpsertMembershipRequest(BaseModel):
    member_id: uuid.UUID
    team_id: uuid.UUID | None = None
    role: OrgRole


@router.post("/organizations/{org_id}/memberships")
def upsert_membership_route(
    org_id: uuid.UUID,
    body: UpsertMembershipRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    membership = upsert_membership(org_id, body.team_id, body.member_id, body.role, db, actor_member_id=member.id)
    return {
        "id": str(membership.id),
        "user_id": str(membership.user_id),
        "team_id": str(membership.team_id) if membership.team_id else None,
        "role": membership.role.value,
    }


@router.delete("/organizations/{org_id}/memberships/{target_member_id}")
def remove_membership_route(
    org_id: uuid.UUID,
    target_member_id: uuid.UUID,
    team_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    remove_membership(org_id, team_id, target_member_id, member.id, db)
    return {"status": "removed"}


class OffboardRequest(BaseModel):
    user_id: uuid.UUID
    transfer_to_user_id: uuid.UUID | None = None


@router.post("/offboard")
def offboard_route(
    body: OffboardRequest, db: Session = Depends(get_db), member: OrgMember = Depends(get_current_member)
) -> dict:
    """Org-engine's composite offboarding endpoint: wraps the auth module's
    revoke_and_offboard with org-chart cleanup (membership removal, leader
    reassignment) — see app/org_chart/service.py::offboard_member. Distinct
    from POST /organizations/{org_id}/offboard in the auth module, which
    only does the Drive-side revoke/transfer."""
    result = offboard_member(member.organization_id, body.user_id, body.transfer_to_user_id, member.id, db)
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
