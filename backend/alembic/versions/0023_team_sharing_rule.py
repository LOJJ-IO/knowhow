"""teams carry a customisable sharing rule

Revision ID: 0023_team_sharing_rule
Revises: 0022_folder_color
Create Date: 2026-10-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0023_team_sharing_rule"
down_revision = "0022_folder_color"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("share_top_leaders", sa.Boolean(), nullable=False, server_default=sa.true()))
    for name in ("share_extra_member_ids", "share_extra_team_ids", "share_excluded_member_ids"):
        op.add_column(
            "teams", sa.Column(name, postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb"))
        )
    op.add_column("teams", sa.Column("share_role", sa.String(16), nullable=False, server_default="writer"))
    op.add_column(
        "teams",
        sa.Column("owner_override_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=True),
    )


def downgrade() -> None:
    for name in (
        "owner_override_id",
        "share_role",
        "share_excluded_member_ids",
        "share_extra_team_ids",
        "share_extra_member_ids",
        "share_top_leaders",
    ):
        op.drop_column("teams", name)
