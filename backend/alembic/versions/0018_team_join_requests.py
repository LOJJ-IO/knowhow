"""team join requests + pending owner claim on org chart

Revision ID: 0018_team_join_requests
Revises: 0017_unconfirmed_files_unindexed
Create Date: 2026-09-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0018_team_join_requests"
down_revision = "0017_unconfirmed_files_unindexed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "org_charts",
        sa.Column(
            "pending_owner_member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_members.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "org_members",
        sa.Column("join_placement_completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    status_enum = postgresql.ENUM(
        "pending", "approved", "rejected", name="team_join_request_status"
    )
    status_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "team_join_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_members.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending",
                "approved",
                "rejected",
                name="team_join_request_status",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("team_id", "member_id", name="uq_team_join_request_member"),
    )


def downgrade() -> None:
    op.drop_table("team_join_requests")
    postgresql.ENUM(name="team_join_request_status").drop(op.get_bind(), checkfirst=True)
    op.drop_column("org_members", "join_placement_completed_at")
    op.drop_column("org_charts", "pending_owner_member_id")
