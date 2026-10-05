"""file_index remembers files Knohow put in Drive's Trash

Revision ID: 0024_file_trashed
Revises: 0023_team_sharing_rule
Create Date: 2026-10-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0024_file_trashed"
down_revision = "0023_team_sharing_rule"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Set when a delete through Knohow trashes the file (ADR-0010); cleared on
    # restore. Settings' Trash lists rows set in the last 30 days.
    op.add_column("file_index", sa.Column("trashed_at", sa.DateTime(), nullable=True))
    op.add_column(
        "file_index",
        sa.Column("trashed_by", UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("file_index", "trashed_by")
    op.drop_column("file_index", "trashed_at")
