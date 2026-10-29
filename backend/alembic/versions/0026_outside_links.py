"""outside links: a team's link for people outside the organization

Revision ID: 0026_outside_links
Revises: 0025_club_orgs
Create Date: 2026-10-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0026_outside_links"
down_revision = "0025_club_orgs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ADR-0035: one live outside link per team, any Google account.
    op.create_table(
        "team_outside_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("created_by_member_id", UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_team_outside_links_organization_id", "team_outside_links", ["organization_id"])
    op.create_index("ix_team_outside_links_team_id", "team_outside_links", ["team_id"])

    # Asking the lead first is the default (user, 2026-10-16).
    op.add_column(
        "teams",
        sa.Column("outside_ask_first", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.add_column("org_members", sa.Column("joined_from_outside_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("org_members", sa.Column("outside_reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("org_members", sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("org_members", "removed_at")
    op.drop_column("org_members", "outside_reviewed_at")
    op.drop_column("org_members", "joined_from_outside_at")
    op.drop_column("teams", "outside_ask_first")
    op.drop_index("ix_team_outside_links_team_id", table_name="team_outside_links")
    op.drop_index("ix_team_outside_links_organization_id", table_name="team_outside_links")
    op.drop_table("team_outside_links")
