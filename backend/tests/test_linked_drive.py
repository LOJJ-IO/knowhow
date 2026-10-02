"""Drive consent for linked personal accounts (ADR-0025): only addresses
linked to the caller's own person, and only the matching Google account."""

import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from app.auth import linked_drive
from app.auth.linked_drive import (
    NotLinked,
    complete_linked_drive_consent,
    linked_drive_client,
    linked_personal_emails,
    start_linked_drive_consent,
)
from app.db import SessionLocal
from app.models.linked_drive_credential import LinkedDriveCredential
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


def _work_member(db, email="ron@acme.com", linked=("ron@gmail.com",)):
    person = Person(id=uuid.uuid4(), display_name="Ron")
    org = Organization(id=uuid.uuid4(), name="Acme", observed_domain=email.rsplit("@", 1)[1])
    member = OrgMember(
        id=uuid.uuid4(),
        organization_id=org.id,
        person_id=person.id,
        email=email,
        auth_type=AuthType.DOMAIN_DELEGATED,
        standing=MemberStanding.APPROVED,
    )
    db.add_all([person, org])
    db.flush()
    db.add(member)
    for address in linked:
        db.add(PersonEmail(id=uuid.uuid4(), person_id=person.id, email=address))
    db.commit()
    return member


def _google(monkeypatch, email):
    monkeypatch.setattr(linked_drive, "exchange_code_for_tokens", lambda c, v: {"id_token": "t", "refresh_token": "r"})
    monkeypatch.setattr(linked_drive, "verify_id_token", lambda _t: {"email": email, "sub": "sub-1"})
    monkeypatch.setattr(linked_drive, "encrypt_refresh_token", lambda t: t.encode())


def test_lists_only_the_callers_linked_addresses(db):
    member = _work_member(db)
    _work_member(db, email="someone@other.com", linked=("someone@gmail.com",))
    assert linked_personal_emails(member, db) == ["ron@gmail.com"]


def test_start_refuses_an_address_that_isnt_linked(db):
    member = _work_member(db)
    with pytest.raises(NotLinked):
        start_linked_drive_consent(member, "someone@gmail.com", db)


def test_start_hints_the_linked_address(db):
    member = _work_member(db)
    url = start_linked_drive_consent(member, "Ron@Gmail.com", db).authorization_url
    assert parse_qs(urlparse(url).query)["login_hint"] == ["ron@gmail.com"]


def test_consent_is_stored_for_the_person(db, monkeypatch):
    member = _work_member(db)
    _google(monkeypatch, "ron@gmail.com")
    state = start_linked_drive_consent(member, "ron@gmail.com", db).state
    complete_linked_drive_consent("code", state, db)
    stored = db.execute(select(LinkedDriveCredential)).scalar_one()
    assert (stored.person_id, stored.email) == (member.person_id, "ron@gmail.com")


def test_consent_with_a_different_google_account_is_refused(db, monkeypatch):
    member = _work_member(db)
    _google(monkeypatch, "impostor@gmail.com")
    state = start_linked_drive_consent(member, "ron@gmail.com", db).state
    with pytest.raises(ValueError, match="not ron@gmail.com"):
        complete_linked_drive_consent("code", state, db)
    assert db.execute(select(LinkedDriveCredential)).first() is None


def test_unconnected_linked_account_has_no_client(db):
    member = _work_member(db)
    assert linked_drive_client(member, "ron@gmail.com", db) is None
