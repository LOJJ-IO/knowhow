"""Accounts this browser has signed in with, for the Log In account picker.

Deliberately not an identity feature. Knohow has no way to know that two
Google accounts belong to the same person (identity linking is unbuilt), so
this records only "this browser has signed in as these members". It confers
no access: a remembered row is a shortcut to Google's sign-in, nothing more.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.identity import LinkedAccount, accounts_of
from app.models.org_member import AuthType, OrgMember
from app.models.person import Person
from app.models.remembered_account import RememberedAccount


@dataclass
class RememberedPersonView:
    """One human in the picker, with the accounts this browser has used.
    A person holds at most one `org` account and any number of `personal`
    ones (user, 2026-09-20)."""

    person_id: uuid.UUID
    display_name: str | None
    # Most recently used of this person's accounts — what a click signs in
    # with, since Google still needs one email to open on.
    primary_email: str
    accounts: list[LinkedAccount]


def remember_account(device_id: uuid.UUID, member: OrgMember, db: Session) -> None:
    """Records (or refreshes) one account against this browser. Called after
    a sign-in succeeds, never before — an account that failed to sign in was
    never "used here"."""
    row = db.execute(
        select(RememberedAccount).where(
            RememberedAccount.device_id == device_id, RememberedAccount.member_id == member.id
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None:
        db.add(RememberedAccount(device_id=device_id, member_id=member.id, last_seen_at=now))
    else:
        row.last_seen_at = now
    db.commit()


def list_remembered_people(device_id: uuid.UUID, db: Session) -> list[RememberedPersonView]:
    """The picker's rows: one per person, most recently used first.

    Grouping is by `person_id` only — a deliberate link — never by name. An
    account with no person yet (pre-linking row) stands alone, which is the
    honest answer rather than guessing it belongs with another.
    """
    rows = db.execute(
        select(OrgMember, RememberedAccount.last_seen_at)
        .join(RememberedAccount, RememberedAccount.member_id == OrgMember.id)
        .where(RememberedAccount.device_id == device_id)
        .order_by(RememberedAccount.last_seen_at.desc())
    ).all()

    people: dict[str, RememberedPersonView] = {}
    for member, _last_seen in rows:
        # Unlinked accounts key on their own id so they never merge.
        key = str(member.person_id) if member.person_id else f"member:{member.id}"
        if key in people:
            continue
        person = db.get(Person, member.person_id) if member.person_id else None
        people[key] = RememberedPersonView(
            person_id=member.person_id or member.id,
            display_name=(person.display_name if person else None) or member.display_name,
            # Rows arrive newest-first, so the first account seen for a
            # person is their most recent.
            primary_email=member.email,
            accounts=(
                accounts_of(member.person_id, db)
                if member.person_id
                else [
                    LinkedAccount(
                        email=member.email,
                        kind="org" if member.auth_type is AuthType.DOMAIN_DELEGATED else "personal",
                        organization_name=member.organization.name,
                    )
                ]
            ),
        )
    return list(people.values())


def forget_device(device_id: uuid.UUID, db: Session) -> int:
    """"Remove accounts" — drops every account remembered on this browser.
    Deletes only the picker's rows; the members and their orgs are
    untouched, and signing in again re-adds them."""
    result = db.execute(delete(RememberedAccount).where(RememberedAccount.device_id == device_id))
    db.commit()
    return result.rowcount or 0
