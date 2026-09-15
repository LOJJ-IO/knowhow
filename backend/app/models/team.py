import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    team_leader_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )
    parent_team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True
    )

    # Standing Auto-Own rule: when true, a domain member's newly created file
    # is transferred to this team's ownership target immediately on
    # creation (a batch-of-one TransferBatch, still individually reversible
    # — see app/transfers/service.py::auto_own_single_file). When false,
    # Auto-Own queues into the normal dry-run TransferBatch flow instead.
    # Defaults on, matching the product's baseline promise that ownership is
    # assigned the moment a file is created; an owner can turn it off per
    # team via the org chart edit endpoints.
    auto_own_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = created_at_col()

    memberships: Mapped[list["OrgMembership"]] = relationship(back_populates="team")
