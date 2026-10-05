"""Removing a team from Manage teams (Ronald, 2026-10-05).

Setup's `delete_team` only undoes a typo and refuses once a team has people.
This is the real thing, for the owner or a verified Super Admin: a team with
people in it is removed only after they're either **moved** to another team
or **offboarded**, each one's files going to a person the caller picks.

What the team leaves behind:
- Teams under it move up to its parent.
- Its files and its folder's files go to the team people moved to; when they
  were offboarded, the files stay company files with no team.
- Its folder, join requests and pending reassignments go with it, and other
  teams' sharing rules and files stop naming it."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.models.file_index import FileIndex
from app.models.librarian import FolderFile, KnohowFolder
from app.models.org_member import OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.pending_reassignment import PendingReassignment
from app.models.team import Team
from app.models.team_join_request import TeamJoinRequest
from app.onboarding.service import is_owner, is_verified_super_admin
from app.org_chart.service import _require_team_in_org, offboard_member, upsert_membership


class RemoveTeamError(ValueError):
    """Something the caller can fix: shown to them as is."""


def _people(org_id: uuid.UUID, team_id: uuid.UUID, db: Session) -> list[uuid.UUID]:
    return list(
        dict.fromkeys(
            db.execute(
                select(OrgMembership.user_id).where(
                    OrgMembership.org_id == org_id, OrgMembership.team_id == team_id
                )
            ).scalars()
        )
    )


def remove_team(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    actor: OrgMember,
    db: Session,
    *,
    move_to_team_id: uuid.UUID | None = None,
    offboard_to_user_id: uuid.UUID | None = None,
) -> dict:
    if not (is_owner(org_id, actor, db) or is_verified_super_admin(org_id, actor)):
        raise PermissionError("only the owner or a verified Super Admin can remove a team")
    team = _require_team_in_org(team_id, org_id, db)
    people = _people(org_id, team_id, db)

    if move_to_team_id is not None and offboard_to_user_id is not None:
        raise RemoveTeamError("pick either moving everyone or offboarding them, not both")
    if people and move_to_team_id is None and offboard_to_user_id is None:
        raise RemoveTeamError("this team has people in it: move them or offboard them first")

    target: Team | None = None
    if move_to_team_id is not None:
        if move_to_team_id == team_id:
            raise RemoveTeamError("pick a different team to move everyone to")
        target = _require_team_in_org(move_to_team_id, org_id, db)

    if people and offboard_to_user_id is not None:
        if actor.id in people:
            raise RemoveTeamError("you're in this team, so you can't offboard everyone in it")
        if offboard_to_user_id in people:
            raise RemoveTeamError("their files need to go to someone who isn't in this team")
        recipient = db.get(OrgMember, offboard_to_user_id)
        if recipient is None or recipient.organization_id != org_id:
            raise RemoveTeamError("pick someone in your organization to take their files")

    # People first, while the team still exists.
    if target is not None:
        for user_id in people:
            already = db.execute(
                select(OrgMembership.id).where(
                    OrgMembership.org_id == org_id,
                    OrgMembership.team_id == target.id,
                    OrgMembership.user_id == user_id,
                )
            ).first()
            if already is None:
                upsert_membership(org_id, target.id, user_id, OrgRole.MEMBER, db, actor_member_id=actor.id)
    elif people:
        for user_id in people:
            offboard_member(org_id, user_id, offboard_to_user_id, actor.id, db)

    team_key = str(team_id)

    # Teams under it move up a level.
    for child in db.execute(select(Team).where(Team.parent_team_id == team_id)).scalars():
        child.parent_team_id = team.parent_team_id

    # Files: to the team people moved to, otherwise no team.
    files = db.execute(
        select(FileIndex).where(FileIndex.org_id == org_id, FileIndex.team_id == team_id)
    ).scalars().all()
    for f in files:
        f.team_id = target.id if target is not None else None
    for f in db.execute(select(FileIndex).where(FileIndex.org_id == org_id)).scalars():
        extra = (f.sharing_state or {}).get("extra_team_ids")
        if extra and team_key in extra:
            kept = [t for t in extra if t != team_key and (target is None or t != str(target.id))]
            f.sharing_state = {**f.sharing_state, "extra_team_ids": kept}

    for other in db.execute(select(Team).where(Team.org_id == org_id, Team.id != team_id)).scalars():
        if team_key in (other.share_extra_team_ids or []):
            other.share_extra_team_ids = [t for t in other.share_extra_team_ids if t != team_key]

    # Its folder: files into the new team's folder, then the folder goes.
    folder = db.execute(select(KnohowFolder).where(KnohowFolder.team_id == team_id)).scalar_one_or_none()
    if folder is not None:
        rows = db.execute(select(FolderFile).where(FolderFile.folder_id == folder.id)).scalars().all()
        if target is not None:
            from app.librarian.service import _add_to_folder, _team_folder

            into = _team_folder(org_id, target.id, db)
            if into is not None:
                for row in rows:
                    _add_to_folder(into, row.file_id, actor.id, db)
        for row in rows:
            db.delete(row)
        db.flush()
        db.delete(folder)

    for request in db.execute(select(TeamJoinRequest).where(TeamJoinRequest.team_id == team_id)).scalars():
        db.delete(request)
    for pending in db.execute(
        select(PendingReassignment).where(
            (PendingReassignment.old_team_id == team_id) | (PendingReassignment.new_team_id == team_id)
        )
    ).scalars():
        db.delete(pending)
    # Anyone left (an org-wide row can't point here, but a stray one would
    # block the delete).
    for membership in db.execute(select(OrgMembership).where(OrgMembership.team_id == team_id)).scalars():
        db.delete(membership)

    name = team.name
    db.flush()
    db.delete(team)
    db.commit()

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="org_chart.team.removed",
        target_resource_id=team_key,
        details={
            "name": name,
            "people": len(people),
            "moved_to_team_id": str(target.id) if target is not None else None,
            "offboarded_to_user_id": str(offboard_to_user_id) if people and offboard_to_user_id else None,
            "files": len(files),
        },
        db=db,
    )
    return {"removed": team_key, "people": len(people)}
