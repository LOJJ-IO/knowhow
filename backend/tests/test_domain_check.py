"""Domain check at signup, against a real Postgres (the test database from
conftest's DATABASE_URL, migrated to head). Skipped when it isn't reachable."""

import uuid
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import OperationalError

from app.auth.pkce import build_state_token
from app.db import SessionLocal
from app.main import app
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.organization import Organization
from app.onboarding import service
from app.onboarding.service import (
    SIGNUP_STATE_PURPOSE,
    approve_member,
    complete_signup,
    create_domainless_org,
    create_org_chart,
)
from app.security.jwt import issue_access_token


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


def _google(monkeypatch, email: str, hd: str | None = None, name: str = "Test Person"):
    claims = {"email": email, "email_verified": True, "name": name}
    if hd:
        claims["hd"] = hd
    monkeypatch.setattr(service, "exchange_code_for_tokens", lambda code, verifier: {"id_token": "stub"})
    monkeypatch.setattr(service, "verify_id_token", lambda token: claims)


def _signup(db):
    return complete_signup("code", build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE), db)


def _org_count(db) -> int:
    return db.execute(select(func.count()).select_from(Organization)).scalar_one()


def test_first_workspace_signup_creates_unbound_org_for_observed_domain(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")

    result = _signup(db)

    member = result.login.member
    org = db.get(Organization, member.organization_id)
    assert org.observed_domain == "acme.com"
    assert org.verified_domain is None
    assert member.standing == MemberStanding.AUTO_AFFILIATED
    assert member.auth_type == AuthType.DOMAIN_DELEGATED


def test_second_signup_with_same_domain_joins_existing_org(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    first = _signup(db).login.member
    _google(monkeypatch, "john@acme.com", hd="acme.com")

    second = _signup(db).login.member

    assert second.organization_id == first.organization_id
    assert second.standing == MemberStanding.AUTO_AFFILIATED
    assert _org_count(db) == 1


def test_domain_is_read_from_hd_claim_not_email(db, monkeypatch):
    # A Workspace on a custom domain whose address doesn't look corporate,
    # and a lookalike address with no Workspace behind it.
    _google(monkeypatch, "person@gmail.com", hd="acme.com")
    assert _signup(db).login.member.auth_type == AuthType.DOMAIN_DELEGATED
    _google(monkeypatch, "john@johnconsulting.com", hd=None)
    assert _signup(db).pending_personal_token is not None


def test_personal_signup_creates_nothing_until_answered(db, monkeypatch):
    _google(monkeypatch, "jane@gmail.com")

    result = _signup(db)

    assert result.login is None
    assert result.pending_personal_token is not None
    assert _org_count(db) == 0


def test_domainless_org_has_one_owner_and_one_per_person(db, monkeypatch):
    _google(monkeypatch, "jane@gmail.com")
    token = _signup(db).pending_personal_token

    login = create_domainless_org(token, db)
    again = create_domainless_org(token, db)

    org = db.get(Organization, login.member.organization_id)
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org.id)).scalar_one()
    assert org.observed_domain is None and org.verified_domain is None
    assert login.member.standing == MemberStanding.APPROVED
    assert login.member.auth_type == AuthType.PERSONAL_OAUTH
    assert chart.owner_member_id == login.member.id
    assert again.member.id == login.member.id
    assert _org_count(db) == 1


