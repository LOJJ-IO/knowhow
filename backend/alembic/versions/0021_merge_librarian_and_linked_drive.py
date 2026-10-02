"""merge the librarian branch with linked-drive / locked-join-links

Two lines of work were numbered 0019 independently: the librarian
(0019_librarian) and linked personal Drives (0019_linked_drive_credentials,
then 0020_join_link_locked). They touch disjoint tables, so order doesn't
matter; this revision just rejoins them into a single head.

Revision ID: 0021_merge_librarian_linked
Revises: 0019_librarian, 0020_join_link_locked
Create Date: 2026-10-01
"""

revision = "0021_merge_librarian_linked"
down_revision = ("0019_librarian", "0020_join_link_locked")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
