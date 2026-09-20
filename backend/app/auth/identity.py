"""Identity linking — one human, several Google accounts.

Nothing here infers that two accounts are the same person. A link is only
ever created by someone who is already signed in as one account and then
signs in to the other (onboarding spec: "standing is per person, proven by
signing in"). Matching display names and shared browsers prove nothing.

Data stays per account: a Person groups OrgMembers, it never merges orgs,
files or standing.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.google_oauth import build_authorization_url
from app.auth.pkce import build_state_token, derive_code_challenge, generate_code_verifier
from app.google.scopes import LOGIN_SCOPES
from app.models.org_member import AuthType, OrgMember
from app.models.organization import Organization
from app.models.person import Person

LINK_ACCOUNT_STATE_PURPOSE = "link_account"


class AccountAlreadyLinked(Exception):
    """The account signed in with already belongs to a different person."""


class PersonAlreadyHasOrgAccount(Exception):
    """A person holds at most one Workspace account (user, 2026-09-20)."""


@dataclass
class LinkAccountStart:
    authorization_url: str
    state: str


def person_for(member: OrgMember, db: Session) -> Person:
    """The member's person, created on first sign-in. Every account starts as
    its own person; linking is what brings two together."""
    if member.person_id is not None:
        person = db.get(Person, member.person_id)
        if person is not None:
            return person
    person = Person(display_name=member.display_name)
    db.add(person)
    db.flush()
    member.person_id = person.id
    db.commit()
    return person


def start_link_account(member: OrgMember) -> LinkAccountStart:
    """Sends the signed-in person to Google to add another of their accounts.
    The chooser is forced open — the whole point is to pick a *different*
    account than the current session's."""
    code_verifier = generate_code_verifier()
    state = build_state_token(
        code_verifier,
        purpose=LINK_ACCOUNT_STATE_PURPOSE,
        extra={"person_id": str(person_id_of(member))},
    )
    url = build_authorization_url(
        LOGIN_SCOPES,
        state=state,
        code_challenge=derive_code_challenge(code_verifier),
        access_type="online",
        prompt="select_account",
    )
    return LinkAccountStart(authorization_url=url, state=state)


def person_id_of(member: OrgMember) -> uuid.UUID:
    if member.person_id is None:
        raise ValueError("member has no person yet — call person_for first")
    return member.person_id


def link_account_to_person(person_id: uuid.UUID, member: OrgMember, db: Session) -> Person:
    """Attaches a just-signed-in account to an existing person.

    Refuses when the account already belongs to a *different* person that has
    other accounts — unpicking a wrong link is worse than refusing to make
    one. A person that exists only to hold this single account is absorbed.
    """
    person = db.get(Person, person_id)
    if person is None:
        raise ValueError(f"no Person with id={person_id}")

    if member.person_id == person.id:
        return person

    if member.person_id is not None:
        siblings = db.execute(
            select(OrgMember).where(OrgMember.person_id == member.person_id, OrgMember.id != member.id)
        ).scalars().all()
        if siblings:
            raise AccountAlreadyLinked(f"{member.email} is already linked to another person")
        stale = db.get(Person, member.person_id)
        member.person_id = None
        db.flush()
        if stale is not None:
            db.delete(stale)

    if member.auth_type is AuthType.DOMAIN_DELEGATED and _has_org_account(person.id, db):
        raise PersonAlreadyHasOrgAccount("this person already has a Workspace account")

    member.person_id = person.id
    if person.display_name is None:
        person.display_name = member.display_name
    db.commit()
    return person


def _has_org_account(person_id: uuid.UUID, db: Session) -> bool:
    return (
        db.execute(
            select(OrgMember.id).where(
                OrgMember.person_id == person_id, OrgMember.auth_type == AuthType.DOMAIN_DELEGATED
            )
        ).first()
        is not None
    )


@dataclass
class LinkedAccount:
    email: str
    # "org" — a Workspace account (domain-delegated). "personal" — anything
    # else, whichever org it belongs to (user, 2026-09-20: "any non-Workspace
    # account"), which includes a contractor's Gmail inside a company org.
    kind: str
    organization_name: str


def accounts_of(person_id: uuid.UUID, db: Session) -> list[LinkedAccount]:
    rows = db.execute(
        select(OrgMember, Organization)
        .join(Organization, Organization.id == OrgMember.organization_id)
        .where(OrgMember.person_id == person_id)
        .order_by(OrgMember.created_at)
    ).all()
    return [
        LinkedAccount(
            email=member.email,
            kind="org" if member.auth_type is AuthType.DOMAIN_DELEGATED else "personal",
            organization_name=organization.name,
        )
        for member, organization in rows
    ]
