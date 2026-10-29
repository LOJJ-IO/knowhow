"""People from outside the organization (ADR-0035).

A team lead (or the owner, a verified Super Admin, or the founder) makes a
link for one team that any Google account can use, Gmail included. It's for
nonprofits and clubs whose volunteers don't have the org's email. The
org-wide join link stays locked to the domain.

- "Ask me before they join" (`Team.outside_ask_first`, on by default): the
  newcomer waits as a join request to the team lead (owner / Super Admin
  back up, as for every join request). Off: anyone with the link is let in.
- Once someone from outside is in, the owner and every verified Super Admin
  are told (a Pending task) and can keep them or remove them.
- Removing takes them out of the organization: off every team, the file
  access Knohow can see they have on the org's files taken back, and the
  account can't sign in to the org or come back through a link. Files they
  own stay theirs (Google won't move a Gmail file to a company).
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from googleapiclient.errors import HttpError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.config import get_settings
from app.exceptions import KnohowError
from app.models.file_index import FileIndex
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.organization import Organization
from app.models.team import Team
from app.models.team_join_request import TeamJoinRequest, TeamJoinRequestStatus
from app.models.team_outside_link import TeamOutsideLink
from app.sandbox import is_sandbox_org

# The lifetime pills, same as the join link's.
OUTSIDE_LINK_LIFETIMES: dict[str, int | None] = {"24h": 1, "7d": 7, "30d": 30, "forever": None}

REMOVED_MESSAGE = "this account was removed from this organization"


def outside_link_url(link: TeamOutsideLink) -> str:
    # The same page as the join link: the token says which kind it is.
    return f"{get_settings().frontend_origin}/join/{link.token}"


def _team_in_org(org_id: uuid.UUID, team_id: uuid.UUID, db: Session) -> Team:
    team = db.get(Team, team_id)
    if team is None or team.org_id != org_id:
        raise ValueError(f"no team {team_id} in organization {org_id}")
    return team


def _leads_team(team: Team, member: OrgMember, db: Session) -> bool:
    if team.team_leader_id == member.id:
        return True
    return (
        db.execute(
            select(OrgMembership.id).where(
                OrgMembership.team_id == team.id,
                OrgMembership.user_id == member.id,
                OrgMembership.role == OrgRole.TEAM_LEADER,
            )
        ).first()
        is not None
    )


def _manages_org(org_id: uuid.UUID, member: OrgMember, db: Session) -> bool:
    from app.onboarding.service import is_owner, is_verified_super_admin

    return is_owner(org_id, member, db) or is_verified_super_admin(org_id, member)


def can_manage_outside_link(org_id: uuid.UUID, team: Team, member: OrgMember, db: Session) -> bool:
    """That team's lead, the owner, a verified Super Admin, or the founder
    (who may manage the org's join link too, ADR-0021)."""
    from app.onboarding.service import is_founding_member

    if member.organization_id != org_id or member.removed_at is not None:
        return False
    return (
        _leads_team(team, member, db)
        or _manages_org(org_id, member, db)
        or is_founding_member(org_id, member.id, db)
    )


def _require_link_role(org_id: uuid.UUID, team: Team, member: OrgMember, db: Session) -> None:
    if not can_manage_outside_link(org_id, team, member, db):
        raise PermissionError(
            "only this team's lead, the owner, a verified Super Admin or the organization's first member can do this"
        )


def _live_link(team_id: uuid.UUID, db: Session) -> TeamOutsideLink | None:
    now = datetime.now(timezone.utc)
    return db.execute(
        select(TeamOutsideLink)
        .where(
            TeamOutsideLink.team_id == team_id,
            TeamOutsideLink.revoked_at.is_(None),
            or_(TeamOutsideLink.expires_at.is_(None), TeamOutsideLink.expires_at > now),
        )
        .order_by(TeamOutsideLink.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def outside_link_view(org_id: uuid.UUID, team_id: uuid.UUID, actor: OrgMember, db: Session) -> dict:
    team = _team_in_org(org_id, team_id, db)
    _require_link_role(org_id, team, actor, db)
    link = _live_link(team.id, db)
    return {
        "team_id": str(team.id),
        "url": outside_link_url(link) if link else None,
        "expires_at": link.expires_at.isoformat() if link and link.expires_at else None,
        "ask_first": team.outside_ask_first,
    }


def create_outside_link(
    org_id: uuid.UUID, team_id: uuid.UUID, lifetime: str, actor: OrgMember, db: Session
) -> TeamOutsideLink:
    """A new link for the team, revoking the one before (one link per team,
    as with the join link). People already in stay in."""
    if lifetime not in OUTSIDE_LINK_LIFETIMES:
        raise ValueError(f"unknown link lifetime: {lifetime}")
    team = _team_in_org(org_id, team_id, db)
    _require_link_role(org_id, team, actor, db)

    now = datetime.now(timezone.utc)
    for live in db.execute(
        select(TeamOutsideLink).where(TeamOutsideLink.team_id == team.id, TeamOutsideLink.revoked_at.is_(None))
    ).scalars():
        live.revoked_at = now

    days = OUTSIDE_LINK_LIFETIMES[lifetime]
    link = TeamOutsideLink(
        id=uuid.uuid4(),
        organization_id=org_id,
        team_id=team.id,
        token=secrets.token_urlsafe(32),
        created_by_member_id=actor.id,
        expires_at=None if days is None else now + timedelta(days=days),
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="onboarding.outside_link.created",
        target_resource_id=str(team.id),
        details={"lifetime": lifetime, "link_id": str(link.id)},
        db=db,
    )
    return link


def set_outside_ask_first(
    org_id: uuid.UUID, team_id: uuid.UUID, ask_first: bool, actor: OrgMember, db: Session
) -> Team:
    team = _team_in_org(org_id, team_id, db)
    _require_link_role(org_id, team, actor, db)
    if team.outside_ask_first == ask_first:
        return team
    team.outside_ask_first = ask_first
    db.commit()
    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="onboarding.outside_link.ask_first_" + ("on" if ask_first else "off"),
        target_resource_id=str(team.id),
        details={},
        db=db,
    )
    return team


# ---------------------------------------------------------------- arriving


def find_outside_link(token: str, db: Session) -> TeamOutsideLink | None:
    """The outside link with this token, live or not; None when the token
    isn't an outside link at all (it may be the org's join link)."""
    link = db.execute(select(TeamOutsideLink).where(TeamOutsideLink.token == token)).scalar_one_or_none()
    if link is None or is_sandbox_org(link.organization_id):
        return None
    return link


def _alive(link: TeamOutsideLink) -> bool:
    now = datetime.now(timezone.utc)
    return link.revoked_at is None and (link.expires_at is None or link.expires_at > now)


def outside_link_preview(link: TeamOutsideLink, db: Session) -> dict:
    """The join page's preview, in the join link's shape."""
    org = db.get(Organization, link.organization_id)
    team = db.get(Team, link.team_id)
    valid = _alive(link) and org is not None and team is not None
    if valid:
        title = f"Join {org.name} on Knohow"
        description = f"Sign in with any Google account to join {team.name}."
    else:
        title = "This invite link has expired"
        description = "Ask whoever sent it for a new one."
    return {
        "organization_name": org.name if org else None,
        "organization_domain": None,
        "valid": valid,
        "title": title,
        "description": description,
    }


def assert_not_removed(org_id: uuid.UUID, email: str, db: Session) -> None:
    """Someone removed from an org can't come back in through any link."""
    removed = db.execute(
        select(OrgMember.id).where(
            OrgMember.organization_id == org_id,
            func.lower(OrgMember.email) == email.lower(),
            OrgMember.removed_at.is_not(None),
        ).limit(1)
    ).first()
    if removed is not None:
        raise ValueError(REMOVED_MESSAGE)


def join_through_outside_link(
    link: TeamOutsideLink, email: str, display_name: str | None, hosted_domain: str | None, db: Session
) -> OrgMember:
    """Sign-in through a team's outside link. Any Google account; works for
    people already in other orgs (one membership per org, as for clubs).

    An account on the org's own domain isn't "outside": it joins as an
    ordinary member of that team, through the same ask-first rule."""
    from app.org_chart.service import upsert_membership

    if not _alive(link):
        raise ValueError("this invite link has expired")
    org = db.get(Organization, link.organization_id)
    team = db.get(Team, link.team_id)
    if org is None or team is None:
        raise ValueError("join link not found")
    assert_not_removed(org.id, email, db)

    now = datetime.now(timezone.utc)
    org_domain = (org.observed_domain or org.verified_domain or "").lower()
    same_domain = bool(hosted_domain and org_domain and hosted_domain.lower() == org_domain)
    ask_first = team.outside_ask_first

    member = db.execute(
        select(OrgMember).where(
            OrgMember.organization_id == org.id,
            func.lower(OrgMember.email) == email.lower(),
            OrgMember.removed_at.is_(None),
        )
    ).scalars().first()
    if member is None:
        if same_domain:
            auth_type = AuthType.DOMAIN_DELEGATED
        elif org.is_club:
            # Clubs have no delegation at all, so this only says which kind
            # of account it is (as `_join_club` does).
            auth_type = AuthType.DOMAIN_DELEGATED if hosted_domain else AuthType.PERSONAL_OAUTH
        else:
            # Delegation only reaches the org's own domain: anyone else is
            # read through their own Drive consent.
            auth_type = AuthType.PERSONAL_OAUTH
        member = OrgMember(
            id=uuid.uuid4(),
            organization_id=org.id,
            email=email,
            display_name=display_name,
            auth_type=auth_type,
            standing=MemberStanding.AUTO_AFFILIATED if ask_first else MemberStanding.APPROVED,
            joined_from_outside_at=None if same_domain else now,
            # The link already says which team: no team-pick wizard.
            join_placement_completed_at=now,
        )
        db.add(member)
        db.flush()

    on_team = (
        db.execute(
            select(OrgMembership.id).where(OrgMembership.team_id == team.id, OrgMembership.user_id == member.id)
        ).first()
        is not None
    )
    if on_team:
        result = "already_on_team"
    elif ask_first:
        request = db.execute(
            select(TeamJoinRequest).where(TeamJoinRequest.team_id == team.id, TeamJoinRequest.member_id == member.id)
        ).scalar_one_or_none()
        if request is None:
            db.add(
                TeamJoinRequest(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    team_id=team.id,
                    member_id=member.id,
                    status=TeamJoinRequestStatus.PENDING,
                )
            )
        elif request.status == TeamJoinRequestStatus.REJECTED:
            # Asking again through a link someone sent them is a new ask.
            request.status = TeamJoinRequestStatus.PENDING
            request.created_at = now
        result = "requested"
    else:
        upsert_membership(org.id, team.id, member.id, OrgRole.MEMBER, db, _skip_audit=True)
        if member.standing != MemberStanding.APPROVED:
            member.standing = MemberStanding.APPROVED
        result = "joined_member"
    db.commit()
    db.refresh(member)

    record_audit_entry(
        org_id=org.id,
        actor_user_id=member.id,
        action_type="onboarding.joined_via_outside_link",
        target_resource_id=str(member.id),
        details={"email": email, "team_id": str(team.id), "result": result, "outside": not same_domain},
        db=db,
    )
    return member


# ------------------------------------------------------- telling the owner


def _team_names(org_id: uuid.UUID, member_id: uuid.UUID, db: Session) -> list[dict]:
    rows = db.execute(
        select(Team.id, Team.name)
        .join(OrgMembership, OrgMembership.team_id == Team.id)
        .where(OrgMembership.org_id == org_id, OrgMembership.user_id == member_id)
        .order_by(Team.name)
    ).all()
    return [{"id": str(team_id), "name": name} for team_id, name in rows]


def outside_join_tasks(org_id: uuid.UUID, viewer: OrgMember, db: Session) -> list[dict]:
    """"Someone from outside joined": for the owner and every verified Super
    Admin (user, 2026-10-16: both, always), once that person is on a team,
    until one of them keeps or removes them."""
    if not _manages_org(org_id, viewer, db):
        return []
    newcomers = db.execute(
        select(OrgMember)
        .where(
            OrgMember.organization_id == org_id,
            OrgMember.joined_from_outside_at.is_not(None),
            OrgMember.outside_reviewed_at.is_(None),
            OrgMember.removed_at.is_(None),
        )
        .order_by(OrgMember.joined_from_outside_at)
    ).scalars().all()
    tasks = []
    for person in newcomers:
        teams = _team_names(org_id, person.id, db)
        if not teams:
            continue  # still waiting on a lead; the join request is the task
        tasks.append(
            {
                "kind": "outside_joined",
                "id": str(person.id),
                "person": {"id": str(person.id), "email": person.email, "display_name": person.display_name},
                "teams": teams,
                "created_at": person.joined_from_outside_at.isoformat(),
            }
        )
    return tasks


def _outside_member(org_id: uuid.UUID, member_id: uuid.UUID, actor: OrgMember, db: Session) -> OrgMember:
    if actor.organization_id != org_id:
        raise PermissionError("not a member of this organization")
    if not _manages_org(org_id, actor, db):
        raise PermissionError("only the owner or a verified Super Admin can do this")
    target = db.get(OrgMember, member_id)
    if target is None or target.organization_id != org_id or target.removed_at is not None:
        raise ValueError("that person isn't in this organization")
    if target.joined_from_outside_at is None:
        raise ValueError("that person didn't join from outside the organization")
    return target


def keep_outside_member(org_id: uuid.UUID, member_id: uuid.UUID, actor: OrgMember, db: Session) -> OrgMember:
    target = _outside_member(org_id, member_id, actor, db)
    if target.outside_reviewed_at is None:
        target.outside_reviewed_at = datetime.now(timezone.utc)
        db.commit()
        record_audit_entry(
            org_id=org_id,
            actor_user_id=actor.id,
            action_type="members.outside_kept",
            target_resource_id=str(target.id),
            details={"email": target.email},
            db=db,
        )
    return target


def _take_back_file_access(org_id: uuid.UUID, target: OrgMember, db: Session) -> tuple[int, int]:
    """Removes the person's access to every org file Knohow knows of that
    they don't own, through each file owner's own Drive connection. Returns
    (files checked, files Knohow couldn't reach)."""
    from app.google.drive_client import get_drive_client_for_user
    from app.google.ownership import revoke_permission_if_not_owner

    if is_sandbox_org(org_id):
        return 0, 0
    files = db.execute(
        select(FileIndex.file_id, FileIndex.owner_user_id).where(
            FileIndex.org_id == org_id,
            FileIndex.owner_user_id.is_not(None),
            FileIndex.owner_user_id != target.id,
        )
    ).all()
    drives: dict[uuid.UUID, object | None] = {}
    unreachable = 0
    for file_id, owner_id in files:
        if owner_id not in drives:
            try:
                drives[owner_id] = get_drive_client_for_user(owner_id, db)
            except (KnohowError, ValueError):
                drives[owner_id] = None
        drive = drives[owner_id]
        if drive is None:
            unreachable += 1
            continue
        try:
            revoke_permission_if_not_owner(drive, file_id, target.email)
        except HttpError:
            unreachable += 1
    return len(files), unreachable


def remove_outside_member(org_id: uuid.UUID, member_id: uuid.UUID, actor: OrgMember, db: Session) -> dict:
    """Kick them out (user, 2026-10-16: out of the organization, not just the
    team)."""
    from app.onboarding.service import is_owner

    target = _outside_member(org_id, member_id, actor, db)
    if target.id == actor.id:
        raise ValueError("you can't remove yourself")
    if is_owner(org_id, target, db):
        raise ValueError("the owner can't be removed")

    checked, unreachable = _take_back_file_access(org_id, target, db)

    for membership in db.execute(
        select(OrgMembership).where(OrgMembership.org_id == org_id, OrgMembership.user_id == target.id)
    ).scalars():
        db.delete(membership)
    for request in db.execute(
        select(TeamJoinRequest).where(TeamJoinRequest.org_id == org_id, TeamJoinRequest.member_id == target.id)
    ).scalars():
        db.delete(request)
    target_key = str(target.id)
    for team in db.execute(select(Team).where(Team.org_id == org_id)).scalars():
        if team.team_leader_id == target.id:
            team.team_leader_id = None
        if team.owner_override_id == target.id:
            team.owner_override_id = None
        if target_key in (team.share_extra_member_ids or []):
            team.share_extra_member_ids = [i for i in team.share_extra_member_ids if i != target_key]
        if target_key in (team.share_excluded_member_ids or []):
            team.share_excluded_member_ids = [i for i in team.share_excluded_member_ids if i != target_key]
    org = db.get(Organization, org_id)
    if org is not None and org.club_account_member_id == target.id:
        org.club_account_member_id = None

    now = datetime.now(timezone.utc)
    target.removed_at = now
    target.outside_reviewed_at = target.outside_reviewed_at or now
    db.commit()

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="members.outside_removed",
        target_resource_id=str(target.id),
        details={"email": target.email, "files_checked": checked, "files_unreachable": unreachable},
        db=db,
    )
    return {"removed": True, "files_checked": checked, "files_unreachable": unreachable}