def test_existing_member_signup_is_a_login(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    first = _signup(db).login.member

    again = _signup(db).login.member

    assert again.id == first.id
    assert db.execute(select(func.count()).select_from(OrgMember)).scalar_one() == 1


def test_owner_claim_grants_standing_and_owner_approves_coworker(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member
    _google(monkeypatch, "john@acme.com", hd="acme.com")
    john = _signup(db).login.member

    create_org_chart(sarah.organization_id, sarah.id, is_owner=True, is_super_admin=False, db=db)
    db.refresh(sarah)
    assert sarah.standing == MemberStanding.APPROVED

    with pytest.raises(PermissionError):
        approve_member(sarah.organization_id, john, sarah.id, db)
    approved = approve_member(sarah.organization_id, sarah, john.id, db)
    assert approved.standing == MemberStanding.APPROVED


def _client_as(member: OrgMember) -> TestClient:
    client = TestClient(app, follow_redirects=False)
    client.cookies.set("knohow_access_token", issue_access_token(member.id, member.organization_id))
    return client


def test_unapproved_member_is_limited_to_own_identity(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member
    client = _client_as(sarah)

    me = client.get("/auth/me")
    org_chart = client.get(f"/org-chart/{sarah.organization_id}")

    assert me.status_code == 200 and me.json()["standing"] == "auto_affiliated"
    assert org_chart.status_code == 403


def test_only_founding_member_can_set_up_org_chart(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member
    _google(monkeypatch, "john@acme.com", hd="acme.com")
    john = _signup(db).login.member

    body = {"is_owner": True, "is_super_admin": False}
    john_attempt = _client_as(john).post(f"/organizations/{john.organization_id}/org-chart", json=body)
    sarah_attempt = _client_as(sarah).post(f"/organizations/{sarah.organization_id}/org-chart", json=body)

    assert john_attempt.status_code == 403
    assert sarah_attempt.status_code == 200


def test_personal_signup_round_trip_over_http(db, monkeypatch):
    _google(monkeypatch, "jane@gmail.com")
    client = TestClient(app, follow_redirects=False)
    state = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE)

    callback = client.get("/auth/callback", params={"code": "c", "state": state})
    assert callback.status_code == 302
    assert urlparse(callback.headers["location"]).query == "signup=personal"
    assert "knohow_pending_signup" in callback.cookies
    assert "knohow_access_token" not in callback.cookies

    client.cookies.set("knohow_pending_signup", callback.cookies["knohow_pending_signup"])
    created = client.post("/onboarding/personal-org")
    assert created.status_code == 200
    assert "knohow_access_token" in created.cookies
    assert uuid.UUID(created.json()["organization_id"])


def test_switch_account_forces_google_account_chooser():
    response = TestClient(app, follow_redirects=False).get("/onboarding/signup", params={"switch_account": "true"})
    assert "prompt=select_account" in response.headers["location"]


def _setup_founder_and_coworker(db, monkeypatch, founder_is_owner: bool, **chart_kwargs):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member
    create_org_chart(sarah.organization_id, sarah.id, is_owner=founder_is_owner, is_super_admin=False, db=db, **chart_kwargs)
    db.refresh(sarah)
    return sarah


def test_nominated_owner_becomes_owner_by_signing_in(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=False, owner_email="boss@acme.com")
    assert sarah.standing == MemberStanding.AUTO_AFFILIATED

    nominee = db.execute(select(OrgMember).where(OrgMember.email == "boss@acme.com")).scalar_one()
    assert nominee.standing == MemberStanding.AUTO_AFFILIATED  # limited until they sign in

    _google(monkeypatch, "boss@acme.com", hd="acme.com")
    boss = _signup(db).login.member

    chart = db.execute(select(OrgChart).where(OrgChart.org_id == sarah.organization_id)).scalar_one()
    assert boss.id == nominee.id
    assert chart.owner_member_id == boss.id
    assert boss.standing == MemberStanding.APPROVED


def test_owner_sees_pending_join_requests(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=True)
    _google(monkeypatch, "john@acme.com", hd="acme.com")
    john = _signup(db).login.member

    pending = _client_as(sarah).get(f"/organizations/{sarah.organization_id}/members/pending")
    assert pending.status_code == 200
    assert [p["email"] for p in pending.json()] == ["john@acme.com"]

    approved = _client_as(sarah).post(f"/organizations/{sarah.organization_id}/members/{john.id}/approve")
    assert approved.json()["standing"] == "approved"
    assert _client_as(sarah).get(f"/organizations/{sarah.organization_id}/members/pending").json() == []
    assert _client_as(john).get(f"/organizations/{john.organization_id}/members/pending").status_code == 403


def test_owner_can_opt_into_auto_accepting_workspace_accounts(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=True)
    _google(monkeypatch, "john@acme.com", hd="acme.com")
    john = _signup(db).login.member
    assert john.standing == MemberStanding.AUTO_AFFILIATED

    assert _client_as(john).patch(
        f"/organizations/{john.organization_id}/settings", json={"auto_accept_workspace_members": True}
    ).status_code == 403
    enabled = _client_as(sarah).patch(
        f"/organizations/{sarah.organization_id}/settings", json={"auto_accept_workspace_members": True}
    )
    assert enabled.json() == {"auto_accept_workspace_members": True}

    _google(monkeypatch, "amy@acme.com", hd="acme.com")
    amy = _signup(db).login.member
    db.refresh(john)
    assert amy.standing == MemberStanding.APPROVED
    assert john.standing == MemberStanding.AUTO_AFFILIATED  # existing requests still need the owner


def test_super_admin_nomination_is_recorded_only(db, monkeypatch):
    sarah = _setup_founder_and_coworker(
        db, monkeypatch, founder_is_owner=True, super_admin_email="it@acme.com"
    )
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == sarah.organization_id)).scalar_one()
    assert chart.nominated_super_admin_email == "it@acme.com"
    assert db.execute(select(OrgMember).where(OrgMember.email == "it@acme.com")).scalar_one_or_none() is None


def test_me_reports_owner(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=True)
    me = _client_as(sarah).get("/auth/me").json()
    assert me["is_owner"] is True and me["standing"] == "approved"


def test_me_reports_org_setup_needed_for_founder_only(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member
    _google(monkeypatch, "john@acme.com", hd="acme.com")
    john = _signup(db).login.member

    assert _client_as(sarah).get("/auth/me").json()["needs_org_setup"] is True
    assert _client_as(john).get("/auth/me").json()["needs_org_setup"] is False
    create_org_chart(sarah.organization_id, sarah.id, is_owner=True, is_super_admin=False, db=db)
    assert _client_as(sarah).get("/auth/me").json()["needs_org_setup"] is False
