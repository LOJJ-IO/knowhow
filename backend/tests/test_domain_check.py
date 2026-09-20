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


# --- Admin proof -----------------------------------------------------------

from app.google import directory  # noqa: E402
from app.models.delegation_grant import DelegationGrant  # noqa: E402
from app.onboarding import admin_proof  # noqa: E402
from app.onboarding.admin_proof import ADMIN_PROOF_STATE_PURPOSE, complete_admin_proof  # noqa: E402


def _admin_google(monkeypatch, email: str, hd: str | None, directory_says_admin: bool):
    claims = {"email": email, "email_verified": True}
    if hd:
        claims["hd"] = hd
    monkeypatch.setattr(admin_proof, "exchange_code_for_tokens", lambda code, verifier: {"id_token": "stub", "access_token": "at"})
    monkeypatch.setattr(admin_proof, "verify_id_token", lambda token: claims)
    monkeypatch.setattr(admin_proof, "is_super_admin", lambda access_token, e: directory_says_admin)


def _admin_state(member: OrgMember) -> str:
    return build_state_token("verifier", purpose=ADMIN_PROOF_STATE_PURPOSE, extra={"member_id": str(member.id)})


def test_admin_proof_verifies_binds_domain_and_starts_delegation(db, monkeypatch):
    _google(monkeypatch, "it@acme.com", hd="acme.com")
    it = _signup(db).login.member
    _admin_google(monkeypatch, "it@acme.com", hd="acme.com", directory_says_admin=True)

    result = complete_admin_proof("code", _admin_state(it), db)

    org = db.get(Organization, it.organization_id)
    grant = db.execute(select(DelegationGrant).where(DelegationGrant.organization_id == org.id)).scalar_one()
    assert result.proven
    assert result.member.super_admin_verified_at is not None
    assert result.member.standing == MemberStanding.APPROVED
    assert org.verified_domain == "acme.com"
    assert grant.verified_domain == "acme.com"


