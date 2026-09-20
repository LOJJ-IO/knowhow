import uuid
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.api import deps
from app.api.routes import auth as auth_routes
from app.auth.login import LOGIN_STATE_PURPOSE
from app.auth.pkce import build_state_token
from app.auth.identity import LinkedAccount
from app.auth.remembered import RememberedPersonView
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
    assert response.json() == {"people": []}


def test_malformed_device_cookie_returns_no_accounts(monkeypatch):
    # A hand-edited cookie must not 500 the screen that runs before sign-in.
    monkeypatch.setattr(auth_routes, "list_remembered_people", lambda device_id, db: 1 / 0)
    try:
        client = _client()
        client.cookies.set("knohow_device", "not-a-uuid")
        response = client.get("/auth/remembered-accounts")
    finally:
        app.dependency_overrides.clear()
    assert response.json() == {"people": []}


def test_lists_one_row_per_person_with_their_accounts(monkeypatch):
    person_id = uuid.uuid4()
    monkeypatch.setattr(
        auth_routes,
        "list_remembered_people",
        lambda device_id, db: [
            RememberedPersonView(
                person_id=person_id,
                display_name="Ronald Wopara",
                primary_email="ronald@acme.org",
                accounts=[
                    LinkedAccount(email="ronald@acme.org", kind="org", organization_name="Acme"),
                    LinkedAccount(
                        email="ronald@gmail.com", kind="personal", organization_name="Ronald"
                    ),
                ],
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
        "people": [
            {
                "person_id": str(person_id),
                "display_name": "Ronald Wopara",
                "primary_email": "ronald@acme.org",
                "accounts": [
                    {"email": "ronald@acme.org", "kind": "org", "organization_name": "Acme"},
                    {
                        "email": "ronald@gmail.com",
                        "kind": "personal",
                        "organization_name": "Ronald",
                    },
                ],
            }
        ]
    }


def test_remove_accounts_forgets_device_and_clears_cookie(monkeypatch):
    seen: list[uuid.UUID] = []
    monkeypatch.setattr(
        auth_routes, "forget_device", lambda device_id, db: seen.append(device_id) or 2
    )
    try:
        client = _client()
        client.cookies.set("knohow_device", DEVICE)
        response = client.delete("/auth/remembered-accounts")
    finally:
        app.dependency_overrides.clear()

    assert seen == [uuid.UUID(DEVICE)]
    assert response.json() == {"removed": 2}
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
