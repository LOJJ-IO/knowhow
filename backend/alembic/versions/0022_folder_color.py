"""knohow folders carry a colour

Revision ID: 0022_folder_color
Revises: 0021_merge_librarian_linked
Create Date: 2026-10-04
"""

from alembic import op
import sqlalchemy as sa

revision = "0022_folder_color"
down_revision = "0021_merge_librarian_linked"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # "#rrggbb"; null draws the default blue.
    op.add_column("knohow_folders", sa.Column("color", sa.String(7), nullable=True))


def downgrade() -> None:
    op.drop_column("knohow_folders", "color")
