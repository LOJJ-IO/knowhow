import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk, value_enum


class UnresolvedOwnershipReason(str, enum.Enum):
    # Google does not permit Drive ownership transfer across the Workspace
    # domain boundary. This is the only reason this table exists for in the
    # auth/identity module; the org-engine module will add file-level detail
    # (sharing state, proposed recipient) on top of this record.
    PERSONAL_ACCOUNT_OWNER = "personal_account_owner"
    PERSONAL_ACCOUNT_RECIPIENT = "personal_account_recipient"


class UnresolvedOwnership(Base):
    """Explicit record of a file whose ownership could not be transferred
    because it involves a personal-account member on one end. Created by
    revoke_and_offboard() (and, later, the sharing engine's Auto-Own path) —
    never silently dropped. A human must act on rows in this table."""

    __tablename__ = "unresolved_ownerships"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    file_id: Mapped[str] = mapped_column(String(255), nullable=False)
    current_owner_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )
    intended_recipient_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )
    reason: Mapped[UnresolvedOwnershipReason] = mapped_column(
        value_enum(UnresolvedOwnershipReason, "unresolved_ownership_reason"), nullable=False
    )
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = created_at_col()
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)
