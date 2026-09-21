"""hidden_remembered_emails: hide one linked personal address in the picker

A linked address has no row of its own, so "remove it from the sign-in
screen" is recorded per device rather than by deleting anything or unlinking.

Revision ID: 0013_hidden_remembered_emails
Revises: 0012_demo_leads
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0013_hidden_remembered_emails"
down_revision: Union[str, None] = "0012_demo_leads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "hidden_remembered_emails",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("device_id", UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("device_id", "email", name="uq_hidden_email_device_email"),
    )
    op.create_index("ix_hidden_remembered_emails_device_id", "hidden_remembered_emails", ["device_id"])
    op.create_index("ix_hidden_remembered_emails_email", "hidden_remembered_emails", ["email"])


def downgrade() -> None:
    op.drop_index("ix_hidden_remembered_emails_email", table_name="hidden_remembered_emails")
    op.drop_index("ix_hidden_remembered_emails_device_id", table_name="hidden_remembered_emails")
    op.drop_table("hidden_remembered_emails")
