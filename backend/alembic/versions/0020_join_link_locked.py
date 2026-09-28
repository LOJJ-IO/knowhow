"""join links can be locked and unlocked without being replaced

Revision ID: 0020_join_link_locked
Revises: 0019_linked_drive_credentials
Create Date: 2026-09-27
"""

from alembic import op
import sqlalchemy as sa

revision = "0020_join_link_locked"
down_revision = "0019_linked_drive_credentials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("join_links", sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("join_links", "locked_at")
