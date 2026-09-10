import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.exceptions import CrossOrgAccessDenied
from app.models.org_membership import OrgMembership, OrgRole
from app.models.team import Team
from app.offboarding.service import OffboardResult, revoke_and_offboard


def _require_team_in_org(team_id: uuid.UUID, org_id: uuid.UUID, db: Session) -> Team:
    team = db.get(Team, team_id)
    if team is None:
        raise ValueError(f"no Team with id={team_id}")
    if team.org_id != org_id:
        raise CrossOrgAccessDenied(f"team {team_id} does not belong to organization {org_id}")
    return team


def create_team(
    org_id: uuid.UUID,
    name: str,
    parent_team_id: uuid.UUID | None,
    created_by_member_id: uuid.UUID,
    db: Session,
) -> Team:
    if parent_team_id is not None:
        _require_team_in_org(parent_team_id, org_id, db)

    team = Team(id=uuid.uuid4(), org_id=org_id, name=name, parent_team_id=parent_team_id)
    db.add(team)
    db.commit()
    db.refresh(team)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=created_by_member_id,
        action_type="org_chart.team.created",
        target_resource_id=str(team.id),
        details={"name": name, "parent_team_id": str(parent_team_id) if parent_team_id else None},
        db=db,
    )
    return team


def edit_team(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    actor_member_id: uuid.UUID,
    db: Session,
    name: str | None = None,
    parent_team_id: uuid.UUID | None = None,
    auto_own_enabled: bool | None = None,
) -> Team:
    team = _require_team_in_org(team_id, org_id, db)

    changes: dict = {}
    if name is not None and name != team.name:
        changes["name"] = {"old": team.name, "new": name}
        team.name = name
    if parent_team_id is not None and parent_team_id != team.parent_team_id:
        if parent_team_id == team_id:
            raise ValueError("a team cannot be its own parent")
        _require_team_in_org(parent_team_id, org_id, db)
        changes["parent_team_id"] = {"old": str(team.parent_team_id), "new": str(parent_team_id)}
        team.parent_team_id = parent_team_id
    if auto_own_enabled is not None and auto_own_enabled != team.auto_own_enabled:
        changes["auto_own_enabled"] = {"old": team.auto_own_enabled, "new": auto_own_enabled}
        team.auto_own_enabled = auto_own_enabled

    if not changes:
        return team

    db.commit()
    db.refresh(team)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="org_chart.team.edited",
        target_resource_id=str(team.id),
        details=changes,
        db=db,
    )
    return team


def assign_leader(
    org_id: uuid.UUID, team_id: uuid.UUID, member_id: uuid.UUID, actor_member_id: uuid.UUID, db: Session
) -> Team:
    team = _require_team_in_org(team_id, org_id, db)
    previous_leader_id = team.team_leader_id

    if previous_leader_id is not None and previous_leader_id != member_id:
        previous_leader_membership = db.execute(
            select(OrgMembership).where(
                OrgMembership.team_id == team_id,
                OrgMembership.user_id == previous_leader_id,
                OrgMembership.role == OrgRole.TEAM_LEADER,
            )
        ).scalar_one_or_none()
        if previous_leader_membership is not None:
            previous_leader_membership.role = OrgRole.MEMBER

    team.team_leader_id = member_id
    upsert_membership(org_id, team_id, member_id, OrgRole.TEAM_LEADER, db, _skip_audit=True)

    db.commit()
    db.refresh(team)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="org_chart.team.leader_assigned",
        target_resource_id=str(team.id),
        details={
            "previous_leader_id": str(previous_leader_id) if previous_leader_id else None,
            "new_leader_id": str(member_id),
        },
        db=db,
    )
    return team


