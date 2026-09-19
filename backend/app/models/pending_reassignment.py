import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk, value_enum


class ReassignmentStatus(str, enum.Enum):
    PENDING_CONFIRMATION = "pending_confirmation"
    CONFIRMED = "confirmed"
    DECLINED = "declined"


class PendingReassignment(Base):
    """Team reassignment never moves files automatically. Moving a member
    from old_team_id to new_team_id creates one of these listing every file
    the move would affect; nothing about file sharing/ownership changes
    until the owner or the member explicitly confirms it (or declines it,
    leaving the files where they are)."""

    __tablename__ = "pending_reassignments"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False, index=True
    )
    old_team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True
    )
    new_team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    affected_file_ids: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    status: Mapped[ReassignmentStatus] = mapped_column(
        value_enum(ReassignmentStatus, "reassignment_status"),
        nullable=False,
        default=ReassignmentStatus.PENDING_CONFIRMATION,
    )

    created_at: Mapped[datetime] = created_at_col()
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)
