"""identity linking: a Person groups the Google accounts one human signs in with

Revision ID: 0009_identity_linking
Revises: 0008_remembered_accounts
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0009_identity_linking"
down_revision: Union[str, None] = "0008_remembered_accounts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "people",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.add_column("org_members", sa.Column("person_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "org_members_person_id_fkey", "org_members", "people", ["person_id"], ["id"]
    )
    op.create_index("ix_org_members_person_id", "org_members", ["person_id"])
    # "One org account, many personal" (user, 2026-09-20): a person may hold
    # at most one domain-delegated (Workspace) account.
    op.create_index(
        "uq_person_one_org_account",
        "org_members",
        ["person_id"],
        unique=True,
        postgresql_where=sa.text("auth_type = 'domain_delegated' AND person_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_person_one_org_account", table_name="org_members")
    op.drop_index("ix_org_members_person_id", table_name="org_members")
    op.drop_constraint("org_members_person_id_fkey", "org_members", type_="foreignkey")
    op.drop_column("org_members", "person_id")
    op.drop_table("people")
