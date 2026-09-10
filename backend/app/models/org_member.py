import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class AuthType(str, enum.Enum):
    """The two member categories this module exists to distinguish. Every
    function that touches Drive access must branch on this, not infer it from
    the email domain ad hoc — see get_drive_client_for_user."""

    DOMAIN_DELEGATED = "domain_delegated"
    PERSONAL_OAUTH = "personal_oauth"


class OrgMember(Base):
    __tablename__ = "org_members"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    auth_type: Mapped[AuthType] = mapped_column(Enum(AuthType, name="auth_type"), nullable=False)

    created_at: Mapped[datetime] = created_at_col()

    organization: Mapped["Organization"] = relationship(back_populates="members")
    oauth_credential: Mapped["OAuthCredential | None"] = relationship(
        back_populates="member", uselist=False
    )
