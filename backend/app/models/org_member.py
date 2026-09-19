import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk, value_enum


class AuthType(str, enum.Enum):
    """The two member categories this module exists to distinguish. Every
    function that touches Drive access must branch on this, not infer it from
    the email domain ad hoc — see get_drive_client_for_user."""

    DOMAIN_DELEGATED = "domain_delegated"
    PERSONAL_OAUTH = "personal_oauth"


class MemberStanding(str, enum.Enum):
    """Whether anyone with authority has accepted this member (onboarding
    spec, "Sponsorship and member standing"). An auto-affiliated member was
    placed in the org by evidence alone (a matching Google `hd`); they may
    use their own data but see nothing of other members until the owner (or,
    later, a proven Super Admin) approves them."""

    APPROVED = "approved"
    AUTO_AFFILIATED = "auto_affiliated"


class OrgMember(Base):
    __tablename__ = "org_members"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    auth_type: Mapped[AuthType] = mapped_column(value_enum(AuthType, "auth_type"), nullable=False)
    standing: Mapped[MemberStanding] = mapped_column(
        value_enum(MemberStanding, "member_standing"), nullable=False, default=MemberStanding.APPROVED
    )

    created_at: Mapped[datetime] = created_at_col()

    organization: Mapped["Organization"] = relationship(back_populates="members")
    oauth_credential: Mapped["OAuthCredential | None"] = relationship(
        back_populates="member", uselist=False
    )
