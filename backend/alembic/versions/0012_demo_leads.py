"""demo_leads: Book a Demo partial progress + abandoned-recovery Resend

Revision ID: 0012_demo_leads
Revises: 0011_person_emails
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0012_demo_leads"
down_revision: Union[str, None] = "0011_person_emails"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "demo_leads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("first_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("last_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("website", sa.String(512), nullable=True),
        sa.Column("segment", sa.String(64), nullable=True),
        sa.Column("other_text", sa.Text(), nullable=True),
        sa.Column("team_size", sa.String(32), nullable=True),
        sa.Column("step", sa.String(32), nullable=False, server_default="email"),
        sa.Column("resume_token", sa.String(64), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recovery_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("booked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_demo_leads_email", "demo_leads", ["email"], unique=True)
    op.create_index("ix_demo_leads_resume_token", "demo_leads", ["resume_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_demo_leads_resume_token", table_name="demo_leads")
    op.drop_index("ix_demo_leads_email", table_name="demo_leads")
    op.drop_table("demo_leads")
