import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class FileIndex(Base):
    """Metadata only — file_id, ownership, team, type, timestamps, sharing
    state. NEVER document text or file contents: Knohow's security posture
    is that document contents stay in the client's Drive, and this table
    must not contradict that. DeepSearch (app/search/deepsearch.py) does not
    read from this table for content matching — it queries Drive live and
    persists nothing from result bodies; this table only serves metadata
    filtering/dashboards (GET /files). See ADR context in that module."""

    __tablename__ = "file_index"

    file_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True, index=True
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True, index=True
    )
    file_type: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(1024), nullable=False)

    created_at: Mapped[datetime] = mapped_column(nullable=False)
    modified_at: Mapped[datetime] = mapped_column(nullable=False)

    # Permission snapshot: who the file is currently shared with and how
    # (roles, "Personal" designation, etc.) — not Drive's full permission
    # object, just what the sharing engine and dashboards need to render.
    sharing_state: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    last_synced_at: Mapped[datetime] = mapped_column(nullable=False)
