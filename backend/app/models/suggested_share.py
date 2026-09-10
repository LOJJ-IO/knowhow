import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class SuggestedShareStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DECLINED = "declined"


class SuggestedShare(Base):
    """Files created outside Knohow's own create flow are never auto-shared
    — instead one of these is written, surfaced to the creator as a
    confirm/decline prompt.

    `detected_via` records which detection source created this row
    (e.g. "reports_feed", "drive_activity_api", "watch_channel",
    "reconciliation_sweep") without the sharing-engine logic here ever
    branching on it — see app/activity/detection.py for why that source is
    kept swappable rather than hardcoded to one feed.
    """

    __tablename__ = "suggested_shares"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    file_id: Mapped[str] = mapped_column(String(255), ForeignKey("file_index.file_id"), nullable=False)
    creator_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False
    )
    proposed_recipients: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    status: Mapped[SuggestedShareStatus] = mapped_column(
        Enum(SuggestedShareStatus, name="suggested_share_status"),
        nullable=False,
        default=SuggestedShareStatus.PENDING,
    )
    detected_via: Mapped[str] = mapped_column(String(64), nullable=False)

    created_at: Mapped[datetime] = created_at_col()
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)
