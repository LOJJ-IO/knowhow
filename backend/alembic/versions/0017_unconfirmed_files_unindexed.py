"""Unconfirmed files stay out of file_index; "personal" flag becomes "private".

A detected file nobody has confirmed as Company must not get a file_index row
(FEAT-drive-file-classification rule 3), so a suggested share now carries the
bare Drive file ID and can no longer reference file_index. The sharing_state
flag that hides a company file from coworkers was misnamed "personal"; it is
"private" (Personal = an employee's own file, never indexed).

Revision ID: 0017_unconfirmed_files_unindexed
Revises: 0016_dashboard_seen
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0017_unconfirmed_files_unindexed"
down_revision: Union[str, None] = "0016_dashboard_seen"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("suggested_shares_file_id_fkey", "suggested_shares", type_="foreignkey")
    op.execute(
        "UPDATE file_index SET sharing_state = (sharing_state - 'personal') "
        "|| jsonb_build_object('private', sharing_state -> 'personal') "
        "WHERE sharing_state ? 'personal'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE file_index SET sharing_state = (sharing_state - 'private') "
        "|| jsonb_build_object('personal', sharing_state -> 'private') "
        "WHERE sharing_state ? 'private'"
    )
    op.create_foreign_key(
        "suggested_shares_file_id_fkey", "suggested_shares", "file_index", ["file_id"], ["file_id"]
    )
