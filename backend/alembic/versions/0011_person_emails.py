"""person_emails: verified addresses with no membership, kept for identity

Revision ID: 0011_person_emails
Revises: 0010_many_orgs_per_person
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0011_person_emails"
down_revision: Union[str, None] = "0010_many_orgs_per_person"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "person_emails",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "person_id",
            UUID(as_uuid=True),
            sa.ForeignKey("people.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_person_emails_email"),
    )
    op.create_index("ix_person_emails_person_id", "person_emails", ["person_id"])


def downgrade() -> None:
    op.drop_index("ix_person_emails_person_id", table_name="person_emails")
    op.drop_table("person_emails")
