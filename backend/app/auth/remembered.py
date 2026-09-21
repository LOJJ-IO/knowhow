"""Accounts this browser has signed in with, for the Log In account picker.

Deliberately not an identity feature. Knohow has no way to know that two
Google accounts belong to the same person (identity linking is unbuilt), so
this records only "this browser has signed in as these members". It confers
no access: a remembered row is a shortcut to Google's sign-in, nothing more.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import and_, delete, select
from sqlalchemy.orm import Session

from app.models.org_member import AuthType, OrgMember
from app.models.organization import Organization
from app.models.person import Person
from app.models.hidden_remembered_email import HiddenRememberedEmail
from app.models.person_email import PersonEmail
from app.models.remembered_account import RememberedAccount


@dataclass
class RememberedOrgView:
    """One row in the picker: an **organization** this browser has signed in
    to. Signing in is signing in to an org (user, 2026-09-20), so the org's
    name leads and the person's name is subtext. Two companies plus a
    personal org is three rows."""

    member_id: uuid.UUID
    organization_name: str
    # The human, for the subtext line. Falls back to the account's own Google
    # name when the account isn't linked to a person yet.
    person_name: str | None
    email: str
    # "org" - a Workspace account. "personal" - any non-Workspace account
    # (user, 2026-09-20), including a contractor's Gmail in a company org.
    kind: str
    # Addresses proved to be this person's that have no org of their own, so
    # they get no row (they came from "yes, I have an organization account").
    # Shown as a Personal (n) chip on each of the person's rows, which is why
    # the same list repeats across them (user, 2026-09-20).
    linked_personal_emails: list[str]


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


def list_remembered_orgs(device_id: uuid.UUID, db: Session) -> list[RememberedOrgView]:
    """The picker's rows, most recently used first — one per organization
    this browser has signed in to."""
    rows = db.execute(
        select(OrgMember, Organization, Person)
        .join(RememberedAccount, RememberedAccount.member_id == OrgMember.id)
        .join(Organization, Organization.id == OrgMember.organization_id)
        .outerjoin(Person, Person.id == OrgMember.person_id)
        .where(RememberedAccount.device_id == device_id)
        .order_by(RememberedAccount.last_seen_at.desc())
    ).all()
    hidden = {
        email
        for (email,) in db.execute(
            select(HiddenRememberedEmail.email).where(HiddenRememberedEmail.device_id == device_id)
        ).all()
    }

    # One lookup per person, not per row.
    person_ids = {member.person_id for member, _o, _p in rows if member.person_id}
    linked: dict[uuid.UUID, list[str]] = {pid: [] for pid in person_ids}
    if person_ids:
        for person_id, email in db.execute(
            select(PersonEmail.person_id, PersonEmail.email)
            .where(PersonEmail.person_id.in_(person_ids))
            .order_by(PersonEmail.created_at)
        ).all():
            # Hidden on this browser only: the link itself is untouched, and
            # the address still works everywhere else.
            if email not in hidden:
                linked[person_id].append(email)

    return [
        RememberedOrgView(
            member_id=member.id,
            organization_name=organization.name,
            person_name=(person.display_name if person else None) or member.display_name,
            email=member.email,
            kind="org" if member.auth_type is AuthType.DOMAIN_DELEGATED else "personal",
            linked_personal_emails=linked.get(member.person_id, []) if member.person_id else [],
        )
        for member, organization, person in rows
    ]


def hide_emails(device_id: uuid.UUID, emails: list[str], db: Session) -> int:
    """Stops showing these linked personal addresses in this browser's picker.

    Not a deletion and not an unlink: the addresses stay the person's, on
    every other browser and everywhere else in Knohow. This only answers
    "don't show that one here"."""
    if not emails:
        return 0
    existing = {
        email
        for (email,) in db.execute(
            select(HiddenRememberedEmail.email).where(
                HiddenRememberedEmail.device_id == device_id,
                HiddenRememberedEmail.email.in_(emails),
            )
        ).all()
    }
    added = 0
    for email in emails:
        if email in existing:
            continue
        db.add(HiddenRememberedEmail(device_id=device_id, email=email))
        existing.add(email)
        added += 1
    db.commit()
    return added


def forget_device(device_id: uuid.UUID, db: Session, member_ids: list[uuid.UUID] | None = None) -> int:
    """Forgets accounts on this browser. `member_ids` removes just those;
    omitting it removes every one.

    Deletes only the picker's rows: the members, their organizations and any
    linked identities are untouched, and signing in again re-adds them.
    """
    condition = RememberedAccount.device_id == device_id
    if member_ids is not None:
        if not member_ids:
            return 0
        condition = and_(condition, RememberedAccount.member_id.in_(member_ids))
    result = db.execute(delete(RememberedAccount).where(condition))
    if member_ids is None:
        # Forgetting the browser entirely takes its hide list with it —
        # nothing is left for those entries to hide.
        db.execute(delete(HiddenRememberedEmail).where(HiddenRememberedEmail.device_id == device_id))
    db.commit()
    return result.rowcount or 0
