import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class OrgRole(str, enum.Enum):
    MEMBER = "member"
    TEAM_LEADER = "team_leader"
    TOP_LEADER = "top_leader"
    # High-ranking non-owner roles (secretaries, treasurers, ...) that need
    # elevated visibility without being top of the chart. Org-wide, not
    # team-scoped — see OrgMembership.team_id being nullable.
    AUTHORIZED_USER = "authorized_user"


class OrgMembership(Base):
    __tablename__ = "org_memberships"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False, index=True
    )
    # Null for org-wide roles (top_leader, authorized_user) that aren't tied
    # to one team. team_leader/member rows always carry a team_id.
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True, index=True
    )
    role: Mapped[OrgRole] = mapped_column(Enum(OrgRole, name="org_role"), nullable=False)

    created_at: Mapped[datetime] = created_at_col()

    team: Mapped["Team | None"] = relationship(back_populates="memberships")
