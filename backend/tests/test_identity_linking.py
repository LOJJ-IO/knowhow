"""Identity linking against a real Postgres (conftest's test database).
Skipped when it isn't reachable."""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError

from app.auth.identity import (
    AccountAlreadyLinked,
    PersonAlreadyHasOrgAccount,
    accounts_of,
    link_account_to_person,
    person_for,
)
from app.auth.remembered import list_remembered_people, remember_account
from app.db import SessionLocal
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.organization import Organization
from app.models.person import Person


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        session.execute(text("select 1 from alembic_version"))
    except OperationalError:
        pytest.skip("test database not reachable")
    tables = session.execute(
        text("select tablename from pg_tables where schemaname = 'public' and tablename != 'alembic_version'")
    ).scalars().all()
    session.execute(text(f"truncate {', '.join(tables)} restart identity cascade"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


def _org(db, name="Acme", domain=None):
    org = Organization(name=name, verified_domain=domain)
    db.add(org)
    db.flush()
    return org


def _member(db, org, email, name, auth=AuthType.PERSONAL_OAUTH):
    member = OrgMember(
        organization_id=org.id,
        email=email,
        display_name=name,
        auth_type=auth,
        standing=MemberStanding.APPROVED,
    )
    db.add(member)
    db.flush()
    return member


def test_first_sign_in_gives_an_account_its_own_person(db):
    member = _member(db, _org(db), "a@acme.org", "Ronald")
    person = person_for(member, db)
    assert member.person_id == person.id
    assert person.display_name == "Ronald"
    # Idempotent: signing in again doesn't mint a second person.
    assert person_for(member, db).id == person.id


def test_linking_puts_two_accounts_under_one_person(db):
    org = _org(db)
    work = _member(db, org, "r@acme.org", "Ronald Wopara", AuthType.DOMAIN_DELEGATED)
    personal = _member(db, _org(db, "Ronald (personal)"), "r@gmail.com", "Ronald")
    person = person_for(work, db)
    person_for(personal, db)

    link_account_to_person(person.id, personal, db)

    kinds = {a.email: a.kind for a in accounts_of(person.id, db)}
    assert kinds == {"r@acme.org": "org", "r@gmail.com": "personal"}


def test_a_person_may_hold_only_one_workspace_account(db):
    # User, 2026-09-20: "one org, many personal".
    person = person_for(_member(db, _org(db), "r@acme.org", "R", AuthType.DOMAIN_DELEGATED), db)
    second_org = _member(db, _org(db, "Other", "other.org"), "r@other.org", "R", AuthType.DOMAIN_DELEGATED)
    person_for(second_org, db)

    with pytest.raises(PersonAlreadyHasOrgAccount):
        link_account_to_person(person.id, second_org, db)


def test_many_personal_accounts_are_fine(db):
    person = person_for(_member(db, _org(db), "r@acme.org", "R", AuthType.DOMAIN_DELEGATED), db)
    for email in ("a@gmail.com", "b@gmail.com", "c@gmail.com"):
        extra = _member(db, _org(db, f"P {email}"), email, "R")
        person_for(extra, db)
        link_account_to_person(person.id, extra, db)

    accounts = accounts_of(person.id, db)
    assert sum(1 for a in accounts if a.kind == "personal") == 3
    assert sum(1 for a in accounts if a.kind == "org") == 1


def test_an_account_already_linked_elsewhere_is_refused(db):
    keeper = person_for(_member(db, _org(db), "keep@acme.org", "Keeper"), db)
    other_owner = _member(db, _org(db, "Other"), "other@acme.org", "Other")
    shared = _member(db, _org(db, "Shared"), "shared@gmail.com", "Shared")
    other_person = person_for(other_owner, db)
    person_for(shared, db)
    link_account_to_person(other_person.id, shared, db)

    # Unpicking a wrong link is worse than refusing to make one.
    with pytest.raises(AccountAlreadyLinked):
        link_account_to_person(keeper.id, shared, db)


def test_the_database_itself_rejects_a_second_workspace_account(db):
    # The service check is not the only guard — a partial unique index backs it.
    person = Person(display_name="R")
    db.add(person)
    db.flush()
    for email, org_name in (("a@acme.org", "A"), ("b@beta.org", "B")):
        member = _member(db, _org(db, org_name), email, "R", AuthType.DOMAIN_DELEGATED)
        member.person_id = person.id
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_the_picker_shows_one_row_per_person_not_per_account(db):
    device = uuid.uuid4()
    org = _org(db)
    work = _member(db, org, "r@acme.org", "Ronald Wopara", AuthType.DOMAIN_DELEGATED)
    personal = _member(db, _org(db, "Ronald (personal)"), "r@gmail.com", "Ronald")
    stranger = _member(db, org, "someone@acme.org", "Someone Else", AuthType.DOMAIN_DELEGATED)
    person = person_for(work, db)
    person_for(personal, db)
    person_for(stranger, db)
    link_account_to_person(person.id, personal, db)
    db.commit()

    for member in (work, personal, stranger):
        remember_account(device, member, db)

    rows = list_remembered_people(device, db)
    assert len(rows) == 2, "the two linked accounts must collapse into one row"
    linked = next(r for r in rows if r.person_id == person.id)
    assert {a.email for a in linked.accounts} == {"r@acme.org", "r@gmail.com"}
    # Most recently used account is what a click signs in with.
    assert linked.primary_email == "r@gmail.com"


def test_accounts_are_never_grouped_by_name(db):
    # Two different humans who happen to share a Google display name.
    device = uuid.uuid4()
    org = _org(db)
    a = _member(db, org, "ronald.a@acme.org", "Ronald")
    b = _member(db, org, "ronald.b@acme.org", "Ronald")
    person_for(a, db)
    person_for(b, db)
    remember_account(device, a, db)
    remember_account(device, b, db)

    assert len(list_remembered_people(device, db)) == 2
