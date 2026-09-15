import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class OAuthCredential(Base):
    """Per-member OAuth tokens. Used for two distinct purposes that share the
    same storage shape:
      - app login session refresh (every member, any auth_type)
      - personal Drive access (personal_oauth members only, set once they
        complete the individual consent flow — see app/auth/personal_oauth.py)
    `scopes` distinguishes which purpose a given row covers.

    Refresh tokens are the only long-lived secret Knohow stores; they are
    Fernet-encrypted at rest (see app/security/crypto.py) and never logged or
    returned from any API response.
    """

    __tablename__ = "oauth_credentials"

    id: Mapped[uuid.UUID] = uuid_pk()
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False, unique=True, index=True
    )

    encrypted_refresh_token: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    scopes: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    google_subject_id: Mapped[str] = mapped_column(String(255), nullable=False)

    consented_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    member: Mapped["OrgMember"] = relationship(back_populates="oauth_credential")
