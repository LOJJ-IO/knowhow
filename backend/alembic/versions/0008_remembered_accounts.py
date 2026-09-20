"""remembered accounts: per-browser sign-in history for the account picker

Revision ID: 0008_remembered_accounts
Revises: 0007_open_admin_link
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0008_remembered_accounts"
down_revision: Union[str, None] = "0007_open_admin_link"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "remembered_accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("device_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "member_id",
            UUID(as_uuid=True),
            sa.ForeignKey("org_members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("device_id", "member_id", name="uq_remembered_device_member"),
    )
    op.create_index("ix_remembered_accounts_device_id", "remembered_accounts", ["device_id"])
    op.create_index("ix_remembered_accounts_member_id", "remembered_accounts", ["member_id"])


def downgrade() -> None:
    op.drop_index("ix_remembered_accounts_member_id", table_name="remembered_accounts")
    op.drop_index("ix_remembered_accounts_device_id", table_name="remembered_accounts")
    op.drop_table("remembered_accounts")
