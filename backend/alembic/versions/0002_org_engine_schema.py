"""org-engine schema: org charts, teams, memberships, reassignments,
transfer batches, file index, suggested shares, activity idempotency

Revision ID: 0002_org_engine_schema
Revises: 0001_initial_schema
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_org_engine_schema"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enum(bind, name: str, values: list[str]) -> postgresql.ENUM:
    """Creates the Postgres enum type once (checkfirst), then returns a
    second ENUM instance with create_type=False for use inside
    create_table — see the note in 0001_initial_schema about the duplicate
    CREATE TYPE bug this avoids."""
    creator = postgresql.ENUM(*values, name=name)
    creator.create(bind, checkfirst=True)
    return postgresql.ENUM(*values, name=name, create_type=False)


def upgrade() -> None:
    bind = op.get_bind()

    op.create_table(
        "org_charts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False, unique=True
        ),
        sa.Column(
            "initiator_member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_members.id"),
            nullable=False,
        ),
        sa.Column(
            "owner_member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "owner_confirmation_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_chart_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_charts.id"), nullable=False
        ),
        sa.Column("owner_email", sa.String(length=320), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("token", name="uq_owner_confirmation_tokens_token"),
    )
    op.create_index("ix_owner_confirmation_tokens_org_chart_id", "owner_confirmation_tokens", ["org_chart_id"])

    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "team_leader_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=True
        ),
        sa.Column("parent_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("auto_own_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_teams_org_id", "teams", ["org_id"])

    org_role_enum = _enum(bind, "org_role", ["member", "team_leader", "top_leader", "authorized_user"])
    op.create_table(
        "org_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=False
        ),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("role", org_role_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_org_memberships_org_id", "org_memberships", ["org_id"])
    op.create_index("ix_org_memberships_user_id", "org_memberships", ["user_id"])
    op.create_index("ix_org_memberships_team_id", "org_memberships", ["team_id"])

    reassignment_status_enum = _enum(
        bind, "reassignment_status", ["pending_confirmation", "confirmed", "declined"]
    )
    op.create_table(
        "pending_reassignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column(
            "member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=False
        ),
        sa.Column("old_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("new_team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("affected_file_ids", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("status", reassignment_status_enum, nullable=False, server_default="pending_confirmation"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pending_reassignments_org_id", "pending_reassignments", ["org_id"])
    op.create_index("ix_pending_reassignments_member_id", "pending_reassignments", ["member_id"])

    batch_type_enum = _enum(bind, "transfer_batch_type", ["bulk", "single_file_auto_own"])
    batch_status_enum = _enum(bind, "transfer_batch_status", ["planned", "executed", "reversed"])
    op.create_table(
        "transfer_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column("batch_type", batch_type_enum, nullable=False),
        sa.Column("status", batch_status_enum, nullable=False, server_default="planned"),
        sa.Column(
            "created_by_member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_members.id"),
            nullable=True,
        ),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_transfer_batches_org_id", "transfer_batches", ["org_id"])

    eligibility_enum = _enum(bind, "transfer_eligibility", ["eligible", "ineligible_personal_account"])
    item_status_enum = _enum(
        bind, "transfer_item_status", ["pending", "transferred", "failed", "reversed", "skipped_ineligible"]
    )
    op.create_table(
        "transfer_batch_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("transfer_batches.id"), nullable=False
        ),
        sa.Column("file_id", sa.String(length=255), nullable=False),
        sa.Column(
            "current_owner_member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_members.id"),
            nullable=True,
        ),
        sa.Column(
            "proposed_owner_member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_members.id"),
            nullable=False,
        ),
        sa.Column("eligibility", eligibility_enum, nullable=False),
        sa.Column("status", item_status_enum, nullable=False, server_default="pending"),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_transfer_batch_items_batch_id", "transfer_batch_items", ["batch_id"])

    op.create_table(
        "file_index",
        sa.Column("file_id", sa.String(length=255), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column(
            "owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=True
        ),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("file_type", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=1024), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sharing_state", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_file_index_org_id", "file_index", ["org_id"])
    op.create_index("ix_file_index_owner_user_id", "file_index", ["owner_user_id"])
    op.create_index("ix_file_index_team_id", "file_index", ["team_id"])

    share_status_enum = _enum(bind, "suggested_share_status", ["pending", "confirmed", "declined"])
    op.create_table(
        "suggested_shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column("file_id", sa.String(length=255), sa.ForeignKey("file_index.file_id"), nullable=False),
        sa.Column(
            "creator_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=False
        ),
        sa.Column("proposed_recipients", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("status", share_status_enum, nullable=False, server_default="pending"),
        sa.Column("detected_via", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_suggested_shares_org_id", "suggested_shares", ["org_id"])

    op.create_table(
        "processed_activity_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column("event_key", sa.String(length=512), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("event_key", name="uq_processed_activity_events_event_key"),
    )
    op.create_index("ix_processed_activity_events_org_id", "processed_activity_events", ["org_id"])

    op.create_table(
        "watch_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column(
            "member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=False
        ),
        sa.Column("channel_id", sa.String(length=255), nullable=False),
        sa.Column("resource_id", sa.String(length=255), nullable=False),
        sa.Column("page_token", sa.String(length=255), nullable=False),
        sa.Column("webhook_token", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("channel_id", name="uq_watch_channels_channel_id"),
    )
    op.create_index("ix_watch_channels_org_id", "watch_channels", ["org_id"])
    op.create_index("ix_watch_channels_member_id", "watch_channels", ["member_id"])


def downgrade() -> None:
    op.drop_table("watch_channels")
    op.drop_table("processed_activity_events")
    op.drop_table("suggested_shares")
    op.execute("DROP TYPE IF EXISTS suggested_share_status")
    op.drop_table("file_index")
    op.drop_table("transfer_batch_items")
    op.execute("DROP TYPE IF EXISTS transfer_item_status")
    op.execute("DROP TYPE IF EXISTS transfer_eligibility")
    op.drop_table("transfer_batches")
    op.execute("DROP TYPE IF EXISTS transfer_batch_status")
    op.execute("DROP TYPE IF EXISTS transfer_batch_type")
    op.drop_table("pending_reassignments")
    op.execute("DROP TYPE IF EXISTS reassignment_status")
    op.drop_table("org_memberships")
    op.execute("DROP TYPE IF EXISTS org_role")
    op.drop_table("teams")
    op.drop_table("owner_confirmation_tokens")
    op.drop_table("org_charts")
