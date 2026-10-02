"""drive consent for linked personal accounts (ADR-0025)

Revision ID: 0019_linked_drive_credentials
Revises: 0018_team_join_requests
Create Date: 2026-09-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0019_linked_drive_credentials"
down_revision = "0018_team_join_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "linked_drive_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("person_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("people.id"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("google_subject_id", sa.String(255), nullable=False),
        sa.Column("encrypted_refresh_token", sa.LargeBinary(), nullable=False),
        sa.Column("scopes", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_linked_drive_credentials_person_id", "linked_drive_credentials", ["person_id"])


def downgrade() -> None:
    op.drop_index("ix_linked_drive_credentials_person_id", table_name="linked_drive_credentials")
    op.drop_table("linked_drive_credentials")
