import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class DemoLead(Base):
    """Partial Book a Demo progress. Created once a valid work email exists;
    drives the 20‑minute abandoned-recovery Resend email. Not an org member."""

    __tablename__ = "demo_leads"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    website: Mapped[str | None] = mapped_column(String(512), nullable=True)
    segment: Mapped[str | None] = mapped_column(String(64), nullable=True)
    other_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    team_size: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # names | email | website | segment | size | booking
    step: Mapped[str] = mapped_column(String(32), nullable=False, default="email")
    resume_token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)

    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recovery_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set when they book, reopen Book a Demo, or click the email CTA — suppresses send.
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    booked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
