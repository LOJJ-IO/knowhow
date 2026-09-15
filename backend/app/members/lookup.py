import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.org_member import OrgMember
from app.models.org_membership import OrgMembership


def resolve_member_by_email(org_id: uuid.UUID, email: str | None, db: Session) -> OrgMember | None:
    if not email:
        return None
    return db.execute(
        select(OrgMember).where(OrgMember.organization_id == org_id, func.lower(OrgMember.email) == email.lower())
    ).scalar_one_or_none()


def member_team(org_id: uuid.UUID, member_id: uuid.UUID, db: Session) -> uuid.UUID | None:
    """The one team a member's role/team-scoped OrgMembership row points
    to, if any (org-wide roles like top_leader/authorized_user have none)."""
    membership = db.execute(
        select(OrgMembership).where(
            OrgMembership.org_id == org_id,
            OrgMembership.user_id == member_id,
            OrgMembership.team_id.is_not(None),
        )
    ).scalars().first()
    return membership.team_id if membership else None
