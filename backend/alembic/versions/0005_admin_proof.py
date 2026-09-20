"""admin proof: org_members.super_admin_verified_at

Revision ID: 0005_admin_proof
Revises: 0004_owner_join_controls
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_admin_proof"
down_revision: Union[str, None] = "0004_owner_join_controls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("org_members", sa.Column("super_admin_verified_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("org_members", "super_admin_verified_at")
