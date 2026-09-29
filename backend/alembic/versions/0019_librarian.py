"""librarian candidates + Knohow folders (ADR-0022)

Revision ID: 0019_librarian
Revises: 0018_team_join_requests
Create Date: 2026-09-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0019_librarian"
down_revision = "0018_team_join_requests"
branch_labels = None
depends_on = None


def _uuid_fk(name: str, target: str, nullable: bool = False, **kw) -> sa.Column:
    return sa.Column(name, postgresql.UUID(as_uuid=True), sa.ForeignKey(target, **kw), nullable=nullable)


def upgrade() -> None:
    suggestion = postgresql.ENUM("company", "personal", "unsure", name="librarian_suggestion")
    status = postgresql.ENUM("suggested", "proposed", "declined", name="librarian_status")
    suggestion.create(op.get_bind(), checkfirst=True)
    status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "librarian_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _uuid_fk("org_id", "organizations.id"),
        _uuid_fk("member_id", "org_members.id"),
        sa.Column("file_id", sa.String(255), nullable=False),
        sa.Column(
            "suggestion",
            postgresql.ENUM(name="librarian_suggestion", create_type=False),
            nullable=False,
        ),
        sa.Column("reasons", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "status",
            postgresql.ENUM(name="librarian_status", create_type=False),
            nullable=False,
            server_default="suggested",
        ),
        sa.Column("proposed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("org_id", "file_id", name="uq_librarian_candidate_file"),
    )
    op.create_index("ix_librarian_candidates_org_id", "librarian_candidates", ["org_id"])
    op.create_index("ix_librarian_candidates_member_id", "librarian_candidates", ["member_id"])

    op.create_table(
        "knohow_folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _uuid_fk("org_id", "organizations.id"),
        _uuid_fk("team_id", "teams.id", nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        _uuid_fk("created_by", "org_members.id", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("team_id", name="uq_knohow_folder_team"),
    )
    op.create_index("ix_knohow_folders_org_id", "knohow_folders", ["org_id"])

    op.create_table(
        "knohow_folder_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _uuid_fk("folder_id", "knohow_folders.id", ondelete="CASCADE"),
        sa.Column(
            "file_id",
            sa.String(255),
            sa.ForeignKey("file_index.file_id", ondelete="CASCADE"),
            nullable=False,
        ),
        _uuid_fk("added_by", "org_members.id", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("folder_id", "file_id", name="uq_folder_file"),
    )
    op.create_index("ix_knohow_folder_files_folder_id", "knohow_folder_files", ["folder_id"])
    op.create_index("ix_knohow_folder_files_file_id", "knohow_folder_files", ["file_id"])

    op.create_table(
        "librarian_personal_marks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _uuid_fk("member_id", "org_members.id"),
        sa.Column("file_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("member_id", "file_hash", name="uq_librarian_personal_mark"),
    )
    op.create_index("ix_librarian_personal_marks_member_id", "librarian_personal_marks", ["member_id"])


def downgrade() -> None:
    op.drop_table("librarian_personal_marks")
    op.drop_table("knohow_folder_files")
    op.drop_table("knohow_folders")
    op.drop_table("librarian_candidates")
    op.execute("DROP TYPE IF EXISTS librarian_status")
    op.execute("DROP TYPE IF EXISTS librarian_suggestion")
