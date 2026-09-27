import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class LinkedDriveCredential(Base):
    """Drive consent for a personal Google address linked to a person
    (ADR-0025), so that person can see that account's files on their own
    Workspace screen.

    Keyed by person + address, not by membership: a linked personal address
    usually has no OrgMember at all (PersonEmail). It is read only for the
    person it belongs to, never indexed, and never shown to anyone else.
    Refresh tokens are Fernet-encrypted at rest, like OAuthCredential's.
    """

    __tablename__ = "linked_drive_credentials"

    id: Mapped[uuid.UUID] = uuid_pk()
    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("people.id"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    google_subject_id: Mapped[str] = mapped_column(String(255), nullable=False)
    encrypted_refresh_token: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    scopes: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    consented_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
