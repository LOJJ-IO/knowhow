import uuid
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.api import deps
from app.api.routes import auth as auth_routes
from app.auth.login import LOGIN_STATE_PURPOSE
from app.auth.pkce import build_state_token
from app.auth.remembered import RememberedOrgView
from app.main import app
from app.onboarding import service as onboarding_service
from app.security.jwt import issue_access_token, issue_refresh_token

DEVICE = "11111111-1111-1111-1111-111111111111"


def _fake_login_result():
    member_id, org_id = uuid.uuid4(), uuid.uuid4()
    return SimpleNamespace(
        member=SimpleNamespace(id=member_id, organization_id=org_id),
        access_token=issue_access_token(member_id, org_id),
        refresh_token=issue_refresh_token(member_id, org_id),
    )


def _client() -> TestClient:
    app.dependency_overrides[deps.get_db] = lambda: None
    return TestClient(app, follow_redirects=False)


def test_no_device_cookie_returns_no_accounts():
    try:
        response = _client().get("/auth/remembered-accounts")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"organizations": []}


def test_malformed_device_cookie_returns_no_accounts(monkeypatch):
    # A hand-edited cookie must not 500 the screen that runs before sign-in.
    monkeypatch.setattr(auth_routes, "list_remembered_orgs", lambda device_id, db: 1 / 0)
    try:
        client = _client()
        client.cookies.set("knohow_device", "not-a-uuid")
        response = client.get("/auth/remembered-accounts")
    finally:
        app.dependency_overrides.clear()
    assert response.json() == {"organizations": []}


def test_lists_one_row_per_organization(monkeypatch):
    member_id = uuid.uuid4()
    monkeypatch.setattr(
        auth_routes,
        "list_remembered_orgs",
        lambda device_id, db: [
            RememberedOrgView(
                member_id=member_id,
                organization_name="Acme",
                person_name="Ronald Wopara",
                email="ronald@acme.org",
                kind="org",
                linked_personal_emails=["ronald@gmail.com"],
            )
        ],
    )
    try:
        client = _client()
        client.cookies.set("knohow_device", DEVICE)
        response = client.get("/auth/remembered-accounts")
    finally:
        app.dependency_overrides.clear()

    assert response.json() == {
        "organizations": [
            {
                "member_id": str(member_id),
                "organization_name": "Acme",
                "person_name": "Ronald Wopara",
                "email": "ronald@acme.org",
                "kind": "org",
                "linked_personal_emails": ["ronald@gmail.com"],
            }
        ]
    }


def test_remove_all_forgets_the_device_and_clears_the_cookie(monkeypatch):
    seen: list[tuple] = []
    monkeypatch.setattr(
        auth_routes,
        "forget_device",
        lambda device_id, db, member_ids=None: seen.append((device_id, member_ids)) or 2,
    )
    try:
        client = _client()
        client.cookies.set("knohow_device", DEVICE)
        response = client.delete("/auth/remembered-accounts")
    finally:
        app.dependency_overrides.clear()

    assert seen == [(uuid.UUID(DEVICE), None)]
    assert response.json() == {"removed": 2, "hidden": 0}
    assert 'knohow_device=""' in response.headers["set-cookie"]