def test_admin_proof_not_admin_changes_nothing(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member
    _admin_google(monkeypatch, "sarah@acme.com", hd="acme.com", directory_says_admin=False)

    result = complete_admin_proof("code", _admin_state(sarah), db)

    assert not result.proven
    assert result.member.super_admin_verified_at is None
    assert result.member.standing == MemberStanding.AUTO_AFFILIATED
    assert db.get(Organization, sarah.organization_id).verified_domain is None


def test_admin_of_another_domain_is_not_proven_here(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member
    _admin_google(monkeypatch, "sarah@acme.com", hd="other.com", directory_says_admin=True)

    assert not complete_admin_proof("code", _admin_state(sarah), db).proven


def test_admin_proof_rejects_a_different_google_account(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member
    _admin_google(monkeypatch, "someone@acme.com", hd="acme.com", directory_says_admin=True)

    with pytest.raises(ValueError):
        complete_admin_proof("code", _admin_state(sarah), db)


def test_self_declared_super_admin_does_not_start_delegation(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member

    create_org_chart(sarah.organization_id, sarah.id, is_owner=True, is_super_admin=True, db=db)

    assert db.execute(select(DelegationGrant)).first() is None
    assert db.get(Organization, sarah.organization_id).verified_domain is None


def test_verified_super_admin_outranks_self_declared_owner(db, monkeypatch):
    intern = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=True)
    _google(monkeypatch, "it@acme.com", hd="acme.com")
    it = _signup(db).login.member
    _admin_google(monkeypatch, "it@acme.com", hd="acme.com", directory_says_admin=True)
    complete_admin_proof("code", _admin_state(it), db)
    _google(monkeypatch, "ceo@acme.com", hd="acme.com")
    ceo = _signup(db).login.member

    approved = _client_as(it).post(f"/organizations/{it.organization_id}/members/{ceo.id}/approve")
    reassigned = _client_as(it).post(f"/organizations/{it.organization_id}/owner", json={"member_id": str(ceo.id)})
    intern_try = _client_as(intern).post(f"/organizations/{intern.organization_id}/owner", json={"member_id": str(intern.id)})

    chart = db.execute(select(OrgChart).where(OrgChart.org_id == it.organization_id)).scalar_one()
    db.refresh(chart)
    assert approved.status_code == 200
    assert reassigned.status_code == 200
    assert chart.owner_member_id == ceo.id
    assert intern_try.status_code == 403
    assert _client_as(it).get("/auth/me").json()["is_super_admin"] is True


def test_admin_proof_callback_redirects_with_outcome(db, monkeypatch):
    _google(monkeypatch, "it@acme.com", hd="acme.com")
    it = _signup(db).login.member
    _admin_google(monkeypatch, "it@acme.com", hd="acme.com", directory_says_admin=False)

    response = TestClient(app, follow_redirects=False).get(
        "/auth/callback", params={"code": "c", "state": _admin_state(it)}
    )

    assert response.status_code == 302
    assert urlparse(response.headers["location"]).query == "admin_proof=not_verified"


class _FakeResponse:
    def __init__(self, status_code: int, body: dict | None = None):
        self.status_code = status_code
        self._body = body if body is not None else {}

    def json(self):
        return self._body


@pytest.mark.parametrize(
    ("status_code", "body", "expected"),
    [
        (200, {"isAdmin": True}, True),
        (200, {"isAdmin": False}, False),
        (200, {}, False),
        (403, {"error": {"code": 403, "errors": [{"reason": "forbidden"}]}}, False),
    ],
)
def test_directory_lookup_reads_is_admin(monkeypatch, status_code, body, expected):
    monkeypatch.setattr(directory.httpx, "get", lambda *a, **k: _FakeResponse(status_code, body))
    assert directory.is_super_admin("token", "it@acme.com") is expected


@pytest.mark.parametrize(
    ("status_code", "body"),
    [
        (500, None),
        (401, None),
        # Admin SDK API not enabled in the GCP project — not a verdict on the person.
        (403, {"error": {"code": 403, "errors": [{"reason": "accessNotConfigured"}]}}),
    ],
)
def test_directory_lookup_raises_when_check_did_not_run(monkeypatch, status_code, body):
    monkeypatch.setattr(directory.httpx, "get", lambda *a, **k: _FakeResponse(status_code, body))
    with pytest.raises(directory.DirectoryLookupError):
        directory.is_super_admin("token", "it@acme.com")


# --- Invite links -----------------------------------------------------------

from urllib.parse import parse_qs  # noqa: E402

from app.models.invitation import Invitation, InvitationKind  # noqa: E402
from app.onboarding.service import start_signup  # noqa: E402


def _invite_state(email: str) -> str:
    return build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"invite_email": email})


def test_setup_nominates_owner_and_super_admin_in_parallel(db, monkeypatch):
    _google(monkeypatch, "intern@acme.com", hd="acme.com")
    intern = _signup(db).login.member

    response = _client_as(intern).post(
        f"/organizations/{intern.organization_id}/org-chart",
        json={"is_owner": False, "is_super_admin": False, "owner_email": "boss@acme.com", "super_admin_email": "it@acme.com"},
    ).json()

    assert "?invite=" in response["owner_invite_url"]
    assert "?invite=" in response["super_admin_invite_url"]
    listed = _client_as(intern).get(f"/organizations/{intern.organization_id}/invitations")
    assert listed.status_code == 200  # the limited setup person can still fetch the links
    assert sorted(i["kind"] for i in listed.json()) == ["owner", "super_admin"]


def test_coworker_cannot_see_invite_links(db, monkeypatch):
    _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=False, owner_email="boss@acme.com")
    _google(monkeypatch, "john@acme.com", hd="acme.com")
    john = _signup(db).login.member
    assert _client_as(john).get(f"/organizations/{john.organization_id}/invitations").status_code == 403


def test_invite_link_preselects_the_invited_account(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=False, owner_email="boss@acme.com")
    invitation = db.execute(select(Invitation).where(Invitation.organization_id == sarah.organization_id)).scalar_one()

    url = start_signup(invite_token=invitation.token, db=db).authorization_url

    assert parse_qs(urlparse(url).query)["login_hint"] == ["boss@acme.com"]


def test_holding_the_link_is_not_enough(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=False, owner_email="boss@acme.com")
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")

    result = complete_signup("code", _invite_state("boss@acme.com"), db)

    chart = db.execute(select(OrgChart).where(OrgChart.org_id == sarah.organization_id)).scalar_one()
    assert result.invite_wrong_account
    assert chart.owner_member_id is None


