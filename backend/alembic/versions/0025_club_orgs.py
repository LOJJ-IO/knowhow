"""club orgs: an org kind, and the club account that can own its files

Revision ID: 0025_club_orgs
Revises: 0024_file_trashed
Create Date: 2026-10-14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0025_club_orgs"
down_revision = "0024_file_trashed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ADR-0034: "company" (one per observed domain) or "club" (no domain,
    # join by link only, any Google account).
    op.add_column(
        "organizations",
        sa.Column("kind", sa.String(16), nullable=False, server_default="company"),
    )
    # The club's general / admin account, when the club has connected one:
    # where file ownership goes (ADR-0034, option B). Null: members keep
    # their own files (option A).
    op.add_column(
        "organizations",
        sa.Column(
            "club_account_member_id",
            UUID(as_uuid=True),
            sa.ForeignKey("org_members.id", use_alter=True, name="fk_organizations_club_account"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "club_account_member_id")
    op.drop_column("organizations", "kind")