def test_removing_some_rows_keeps_the_device_cookie(monkeypatch):
    # A partial removal must not drop the cookie, or the rows left behind
    # become unreachable.
    kept = uuid.uuid4()
    monkeypatch.setattr(auth_routes, "forget_device", lambda device_id, db, member_ids=None: 1)
    monkeypatch.setattr(
        auth_routes,
        "list_remembered_orgs",
        lambda device_id, db: [
            RememberedOrgView(
                member_id=kept,
                organization_name="Acme",
                person_name="R",
                email="r@acme.org",
                kind="org",
                linked_personal_emails=[],
            )
        ],
    )
    try:
        client = _client()
        client.cookies.set("knohow_device", DEVICE)
        response = client.request(
            "DELETE", "/auth/remembered-accounts", json={"member_ids": [str(uuid.uuid4())]}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.json() == {"removed": 1, "hidden": 0}
    assert 'knohow_device=""' not in response.headers.get("set-cookie", "")


def test_removing_the_last_row_clears_the_cookie(monkeypatch):
    monkeypatch.setattr(auth_routes, "forget_device", lambda device_id, db, member_ids=None: 1)
    monkeypatch.setattr(auth_routes, "list_remembered_orgs", lambda device_id, db: [])
    try:
        client = _client()
        client.cookies.set("knohow_device", DEVICE)
        response = client.request(
            "DELETE", "/auth/remembered-accounts", json={"member_ids": [str(uuid.uuid4())]}
        )
    finally:
        app.dependency_overrides.clear()

    assert 'knohow_device=""' in response.headers["set-cookie"]


def test_sign_in_remembers_the_account_and_mints_a_device_id(monkeypatch):
    remembered: list[tuple] = []
    monkeypatch.setattr(auth_routes, "complete_login", lambda code, state, db: _fake_login_result())
    monkeypatch.setattr(auth_routes, "accept_invitations_on_sign_in", lambda member, db: False)
    monkeypatch.setattr(auth_routes, "person_for", lambda member, db: None)
    monkeypatch.setattr(
        auth_routes, "remember_account", lambda device_id, member, db: remembered.append((device_id, member))
    )
    state = build_state_token("verifier", purpose=LOGIN_STATE_PURPOSE)
    try:
        response = _client().get("/auth/callback", params={"code": "c", "state": state})
    finally:
        app.dependency_overrides.clear()

    assert len(remembered) == 1
    assert "knohow_device" in response.cookies


def test_a_failure_to_remember_never_breaks_sign_in(monkeypatch):
    monkeypatch.setattr(auth_routes, "complete_login", lambda code, state, db: _fake_login_result())
    monkeypatch.setattr(auth_routes, "accept_invitations_on_sign_in", lambda member, db: False)
    monkeypatch.setattr(auth_routes, "person_for", lambda member, db: None)
    monkeypatch.setattr(
        auth_routes, "remember_account", lambda device_id, member, db: (_ for _ in ()).throw(RuntimeError("db down"))
    )
    state = build_state_token("verifier", purpose=LOGIN_STATE_PURPOSE)
    try:
        response = _client().get("/auth/callback", params={"code": "c", "state": state})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 302
    assert "knohow_access_token" in response.cookies


def test_logout_keeps_the_device_cookie():
    # The picker's whole point: after logging out the account is still offered.
    try:
        client = _client()
        client.cookies.set("knohow_device", DEVICE)
        response = client.post("/auth/logout")
    finally:
        app.dependency_overrides.clear()

    assert 'knohow_device=""' not in response.headers.get("set-cookie", "")


def _login_hint(url: str) -> str | None:
    return parse_qs(urlparse(url).query).get("login_hint", [None])[0]


def test_email_hint_pre_selects_the_account_at_google():
    start = onboarding_service.start_signup(email_hint="ronald@acme.org")
    assert _login_hint(start.authorization_url) == "ronald@acme.org"


def test_no_email_hint_leaves_the_chooser_alone():
    assert _login_hint(onboarding_service.start_signup().authorization_url) is None


def test_hiding_an_address_keeps_the_rows_and_the_device_cookie(monkeypatch):
    """Removing a linked personal address from the sign-in screen is a hide,
    not a removal: it must not forget any account, and it must not drop the
    device cookie that the remaining rows depend on (user, 2026-09-21)."""
    forgotten: list[tuple] = []
    hidden: list[tuple] = []
    monkeypatch.setattr(
        auth_routes,
        "forget_device",
        lambda device_id, db, member_ids=None: forgotten.append((device_id, member_ids)) or 0,
    )
    monkeypatch.setattr(
        auth_routes,
        "hide_emails",
        lambda device_id, emails, db: hidden.append((device_id, emails)) or len(emails),
    )
    try:
        client = _client()
        client.cookies.set("knohow_device", DEVICE)
        response = client.request(
            "DELETE",
            "/auth/remembered-accounts",
            json={"emails": ["someone@gmail.com"]},
        )
    finally:
        app.dependency_overrides.clear()

    assert forgotten == []
    assert hidden == [(uuid.UUID(DEVICE), ["someone@gmail.com"])]
    assert response.json() == {"removed": 0, "hidden": 1}
    assert "knohow_device" not in response.headers.get("set-cookie", "")


def test_removing_a_row_and_hiding_an_address_in_one_call(monkeypatch):
    """The tree lets someone tick an organization and one loose address at
    once; both halves have to run."""
    member_id = uuid.uuid4()
    forgotten: list[tuple] = []
    hidden: list[tuple] = []
    monkeypatch.setattr(
        auth_routes,
        "forget_device",
        lambda device_id, db, member_ids=None: forgotten.append((device_id, member_ids)) or 1,
    )
    monkeypatch.setattr(
        auth_routes,
        "hide_emails",
        lambda device_id, emails, db: hidden.append((device_id, emails)) or len(emails),
    )
    monkeypatch.setattr(auth_routes, "_device_has_rows", lambda cookie, db: True)
    try:
        client = _client()
        client.cookies.set("knohow_device", DEVICE)
        response = client.request(
            "DELETE",
            "/auth/remembered-accounts",
            json={"member_ids": [str(member_id)], "emails": ["someone@gmail.com"]},
        )
    finally:
        app.dependency_overrides.clear()

    assert forgotten == [(uuid.UUID(DEVICE), [member_id])]
    assert hidden == [(uuid.UUID(DEVICE), ["someone@gmail.com"])]
    assert response.json() == {"removed": 1, "hidden": 1}


def test_switch_requires_a_device_cookie():
    try:
        response = _client().post("/auth/switch", json={"member_id": str(uuid.uuid4())})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401


def test_switch_refuses_an_account_this_browser_never_used(monkeypatch):
    # The device cookie is the credential, so the *only* thing it may unlock
    # is an account already remembered against it.
    monkeypatch.setattr(auth_routes, "is_remembered", lambda device_id, member_id, db: False)
    client = _client()
    client.cookies.set("knohow_device", DEVICE)
    try:
        response = client.post("/auth/switch", json={"member_id": str(uuid.uuid4())})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 403


def test_switch_issues_session_cookies_for_a_remembered_account(monkeypatch):
    member_id, org_id = uuid.uuid4(), uuid.uuid4()
    member = SimpleNamespace(id=member_id, organization_id=org_id)

    class _Db:
        def get(self, model, key):
            return member

        def commit(self):
            pass

    monkeypatch.setattr(auth_routes, "is_remembered", lambda device_id, m, db: True)
    monkeypatch.setattr(auth_routes, "remember_account", lambda device_id, m, db: None)
    app.dependency_overrides[deps.get_db] = lambda: _Db()
    client = TestClient(app, follow_redirects=False)
    client.cookies.set("knohow_device", DEVICE)
    try:
        response = client.post("/auth/switch", json={"member_id": str(member_id)})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["organization_id"] == str(org_id)
    cookies = response.headers.get_list("set-cookie")
    assert any("knohow_access_token=" in c for c in cookies)
    assert any("knohow_refresh_token=" in c for c in cookies)


def test_add_another_account_without_a_session_goes_to_sign_in(monkeypatch):
    """The button is a top-level navigation, so a 401 would land the person on
    a JSON error page. They pressed "Add another account"; send them to sign
    in (user, 2026-09-22)."""
    try:
        response = _client().get("/auth/link-account/start")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 302
    assert response.headers["location"] == "/onboarding/signup"