def test_super_admin_invitee_goes_straight_to_admin_proof(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=True, super_admin_email="it@acme.com")
    _google(monkeypatch, "it@acme.com", hd="acme.com")

    callback = TestClient(app, follow_redirects=False).get(
        "/auth/callback", params={"code": "c", "state": _invite_state("it@acme.com")}
    )
    assert callback.headers["location"] == "/auth/admin-proof/start"
    assert "knohow_access_token" in callback.cookies

    it = db.execute(select(OrgMember).where(OrgMember.email == "it@acme.com")).scalar_one()
    _admin_google(monkeypatch, "it@acme.com", hd="acme.com", directory_says_admin=True)
    complete_admin_proof("code", _admin_state(it), db)
    pending = db.execute(
        select(Invitation).where(Invitation.kind == InvitationKind.SUPER_ADMIN, Invitation.consumed_at.is_(None))
    ).first()
    assert pending is None
    assert sarah.organization_id == it.organization_id


def test_nominate_later_and_no_second_owner(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=True)
    client = _client_as(sarah)

    admin_invite = client.post(
        f"/organizations/{sarah.organization_id}/invitations", json={"kind": "super_admin", "email": "it@acme.com"}
    )
    same_again = client.post(
        f"/organizations/{sarah.organization_id}/invitations", json={"kind": "super_admin", "email": "IT@acme.com"}
    )
    owner_invite = client.post(
        f"/organizations/{sarah.organization_id}/invitations", json={"kind": "owner", "email": "boss@acme.com"}
    )

    assert admin_invite.status_code == 200
    assert same_again.json()["id"] == admin_invite.json()["id"]
    assert owner_invite.status_code == 409


# --- Delegation guide + detection -------------------------------------------

from app.auth import delegation  # noqa: E402
from app.models.delegation_grant import DelegationStatus  # noqa: E402


def _verified_admin_org(db, monkeypatch):
    _google(monkeypatch, "it@acme.com", hd="acme.com")
    it = _signup(db).login.member
    _admin_google(monkeypatch, "it@acme.com", hd="acme.com", directory_says_admin=True)
    complete_admin_proof("code", _admin_state(it), db)
    db.refresh(it)
    return it


def test_delegation_setup_guide_lists_client_id_and_every_scope(db, monkeypatch):
    it = _verified_admin_org(db, monkeypatch)
    monkeypatch.setattr(delegation, "load_service_account_info", lambda: {"client_id": "1088315"})
    monkeypatch.setattr(delegation, "_impersonation_works", lambda subject, scopes: False)

    guide = _client_as(it).get(f"/organizations/{it.organization_id}/delegation/setup").json()

    assert guide["client_id"] == "1088315"
    assert guide["scopes"] == delegation.ADMIN_CONSOLE_DELEGATION_SCOPES
    assert guide["scopes_csv"] == ",".join(delegation.ADMIN_CONSOLE_DELEGATION_SCOPES)
    assert guide["admin_console_url"].startswith("https://admin.google.com/")
    assert guide["status"] == "pending"


def test_delegation_detection_reports_missing_scopes(db, monkeypatch):
    it = _verified_admin_org(db, monkeypatch)
    drive_only = delegation.DOMAIN_DELEGATION_SCOPES
    monkeypatch.setattr(delegation, "_impersonation_works", lambda subject, scopes: all(s in drive_only for s in scopes))

    result = delegation.check_delegation(it.organization_id, db)

    assert result.status == "pending"
    assert result.missing_scopes == [s for s in delegation.ADMIN_CONSOLE_DELEGATION_SCOPES if s not in drive_only]


def test_delegation_detection_approves_once_impersonation_works(db, monkeypatch):
    it = _verified_admin_org(db, monkeypatch)
    calls = []
    monkeypatch.setattr(delegation, "_impersonation_works", lambda subject, scopes: calls.append(subject) or True)
    monkeypatch.setattr(delegation, "_drive_call_works", lambda subject: True)

    result = delegation.check_delegation(it.organization_id, db)

    grant = db.execute(select(DelegationGrant).where(DelegationGrant.organization_id == it.organization_id)).scalar_one()
    assert result.status == "approved"
    assert grant.status == DelegationStatus.APPROVED
    assert grant.approving_admin_email == "it@acme.com"
    assert calls == ["it@acme.com"]  # impersonates the verified Super Admin


def test_delegation_is_not_checked_without_admin_proof(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=True)
    assert delegation.check_delegation(sarah.organization_id, db).status == "not_started"


