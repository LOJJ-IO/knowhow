import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class JoinLink(Base):
    """The one link setup sends out, so everyone else can join the org.

    Deliberately **not** an `Invitation`: a nomination names one person and is
    consumed by them, while this is used by the whole company and stays live
    until it expires or the owner kills it ([[0014-org-setup-and-join-link]]).

    It grants nothing on its own. It is locked to the org's Google domain, and
    what it opens is a *request* to join a team, which the owner or an admin
    still has to approve.
    """

    __tablename__ = "join_links"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    created_by_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )

    # Null means no end date — the owner's explicit choice, not a default.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set when the owner kills the link. People who already joined stay in.
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = created_at_col()
