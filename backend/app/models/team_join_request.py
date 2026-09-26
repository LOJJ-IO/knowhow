import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk, value_enum


class TeamJoinRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TeamJoinRequest(Base):
    """Joiner asked to join a team that already has a lead (ADR-0021)."""

    __tablename__ = "team_join_requests"
    __table_args__ = (UniqueConstraint("team_id", "member_id", name="uq_team_join_request_member"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False, index=True
    )
    status: Mapped[TeamJoinRequestStatus] = mapped_column(
        value_enum(TeamJoinRequestStatus, "team_join_request_status"),
        nullable=False,
        default=TeamJoinRequestStatus.PENDING,
    )
    created_at: Mapped[datetime] = created_at_col()
