import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk, value_enum


class InvitationKind(str, enum.Enum):
    OWNER = "owner"
    SUPER_ADMIN = "super_admin"


class Invitation(Base):
    """A nomination someone else has to act on — the owner, or the Workspace
    Super Admin. The token makes a forwardable link (`FRONTEND_ORIGIN/?invite=`)
    so a nomination never dead-ends while Knohow sends no email. The link
    only pre-selects the Google account: nothing is granted until someone
    signs in *as* `email` (and, for a Super Admin, passes admin proof)."""

    __tablename__ = "invitations"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    kind: Mapped[InvitationKind] = mapped_column(value_enum(InvitationKind, "invitation_kind"), nullable=False)
    # Null for an open Super Admin link — one to paste in a team chat when
    # nobody knows who the Super Admin is. Safe without an email because
    # admin proof, not the link, decides: whoever opens it and passes is
    # the Super Admin; anyone else just joins as an ordinary member.
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    created_by_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )

    created_at: Mapped[datetime] = created_at_col()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
