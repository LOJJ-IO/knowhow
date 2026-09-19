import uuid
from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk


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

    created_at: Mapped[datetime] = created_at_col()

    members: Mapped[list["OrgMember"]] = relationship(back_populates="organization")
    delegation_grant: Mapped["DelegationGrant | None"] = relationship(
        back_populates="organization", uselist=False
    )
