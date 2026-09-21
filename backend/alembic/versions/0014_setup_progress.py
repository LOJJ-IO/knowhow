"""organizations.setup_step / setup_completed_at: resume, don't restart

Setup completion was inferred from "does an org chart row exist", which goes
true after the first question — so the later setup screens became unreachable
and sign-in dropped the founder back on the landing page.

Revision ID: 0014_setup_progress
Revises: 0013_hidden_remembered_emails
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_setup_progress"
down_revision: Union[str, None] = "0013_hidden_remembered_emails"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("setup_step", sa.String(32), nullable=True))
    op.add_column(
        "organizations", sa.Column("setup_completed_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("organizations", "setup_completed_at")
    op.drop_column("organizations", "setup_step")
