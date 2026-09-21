import uuid
from datetime import datetime

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class HiddenRememberedEmail(Base):
    """A linked personal address this browser has been told to stop showing in
    the Log In picker.

    A linked address has no account row of its own: it belongs to the person
    and rides along on their organization rows as a `Personal (n)` chip. So
    "remove that one from the sign-in screen" cannot be a deletion of a row,
    and it must not become an unlink either — unlinking is an identity change
    that would follow the person to every browser they use. It is recorded
    here instead: **device-scoped, exactly like the accounts it sits beside**
    ([[0011-device-remembered-accounts]]), reversible, and it changes nothing
    about the person, their accounts or what they can reach.
    """

    __tablename__ = "hidden_remembered_emails"
    __table_args__ = (UniqueConstraint("device_id", "email", name="uq_hidden_email_device_email"),)

    id: Mapped[uuid.UUID] = uuid_pk()

    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    # The address as PersonEmail stores it.
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)

    created_at: Mapped[datetime] = created_at_col()
