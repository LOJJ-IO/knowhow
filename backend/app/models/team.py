import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
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

    # The team's sharing rule, customisable on Sharing (Ronald, 2026-10-04).
    # A new file goes to everyone on the team minus `excluded`, plus the
    # extra people and everyone on the extra teams, plus top leaders when
    # `share_top_leaders`; at `share_role` (writer / commenter / reader).
    # Member/team ids are stored as strings.
    share_top_leaders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    share_extra_member_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    share_extra_team_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    share_excluded_member_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    share_role: Mapped[str] = mapped_column(String(16), nullable=False, default="writer")
    # Who owns the team's files instead of its lead; null = the lead.
    owner_override_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )

    created_at: Mapped[datetime] = created_at_col()

    memberships: Mapped[list["OrgMembership"]] = relationship(back_populates="team")
