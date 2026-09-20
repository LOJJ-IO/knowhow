import uuid
from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import created_at_col, uuid_pk


class Person(Base):
    """One human, who may sign in with several Google accounts.

    Identity linking (onboarding spec): standing is per person, but the data
    stays per account — a Person groups OrgMembers, it never merges them.
    Nothing is inferred: two accounts belong to the same Person only because
    someone signed in to both deliberately (see app/auth/identity.py). A
    matching display name proves nothing and is never used.

    A Person holds **at most one Workspace (org) account** and any number of
    personal ones (user, 2026-09-20) — enforced by a partial unique index on
    org_members.person_id.
    """

    __tablename__ = "people"

    id: Mapped[uuid.UUID] = uuid_pk()

    # Shown in the account picker. Seeded from the first account's Google
    # name; the accounts keep their own names.
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = created_at_col()

    accounts: Mapped[list["OrgMember"]] = relationship(back_populates="person")
