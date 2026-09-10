import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class ProcessedActivityEvent(Base):
    """Idempotency ledger for activity detection. Google redelivers
    notifications (both the Reports/Drive Activity feeds and push
    notification channels can repeat an event), so every handler checks
    this table for event_key before acting, and inserts into it as part of
    the same handling transaction — see app/activity/detection.py. Not a
    cache: correctness depends on this being durable and unique-constrained,
    not just a check to skip when convenient.
    """

    __tablename__ = "processed_activity_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    # Stable identifier for the event/resource, e.g. "<fileId>:<activity
    # timestamp/eventId>" for a Reports/Activity API event, or
    # "<channelId>:<resourceState>:<X-Goog-Message-Number>" for a push
    # notification. Whatever the source, it must be reconstructible
    # identically on redelivery.
    event_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False)

    processed_at: Mapped[datetime] = created_at_col()


class WatchChannel(Base):
    """A personal-account member's Drive push notification channel.
    Domain members are covered by the org-wide Reports/Drive Activity feed
    and never get one of these — see app/activity/detection.py section
    docstring for why per-user watch channels are deliberately not the
    default path.
    """

    __tablename__ = "watch_channels"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False, index=True
    )
    channel_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    resource_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Drive's changes.watch push notification carries no payload — only a
    # signal that "something changed." Finding out what requires a
    # changes.list call using a stored page token, advanced after each
    # webhook delivery. See app/api/routes/webhooks.py.
    page_token: Mapped[str] = mapped_column(String(255), nullable=False)

    # Random per-channel secret, echoed back by Google as the
    # X-Goog-Channel-Token header on every delivery — verified in
    # app/api/routes/webhooks.py so an arbitrary POST to the (public)
    # webhook URL can't be treated as a legitimate Drive notification.
    webhook_token: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = created_at_col()
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
