import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class RememberedAccount(Base):
    """One account this browser has signed in with, so the Log In screen can
    offer it again ("Which account today?").

    Scoped to a *device* — an opaque id in a long-lived cookie — never to a
    person: Knohow cannot tell that two Google accounts are the same human
    (identity linking is unbuilt), so this is only ever "accounts seen on
    this browser". It grants nothing. Choosing a row still starts a full
    Google sign-in; the row only pre-selects the account.
    """

    __tablename__ = "remembered_accounts"
    __table_args__ = (UniqueConstraint("device_id", "member_id", name="uq_remembered_device_member"),)

    id: Mapped[uuid.UUID] = uuid_pk()

    # Opaque per-browser id from the `knohow_device` cookie. Not a user id
    # and not tied to one — a shared computer has one device id and several
    # remembered accounts, which is what "Remove accounts" is for.
    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Most recent sign-in on this browser, so the list can lead with it.
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    created_at: Mapped[datetime] = created_at_col()

    member: Mapped["OrgMember"] = relationship()
