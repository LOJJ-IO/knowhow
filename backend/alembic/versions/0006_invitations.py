"""invitations: owner_confirmation_tokens generalized to owner + Super Admin invite links

Revision ID: 0006_invitations
Revises: 0005_admin_proof
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_invitations"
down_revision: Union[str, None] = "0005_admin_proof"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("owner_confirmation_tokens", "invitations")
    op.alter_column("invitations", "owner_email", new_column_name="email")

    kind_enum = postgresql.ENUM("owner", "super_admin", name="invitation_kind")
    kind_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "invitations",
        sa.Column(
            "kind",
            postgresql.ENUM("owner", "super_admin", name="invitation_kind", create_type=False),
            nullable=False,
            server_default="owner",
        ),
    )
    op.alter_column("invitations", "kind", server_default=None)

    op.add_column("invitations", sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(
        "update invitations set organization_id = org_charts.org_id "
        "from org_charts where org_charts.id = invitations.org_chart_id"
    )
    op.alter_column("invitations", "organization_id", nullable=False)
    op.create_foreign_key("fk_invitations_organization_id", "invitations", "organizations", ["organization_id"], ["id"])
    op.create_index("ix_invitations_organization_id", "invitations", ["organization_id"])
    op.drop_column("invitations", "org_chart_id")

    op.add_column(
        "invitations",
        sa.Column("created_by_member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("org_members.id"), nullable=True),
    )


def downgrade() -> None:
    raise NotImplementedError("0006_invitations is not reversible")
