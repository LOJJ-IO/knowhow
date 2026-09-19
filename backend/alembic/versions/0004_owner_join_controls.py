"""owner join controls: organizations.auto_accept_workspace_members, org_charts.nominated_super_admin_email

Revision ID: 0004_owner_join_controls
Revises: 0003_domain_check
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_owner_join_controls"
down_revision: Union[str, None] = "0003_domain_check"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("auto_accept_workspace_members", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("org_charts", sa.Column("nominated_super_admin_email", sa.String(length=320), nullable=True))


def downgrade() -> None:
    op.drop_column("org_charts", "nominated_super_admin_email")
    op.drop_column("organizations", "auto_accept_workspace_members")
