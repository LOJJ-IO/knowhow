import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class OrgChart(Base):
    """One per organization (current assumption: one Workspace domain = one
    org chart). Created by the onboarding flow the first time anyone logs in
    for a new organization — the initiator is auto-approved as having
    created it, which is a separate fact from whether they are the
    organizational owner (see app/onboarding/service.py)."""

    __tablename__ = "org_charts"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True
    )
    initiator_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False
    )
    # Set once the designated owner (who may not be the initiator) confirms
    # via the single-use link sent to their email. Null until then.
    owner_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )
    # Who the initiator named as the Workspace Super Admin, when it isn't
    # them. A nomination only — Super Admin authority comes from admin proof
    # (a Google admin-only call), never from this field.
    nominated_super_admin_email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    created_at: Mapped[datetime] = created_at_col()
