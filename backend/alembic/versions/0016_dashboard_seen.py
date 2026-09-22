"""Per-member "last opened the dashboard" stamp.

The dashboard badges teams that changed **since you last opened it** (user
2026-09-22), which is per person rather than per device: signing in on a
laptop must not leave stale badges on a phone. So it lives on the member, not
in browser storage.

Revision ID: 0016_dashboard_seen
Revises: 0015_join_links
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_dashboard_seen"
down_revision: Union[str, None] = "0015_join_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: a member who has never opened the dashboard sees everything
    # since they joined, not nothing.
    op.add_column(
        "org_members",
        sa.Column("dashboard_seen_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("org_members", "dashboard_seen_at")
