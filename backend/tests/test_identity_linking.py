"""Identity linking against a real Postgres (conftest's test database).
Skipped when it isn't reachable."""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.auth.identity import (
    AccountAlreadyLinked,
    attach_pending_personal_email,
    accounts_of,
    link_account_to_person,
    person_for,
)
from app.auth.remembered import forget_device, list_remembered_orgs, remember_account
from app.db import SessionLocal
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.organization import Organization
from app.models.person import Person
from app.models.person_email import PersonEmail


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


def test_a_person_may_belong_to_two_companies(db):
    # User, 2026-09-20: signing in is signing in to an org, and two companies
    # is legitimate — this reverses 0009's one-org rule.
    person = person_for(_member(db, _org(db), "r@acme.org", "R", AuthType.DOMAIN_DELEGATED), db)
    second_org = _member(db, _org(db, "Other", "other.org"), "r@other.org", "R", AuthType.DOMAIN_DELEGATED)
    person_for(second_org, db)

    link_account_to_person(person.id, second_org, db)

    assert sum(1 for a in accounts_of(person.id, db) if a.kind == "org") == 2


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


def test_a_verified_personal_address_is_kept_without_creating_an_org(db):
    # "Yes, I have an organization account": they get the company, and the
    # personal address is remembered against them — no personal org.
    work = _member(db, _org(db, "Acme", "acme.org"), "r@acme.org", "R", AuthType.DOMAIN_DELEGATED)
    person = person_for(work, db)
    orgs_before = db.query(Organization).count()

    attach_pending_personal_email(person.id, "R@Gmail.com", db)

    assert db.query(Organization).count() == orgs_before, "no personal org may be created"
    stored = db.query(PersonEmail).filter(PersonEmail.person_id == person.id).one()
    assert stored.email == "r@gmail.com", "addresses are normalised"


def test_a_personal_address_claimed_by_someone_else_is_refused(db):
    first = person_for(_member(db, _org(db), "a@acme.org", "A"), db)
    second = person_for(_member(db, _org(db, "Beta"), "b@acme.org", "B"), db)
    attach_pending_personal_email(first.id, "shared@gmail.com", db)

    with pytest.raises(AccountAlreadyLinked):
        attach_pending_personal_email(second.id, "shared@gmail.com", db)


def test_the_picker_shows_one_row_per_organization(db):
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

    # Signing in is signing in to an org (user, 2026-09-20): three memberships,
    # three rows, even though two of them are the same person.
    rows = list_remembered_orgs(device, db)
    assert len(rows) == 3
    assert {r.organization_name for r in rows} == {"Acme", "Ronald (personal)"}
    # The org leads; the person's name is the subtext.
    ronald_rows = [r for r in rows if r.person_name == "Ronald Wopara"]
    assert len(ronald_rows) == 2, "linked accounts share the person's name"
    assert {r.kind for r in ronald_rows} == {"org", "personal"}


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

    rows = list_remembered_orgs(device, db)
    assert len(rows) == 2
    assert all(r.person_name == "Ronald" for r in rows)


def test_a_linked_address_with_no_org_rides_on_the_person_s_rows(db):
    # "Yes, I have an organization account" leaves the personal address with
    # no org, so it has no row — it shows as a Personal chip on the org rows
    # instead (user, 2026-09-20).
    device = uuid.uuid4()
    work = _member(db, _org(db, "Acme", "acme.org"), "r@acme.org", "R", AuthType.DOMAIN_DELEGATED)
    person = person_for(work, db)
    attach_pending_personal_email(person.id, "r@gmail.com", db)
    remember_account(device, work, db)

    rows = list_remembered_orgs(device, db)
    assert len(rows) == 1, "a linked address must not create a second row"
    assert rows[0].kind == "org"
    assert rows[0].linked_personal_emails == ["r@gmail.com"]


def test_an_unlinked_account_carries_no_personal_chip(db):
    device = uuid.uuid4()
    solo = _member(db, _org(db, "Acme", "acme.org"), "s@acme.org", "S", AuthType.DOMAIN_DELEGATED)
    person_for(solo, db)
    remember_account(device, solo, db)

    assert list_remembered_orgs(device, db)[0].linked_personal_emails == []


def test_forgetting_one_row_leaves_the_others(db):
    device = uuid.uuid4()
    org = _org(db, "Acme", "acme.org")
    a = _member(db, org, "a@acme.org", "A", AuthType.DOMAIN_DELEGATED)
    b = _member(db, _org(db, "Beta"), "b@gmail.com", "B")
    for m in (a, b):
        person_for(m, db)
        remember_account(device, m, db)

    assert forget_device(device, db, [a.id]) == 1

    remaining = list_remembered_orgs(device, db)
    assert [r.email for r in remaining] == ["b@gmail.com"]
    # Forgetting a row must not touch the member or its organization.
    assert db.get(OrgMember, a.id) is not None
