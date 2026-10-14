import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk


ORG_KIND_COMPANY = "company"
ORG_KIND_CLUB = "club"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # The verified Google Workspace domain for this org (e.g. "acme.org").
    # Nullable until the onboarding admin flow confirms it — an org can exist
    # (e.g. mid-signup) before delegation is set up.
    verified_domain: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    # The Workspace domain Google reported (`hd` claim) for the account that
    # created this org — evidence, not authority (ADR-0006). At most one org
    # per observed domain; later signups with the same `hd` join it. Null for
    # a domainless org (created from a personal Google account).
    observed_domain: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    # Owner's opt-in: a later signup whose Google `hd` matches this org's
    # domain is approved on arrival instead of waiting for the owner.
    auto_accept_workspace_members: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Where the founder got to in setup, so signing in takes them back to the
    # step they stopped on instead of the landing page (user, 2026-09-21).
    # Null means setup hasn't started; "done" means it finished. Recorded
    # rather than inferred: "has an org chart" and "has teams" both go true
    # part-way through, which is how setup came to look finished when it
    # wasn't ([[0014-org-setup-and-join-link]]).
    setup_step: Mapped[str | None] = mapped_column(String(32), nullable=True)
    setup_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ADR-0034. "company": a Google Workspace org, one per observed domain.
    # "club": no domain at all (students share @ualberta.ca with the whole
    # university); joined only by its link, by any Google account, with no
    # Super Admin / delegation step.
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default=ORG_KIND_COMPANY)

    # A club's general / admin account, once connected: file ownership moves
    # to it where Google allows (ADR-0034 option B). Null = members keep their
    # own files (option A).
    club_account_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("org_members.id", use_alter=True, name="fk_organizations_club_account"),
        nullable=True,
    )

    created_at: Mapped[datetime] = created_at_col()

    @property
    def is_club(self) -> bool:
        return self.kind == ORG_KIND_CLUB

    members: Mapped[list["OrgMember"]] = relationship(
        back_populates="organization", foreign_keys="OrgMember.organization_id"
    )
    delegation_grant: Mapped["DelegationGrant | None"] = relationship(
        back_populates="organization", uselist=False
    )
