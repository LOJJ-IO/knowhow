"""domain check: organizations.observed_domain, org_members.standing

Revision ID: 0003_domain_check
Revises: 0002_org_engine_schema
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_domain_check"
down_revision: Union[str, None] = "0002_org_engine_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("observed_domain", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_organizations_observed_domain", "organizations", ["observed_domain"])

    standing_enum = postgresql.ENUM("approved", "auto_affiliated", name="member_standing")
    standing_enum.create(op.get_bind(), checkfirst=True)
    # Existing members were all created by the pre-domain-check flow, which
    # had no notion of standing — they keep full access.
    op.add_column(
        "org_members",
        sa.Column(
            "standing",
            postgresql.ENUM("approved", "auto_affiliated", name="member_standing", create_type=False),
            nullable=False,
            server_default="approved",
        ),
    )


def downgrade() -> None:
    op.drop_column("org_members", "standing")
    postgresql.ENUM(name="member_standing").drop(op.get_bind(), checkfirst=True)
    op.drop_constraint("uq_organizations_observed_domain", "organizations", type_="unique")
    op.drop_column("organizations", "observed_domain")
