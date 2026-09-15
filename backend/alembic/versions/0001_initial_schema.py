"""initial schema: organizations, org_members, delegation_grants,
oauth_credentials, audit_log_entries, unresolved_ownerships

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("verified_domain", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("verified_domain", name="uq_organizations_verified_domain"),
    )

    # create_type=False on the column-level ENUM below: the type is created
    # explicitly here (once), so table creation must not also try to create
    # it — SQLAlchemy would otherwise emit a second CREATE TYPE for it.
    auth_type_enum = postgresql.ENUM("domain_delegated", "personal_oauth", name="auth_type")
    auth_type_enum.create(op.get_bind(), checkfirst=True)
    auth_type_enum = postgresql.ENUM(
        "domain_delegated", "personal_oauth", name="auth_type", create_type=False
    )
    op.create_table(
        "org_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("auth_type", auth_type_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_org_members_organization_id", "org_members", ["organization_id"])
    op.create_index("ix_org_members_email", "org_members", ["email"])

    delegation_status_enum = postgresql.ENUM("pending", "approved", "revoked", name="delegation_status")
    delegation_status_enum.create(op.get_bind(), checkfirst=True)
    delegation_status_enum = postgresql.ENUM(
        "pending", "approved", "revoked", name="delegation_status", create_type=False
    )
    op.create_table(
        "delegation_grants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("status", delegation_status_enum, nullable=False, server_default="pending"),
        sa.Column("verified_domain", sa.String(length=255), nullable=False),
        sa.Column("approving_admin_email", sa.String(length=320), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "granted_scopes",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_delegation_grants_organization_id", "delegation_grants", ["organization_id"])

    op.create_table(
        "oauth_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_members.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("encrypted_refresh_token", sa.LargeBinary(), nullable=False),
        sa.Column("scopes", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("google_subject_id", sa.String(length=255), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_oauth_credentials_member_id", "oauth_credentials", ["member_id"])

    op.create_table(
        "audit_log_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column(
            "actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=True
        ),
        sa.Column("action_type", sa.String(length=128), nullable=False),
        sa.Column("target_resource_id", sa.String(length=512), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("prev_hash", sa.String(length=64), nullable=False),
        sa.Column("entry_hash", sa.String(length=64), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.UniqueConstraint("entry_hash", name="uq_audit_log_entries_entry_hash"),
        sa.UniqueConstraint("org_id", "sequence", name="uq_audit_log_entries_org_sequence"),
    )
    op.create_index("ix_audit_log_entries_org_id", "audit_log_entries", ["org_id"])

    reason_enum = postgresql.ENUM(
        "personal_account_owner", "personal_account_recipient", name="unresolved_ownership_reason"
    )
    reason_enum.create(op.get_bind(), checkfirst=True)
    reason_enum = postgresql.ENUM(
        "personal_account_owner",
        "personal_account_recipient",
        name="unresolved_ownership_reason",
        create_type=False,
    )
    op.create_table(
        "unresolved_ownerships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column("file_id", sa.String(length=255), nullable=False),
        sa.Column(
            "current_owner_member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_members.id"),
            nullable=True,
        ),
        sa.Column(
            "intended_recipient_member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_members.id"),
            nullable=True,
        ),
        sa.Column("reason", reason_enum, nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_unresolved_ownerships_org_id", "unresolved_ownerships", ["org_id"])


def downgrade() -> None:
    op.drop_table("unresolved_ownerships")
    op.execute("DROP TYPE IF EXISTS unresolved_ownership_reason")
    op.drop_table("audit_log_entries")
    op.drop_table("oauth_credentials")
    op.drop_table("delegation_grants")
    op.execute("DROP TYPE IF EXISTS delegation_status")
    op.drop_table("org_members")
    op.execute("DROP TYPE IF EXISTS auth_type")
    op.drop_table("organizations")
