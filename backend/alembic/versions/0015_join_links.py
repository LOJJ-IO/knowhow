"""join_links: the one link setup sends out

Not an invitation: multi-use, domain-locked, revocable, with a lifetime the
owner chooses when sending (ADR-0014).

Revision ID: 0015_join_links
Revises: 0014_setup_progress
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0015_join_links"
down_revision: Union[str, None] = "0014_setup_progress"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "join_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("created_by_member_id", UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_join_links_organization_id", "join_links", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_join_links_organization_id", table_name="join_links")
    op.drop_table("join_links")
