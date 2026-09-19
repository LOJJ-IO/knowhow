import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk, value_enum


class DelegationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REVOKED = "revoked"


class DelegationGrant(Base):
    """One row per organization, tracking the state of the Workspace
    super-admin's domain-wide delegation authorization for Knohow's service
    account. This is the gate that impersonation checks before it is allowed to
    act as any user in the organization's domain."""

    __tablename__ = "delegation_grants"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True, index=True
    )

    status: Mapped[DelegationStatus] = mapped_column(
        value_enum(DelegationStatus, "delegation_status"), nullable=False, default=DelegationStatus.PENDING
    )

    # The verified domain this grant authorizes impersonation for. Duplicated
    # from Organization.verified_domain at approval time so a later change to
    # the org's domain doesn't silently widen an existing grant's scope.
    verified_domain: Mapped[str] = mapped_column(String(255), nullable=False)

    # Identity of the Workspace super-admin who approved delegation in the
    # Admin console (their email — the actual grant happens in Google's UI,
    # this just records who told us they did it and when).
    approving_admin_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True)

    granted_scopes: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    created_at: Mapped[datetime] = created_at_col()

    organization: Mapped["Organization"] = relationship(back_populates="delegation_grant")
