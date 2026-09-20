"""a person may belong to several organizations

Revision ID: 0010_many_orgs_per_person
Revises: 0009_identity_linking
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_many_orgs_per_person"
down_revision: Union[str, None] = "0009_identity_linking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reverses 0009's "one Workspace account per person": the picker now lists
    # one row per organization, and a person may hold two companies
    # (user, 2026-09-20).
    op.drop_index("uq_person_one_org_account", table_name="org_members")


def downgrade() -> None:
    op.create_index(
        "uq_person_one_org_account",
        "org_members",
        ["person_id"],
        unique=True,
        postgresql_where=sa.text("auth_type = 'domain_delegated' AND person_id IS NOT NULL"),
    )
