import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.file_index import FileIndex
from app.models.org_membership import OrgMembership, OrgRole
from app.models.team import Team

# Roles that see every file in the organization regardless of team, per the
# org chart's role hierarchy — the whole point of authorized_user existing
# is elevated org-wide visibility without being the organizational owner.
_ORG_WIDE_VISIBILITY_ROLES = {OrgRole.TOP_LEADER, OrgRole.AUTHORIZED_USER}


def _descendant_team_ids(root_team_id: uuid.UUID, org_id: uuid.UUID, db: Session) -> set[uuid.UUID]:
    """A team_leader also sees the teams nested under the team they lead —
    Team.parent_team_id exists specifically to model that nesting."""
    all_teams = db.execute(select(Team.id, Team.parent_team_id).where(Team.org_id == org_id)).all()
    children_by_parent: dict[uuid.UUID | None, list[uuid.UUID]] = {}
    for team_id, parent_id in all_teams:
        children_by_parent.setdefault(parent_id, []).append(team_id)

    result: set[uuid.UUID] = set()
    frontier = [root_team_id]
    while frontier:
        current = frontier.pop()
        for child_id in children_by_parent.get(current, []):
            if child_id not in result:
                result.add(child_id)
                frontier.append(child_id)
    return result


def resolve_auto_share_recipients(org_id: uuid.UUID, team_id: uuid.UUID, db: Session) -> set[uuid.UUID]:
    """AUTO-SHARE recipients for a newly created file: the creator's team,
    and Top Leaders per the role hierarchy."""
    team_members = db.execute(
        select(OrgMembership.user_id).where(OrgMembership.org_id == org_id, OrgMembership.team_id == team_id)
    ).scalars().all()
    top_leaders = db.execute(
        select(OrgMembership.user_id).where(
            OrgMembership.org_id == org_id, OrgMembership.role == OrgRole.TOP_LEADER
        )
    ).scalars().all()
    return set(team_members) | set(top_leaders)


def visible_team_ids_for_member(member_id: uuid.UUID, org_id: uuid.UUID, db: Session) -> set[uuid.UUID] | None:
    """Returns the set of team_ids this member's role entitles them to see
    files for, or None to mean "all teams" (org-wide visibility roles).
    Server-side visibility enforcement uses this on every read path — see
    can_view_file and the /files endpoint — so a Marketing member can never
    retrieve Finance file metadata by crafting query parameters."""
    memberships = db.execute(
        select(OrgMembership).where(OrgMembership.org_id == org_id, OrgMembership.user_id == member_id)
    ).scalars().all()

    if any(m.role in _ORG_WIDE_VISIBILITY_ROLES for m in memberships):
        return None

    visible: set[uuid.UUID] = set()
    for m in memberships:
        if m.team_id is None:
            continue
        visible.add(m.team_id)
        if m.role == OrgRole.TEAM_LEADER:
            visible |= _descendant_team_ids(m.team_id, org_id, db)
    return visible


def _is_team_leader_of(member_id: uuid.UUID, team_id: uuid.UUID, org_id: uuid.UUID, db: Session) -> bool:
    return (
        db.execute(
            select(OrgMembership.id).where(
                OrgMembership.org_id == org_id,
                OrgMembership.user_id == member_id,
                OrgMembership.team_id == team_id,
                OrgMembership.role == OrgRole.TEAM_LEADER,
            )
        ).first()
        is not None
    )


def can_view_file(member_id: uuid.UUID, file: FileIndex, org_id: uuid.UUID, db: Session) -> bool:
    if file.owner_user_id == member_id:
        return True

    visible_team_ids = visible_team_ids_for_member(member_id, org_id, db)
    is_org_wide_visibility = visible_team_ids is None

    is_personal = bool(file.sharing_state.get("personal")) if file.sharing_state else False
    if is_personal:
        # Hidden from the rest of the team, but leaders (org-wide roles,
        # already covered by is_org_wide_visibility, plus this file's own
        # team_leader specifically) retain background access.
        if is_org_wide_visibility:
            return True
        if file.team_id is not None and _is_team_leader_of(member_id, file.team_id, org_id, db):
            return True
    else:
        if is_org_wide_visibility:
            return True
        if file.team_id is not None and file.team_id in visible_team_ids:
            return True

    # Explicit per-member grants recorded in sharing_state (e.g. a confirmed
    # SuggestedShare) always count regardless of team visibility.
    shared_with = file.sharing_state.get("shared_with_member_ids", []) if file.sharing_state else []
    return str(member_id) in shared_with
