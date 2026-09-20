"""open admin link: invitations.email nullable (Super Admin link with no email)

Revision ID: 0007_open_admin_link
Revises: 0006_invitations
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0007_open_admin_link"
down_revision: Union[str, None] = "0006_invitations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("invitations", "email", nullable=True)
    op.create_check_constraint(
        "ck_invitations_owner_has_email", "invitations", "kind <> 'owner' OR email IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_constraint("ck_invitations_owner_has_email", "invitations", type_="check")
    op.alter_column("invitations", "email", nullable=False)