def test_approve_route_no_longer_takes_anyones_word(db, monkeypatch):
    it = _verified_admin_org(db, monkeypatch)
    monkeypatch.setattr(delegation, "_impersonation_works", lambda subject, scopes: False)

    response = _client_as(it).post(
        f"/organizations/{it.organization_id}/delegation/approve", json={"approving_admin_email": "it@acme.com"}
    )

    assert response.json()["status"] == "pending"


def test_naming_yourself_as_owner_makes_you_owner(db, monkeypatch):
    _google(monkeypatch, "sarah@acme.com", hd="acme.com")
    sarah = _signup(db).login.member

    create_org_chart(
        sarah.organization_id, sarah.id, is_owner=False, is_super_admin=False, db=db, owner_email="Sarah@acme.com"
    )

    db.refresh(sarah)
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == sarah.organization_id)).scalar_one()
    assert chart.owner_member_id == sarah.id
    assert sarah.standing == MemberStanding.APPROVED
    assert db.execute(select(Invitation)).first() is None


# --- Open admin link --------------------------------------------------------

def _open_state(token: str) -> str:
    return build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE, extra={"open_admin_invite": token})


def _open_link(db, monkeypatch):
    sarah = _setup_founder_and_coworker(db, monkeypatch, founder_is_owner=True)
    response = _client_as(sarah).post(f"/organizations/{sarah.organization_id}/invitations", json={"kind": "super_admin"})
    return sarah, response.json()


def test_open_admin_link_has_no_email_and_is_reused(db, monkeypatch):
    sarah, link = _open_link(db, monkeypatch)
    again = _client_as(sarah).post(f"/organizations/{sarah.organization_id}/invitations", json={"kind": "super_admin"})
    owner_without_email = _client_as(sarah).post(f"/organizations/{sarah.organization_id}/invitations", json={"kind": "owner"})

    assert link["email"] is None and "?invite=" in link["url"]
    assert again.json()["id"] == link["id"]
    assert owner_without_email.status_code == 409


def test_open_admin_link_does_not_preselect_an_account(db, monkeypatch):
    _, link = _open_link(db, monkeypatch)
    token = link["url"].split("invite=")[1]
    assert "login_hint" not in parse_qs(urlparse(start_signup(invite_token=token, db=db).authorization_url).query)


def test_anyone_via_open_link_is_checked_and_non_admins_stay_members(db, monkeypatch):
    sarah, link = _open_link(db, monkeypatch)
    token = link["url"].split("invite=")[1]
    _google(monkeypatch, "john@acme.com", hd="acme.com")

    callback = TestClient(app, follow_redirects=False).get(
        "/auth/callback", params={"code": "c", "state": _open_state(token)}
    )
    assert callback.headers["location"] == "/auth/admin-proof/start"

    john = db.execute(select(OrgMember).where(OrgMember.email == "john@acme.com")).scalar_one()
    _admin_google(monkeypatch, "john@acme.com", hd="acme.com", directory_says_admin=False)
    assert not complete_admin_proof("code", _admin_state(john), db).proven
    db.refresh(john)
    assert john.standing == MemberStanding.AUTO_AFFILIATED  # just a coworker waiting for approval
    open_invite = db.execute(select(Invitation).where(Invitation.email.is_(None))).scalar_one()
    assert open_invite.consumed_at is None  # still live for the real admin


def test_open_link_is_used_up_once_the_real_admin_proves_it(db, monkeypatch):
    sarah, link = _open_link(db, monkeypatch)
    token = link["url"].split("invite=")[1]
    _google(monkeypatch, "it@acme.com", hd="acme.com")
    assert complete_signup("code", _open_state(token), db).needs_admin_proof

    it = db.execute(select(OrgMember).where(OrgMember.email == "it@acme.com")).scalar_one()
    _admin_google(monkeypatch, "it@acme.com", hd="acme.com", directory_says_admin=True)
    assert complete_admin_proof("code", _admin_state(it), db).proven
    open_invite = db.execute(select(Invitation).where(Invitation.email.is_(None))).scalar_one()
    assert open_invite.consumed_at is not None


def test_open_link_from_another_org_does_nothing(db, monkeypatch):
    _, link = _open_link(db, monkeypatch)
    token = link["url"].split("invite=")[1]
    _google(monkeypatch, "zed@other.com", hd="other.com")

    result = complete_signup("code", _open_state(token), db)

    assert not result.needs_admin_proof
