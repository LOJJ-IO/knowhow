import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class AuditLogEntry(Base):
    """Append-only, hash-chained audit trail. entry_hash covers prev_hash plus
    every content field, so any row edited or deleted after the fact breaks the
    chain at that point — detectable by verify_audit_chain(). See
    app/audit/service.py for the writer and verifier; nothing outside that
    module should INSERT into this table directly, since the hash must be
    computed over the exact same canonical serialization used to verify it.
    """

    __tablename__ = "audit_log_entries"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )
    action_type: Mapped[str] = mapped_column(String(128), nullable=False)
    target_resource_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = created_at_col()

    # Chain fields. prev_hash of the first entry in an org's chain is "0" * 64.
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    entry_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    # Monotonic per-org sequence number, assigned at write time under a
    # row lock on the org's latest entry. Lets verify_audit_chain() walk the
    # chain in order without relying on created_at (which is not guaranteed
    # monotonic under concurrent writers / clock skew).
    sequence: Mapped[int] = mapped_column(nullable=False)