def upsert_membership(
    org_id: uuid.UUID,
    team_id: uuid.UUID | None,
    member_id: uuid.UUID,
    role: OrgRole,
    db: Session,
    actor_member_id: uuid.UUID | None = None,
    _skip_audit: bool = False,
) -> OrgMembership:
    """Adds a member to a team with a role, or updates their role if a
    membership row for that (team_id, member_id) pair already exists.
    team_id=None is valid for org-wide roles (top_leader, authorized_user)."""
    if team_id is not None:
        _require_team_in_org(team_id, org_id, db)

    existing = db.execute(
        select(OrgMembership).where(
            OrgMembership.org_id == org_id,
            OrgMembership.team_id == team_id,
            OrgMembership.user_id == member_id,
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.role = role
        membership = existing
    else:
        membership = OrgMembership(
            id=uuid.uuid4(), org_id=org_id, user_id=member_id, team_id=team_id, role=role
        )
        db.add(membership)

    db.commit()
    db.refresh(membership)

    if not _skip_audit:
        record_audit_entry(
            org_id=org_id,
            actor_user_id=actor_member_id,
            action_type="org_chart.membership.upserted",
            target_resource_id=str(membership.id),
            details={"user_id": str(member_id), "team_id": str(team_id) if team_id else None, "role": role.value},
            db=db,
        )
    return membership


def remove_membership(
    org_id: uuid.UUID, team_id: uuid.UUID | None, member_id: uuid.UUID, actor_member_id: uuid.UUID, db: Session
) -> None:
    memberships = (
        db.execute(
            select(OrgMembership).where(
                OrgMembership.org_id == org_id,
                OrgMembership.team_id == team_id,
                OrgMembership.user_id == member_id,
            )
        )
        .scalars()
        .all()
    )
    for membership in memberships:
        db.delete(membership)

    if team_id is not None:
        team = db.get(Team, team_id)
        if team is not None and team.team_leader_id == member_id:
            team.team_leader_id = None

    db.commit()

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="org_chart.membership.removed",
        target_resource_id=str(member_id),
        details={"team_id": str(team_id) if team_id else None},
        db=db,
    )


def get_org_chart(org_id: uuid.UUID, db: Session) -> dict:
    """Assembles the full chart: every team (with parent/child links) and
    every membership, plus org-wide roles (top_leader/authorized_user, which
    have no team_id). Generic and field-complete rather than shaped for any
    particular screen — see the endpoint contract note in the routes."""
    teams = db.execute(select(Team).where(Team.org_id == org_id)).scalars().all()
    memberships = db.execute(select(OrgMembership).where(OrgMembership.org_id == org_id)).scalars().all()

    memberships_by_team: dict[str, list[dict]] = {}
    org_wide_memberships: list[dict] = []
    for m in memberships:
        entry = {"id": str(m.id), "user_id": str(m.user_id), "role": m.role.value}
        if m.team_id is None:
            org_wide_memberships.append(entry)
        else:
            memberships_by_team.setdefault(str(m.team_id), []).append(entry)

    return {
        "org_id": str(org_id),
        "teams": [
            {
                "id": str(t.id),
                "name": t.name,
                "team_leader_id": str(t.team_leader_id) if t.team_leader_id else None,
                "parent_team_id": str(t.parent_team_id) if t.parent_team_id else None,
                "auto_own_enabled": t.auto_own_enabled,
                "memberships": memberships_by_team.get(str(t.id), []),
            }
            for t in teams
        ],
        "org_wide_memberships": org_wide_memberships,
    }


def offboard_member(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    transfer_to_user_id: uuid.UUID | None,
    actor_member_id: uuid.UUID,
    db: Session,
) -> OffboardResult:
    """Wraps the auth module's revoke_and_offboard (imported, not
    reimplemented) with org-chart cleanup: removes every OrgMembership row
    for the departing member, and if they held team_leader on any team,
    reassigns that team's leadership to transfer_to_user_id (when one was
    given) rather than just leaving the team leaderless."""
    result = revoke_and_offboard(user_id, org_id, transfer_to_user_id, db)

    led_teams = db.execute(select(Team).where(Team.org_id == org_id, Team.team_leader_id == user_id)).scalars().all()

    memberships = db.execute(
        select(OrgMembership).where(OrgMembership.org_id == org_id, OrgMembership.user_id == user_id)
    ).scalars().all()
    team_ids = {m.team_id for m in memberships if m.team_id is not None}
    for team_id in team_ids:
        remove_membership(org_id, team_id, user_id, actor_member_id, db)
    org_wide_roles = [m for m in memberships if m.team_id is None]
    for m in org_wide_roles:
        remove_membership(org_id, None, user_id, actor_member_id, db)

    if transfer_to_user_id is not None:
        for team in led_teams:
            assign_leader(org_id, team.id, transfer_to_user_id, actor_member_id, db)
    else:
        for team in led_teams:
            team.team_leader_id = None
        db.commit()

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="org_chart.member_offboarded",
        target_resource_id=str(user_id),
        details={
            "transfer_to_user_id": str(transfer_to_user_id) if transfer_to_user_id else None,
            "teams_led_reassigned": [str(t.id) for t in led_teams] if transfer_to_user_id else [],
            "teams_left_leaderless": [str(t.id) for t in led_teams] if not transfer_to_user_id else [],
        },
        db=db,
    )
    return result
