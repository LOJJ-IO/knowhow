import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class OwnerConfirmationToken(Base):
    """Single-use link sent to the designated owner's email when the person
    who initiated org chart creation is not themselves the owner (the "are
    you at the top of the org chart" question answered No). Consuming this
    token sets OrgChart.owner_member_id."""

    __tablename__ = "owner_confirmation_tokens"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_chart_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_charts.id"), nullable=False, index=True
    )
    owner_email: Mapped[str] = mapped_column(String(320), nullable=False)
    token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    created_at: Mapped[datetime] = created_at_col()
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(nullable=True)
