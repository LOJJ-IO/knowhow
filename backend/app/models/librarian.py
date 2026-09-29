import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import created_at_col, uuid_pk, value_enum


class LibrarianSuggestion(str, enum.Enum):
    COMPANY = "company"
    PERSONAL = "personal"
    UNSURE = "unsure"


class LibrarianStatus(str, enum.Enum):
    # Waiting for the file's owner to say Company or Personal.
    SUGGESTED = "suggested"
    # Owner said Company; waiting for a lead / owner / Super Admin to confirm.
    PROPOSED = "proposed"
    # Confirmer declined it. Kept so a rescan doesn't ask the owner again.
    DECLINED = "declined"


class LibrarianCandidate(Base):
    """One Drive file the librarian has an opinion about (ADR-0022,
    FEAT-drive-file-classification constraint 7).

    **Never stores the title, path or any other name.** Only the Drive file
    id, the rules' suggestion and structured reason codes. Titles are fetched
    live from Google when someone opens a review screen. A file its owner
    marks Personal has its row deleted outright; a confirmed file leaves this
    table for `FileIndex`."""

    __tablename__ = "librarian_candidates"
    __table_args__ = (UniqueConstraint("org_id", "file_id", name="uq_librarian_candidate_file"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    # The member whose Drive the file sits in (its Google owner).
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False, index=True
    )
    file_id: Mapped[str] = mapped_column(String(255), nullable=False)
    suggestion: Mapped[LibrarianSuggestion] = mapped_column(
        value_enum(LibrarianSuggestion, "librarian_suggestion"), nullable=False
    )
    # Structured codes and counts only, e.g. {"coworkers_shared": 3}. Never
    # free text: a reason quoting a filename would retain the filename.
    reasons: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[LibrarianStatus] = mapped_column(
        value_enum(LibrarianStatus, "librarian_status"), nullable=False, default=LibrarianStatus.SUGGESTED
    )
    proposed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = created_at_col()


class KnohowFolder(Base):
    """A Knohow-only grouping of company files (ADR-0022). Drive is never
    reorganised: a file can sit in a folder here and anywhere in Drive."""

    __tablename__ = "knohow_folders"

    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    # Set for a team's own folder (one per team); null for a custom folder.
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True, unique=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )
    created_at: Mapped[datetime] = created_at_col()


class FolderFile(Base):
    __tablename__ = "knohow_folder_files"
    __table_args__ = (UniqueConstraint("folder_id", "file_id", name="uq_folder_file"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    folder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knohow_folders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("file_index.file_id", ondelete="CASCADE"), nullable=False, index=True
    )
    added_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=True
    )
    created_at: Mapped[datetime] = created_at_col()


class LibrarianPersonalMark(Base):
    """Remembers that a member marked a file Personal, so a rescan doesn't
    ask again, **without retaining anything about the file**: `file_hash` is
    an HMAC of the Drive id under the server's signing key, so it cannot be
    reversed to the id, let alone to a name (FEAT-drive-file-classification
    constraint 3: a Personal file keeps nothing)."""

    __tablename__ = "librarian_personal_marks"
    __table_args__ = (UniqueConstraint("member_id", "file_hash", name="uq_librarian_personal_mark"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_members.id"), nullable=False, index=True
    )
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = created_at_col()
