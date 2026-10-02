import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api import deps
from app.api.routes import auth as auth_routes
from app.auth.login import LOGIN_STATE_PURPOSE
from app.auth.personal_oauth import PERSONAL_OAUTH_STATE_PURPOSE
from app.auth.pkce import build_state_token, peek_state_purpose
from app.main import app
from app.onboarding.service import SIGNUP_STATE_PURPOSE, SignupResult
from app.security.jwt import issue_access_token, issue_refresh_token


def _fake_result():
    member_id, org_id = uuid.uuid4(), uuid.uuid4()
    return SimpleNamespace(
        member=SimpleNamespace(id=member_id, organization_id=org_id),
        access_token=issue_access_token(member_id, org_id),
        refresh_token=issue_refresh_token(member_id, org_id),
    )


def _client(monkeypatch, calls: list[str]) -> TestClient:
    monkeypatch.setattr(auth_routes, "complete_login", lambda code, state, db: calls.append("login") or _fake_result())
    monkeypatch.setattr(
        auth_routes, "complete_signup", lambda code, state, db: calls.append("signup") or SignupResult(login=_fake_result())
    )
    monkeypatch.setattr(auth_routes, "accept_invitations_on_sign_in", lambda member, db: False)
    app.dependency_overrides[deps.get_db] = lambda: None
    return TestClient(app, follow_redirects=False)


def test_peek_state_purpose_reads_purpose():
    assert peek_state_purpose(build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE)) == SIGNUP_STATE_PURPOSE


def test_callback_routes_signup_state_to_signup(monkeypatch):
    calls: list[str] = []
    state = build_state_token("verifier", purpose=SIGNUP_STATE_PURPOSE)
    try:
        response = _client(monkeypatch, calls).get("/auth/callback", params={"code": "c", "state": state})
    finally:
        app.dependency_overrides.clear()

    assert calls == ["signup"]
    assert response.status_code == 302
    assert "knohow_access_token" in response.cookies


def test_callback_routes_login_state_to_login(monkeypatch):
    calls: list[str] = []
    state = build_state_token("verifier", purpose=LOGIN_STATE_PURPOSE)
    try:
        response = _client(monkeypatch, calls).get("/auth/callback", params={"code": "c", "state": state})
    finally:
        app.dependency_overrides.clear()

    assert calls == ["login"]
    assert response.status_code == 302


def test_callback_routes_drive_consent_state_to_personal_oauth(monkeypatch):
    calls: list[str] = []
    monkeypatch.setattr(
        auth_routes, "complete_personal_oauth_consent", lambda code, state, db: calls.append("personal_oauth")
    )
    state = build_state_token("verifier", purpose=PERSONAL_OAUTH_STATE_PURPOSE, extra={"member_id": str(uuid.uuid4())})
    try:
        response = _client(monkeypatch, calls).get("/auth/callback", params={"code": "c", "state": state})
    finally:
        app.dependency_overrides.clear()

    assert calls == ["personal_oauth"]
    assert response.status_code == 302
    assert response.headers["location"].endswith("drive_connected=1")
    assert "knohow_access_token" not in response.cookies  # consent is not a sign-in


def test_callback_rejects_tampered_state(monkeypatch):
    calls: list[str] = []
    try:
        response = _client(monkeypatch, calls).get("/auth/callback", params={"code": "c", "state": "not-a-jwt"})
    finally:
        app.dependency_overrides.clear()

    assert calls == []
    # Back to the login card as an X screen, never a raw error page, and no
    # session is set.
    assert response.status_code == 302
    assert "signin_error=state_expired" in response.headers["location"]
    assert "knohow_access_token" not in response.headers.get("set-cookie", "")


def test_sign_in_error_codes():
    from app.api.routes.auth import _sign_in_error_code

    assert _sign_in_error_code("join links are for work Google accounts only") == ("work_account_required", None)
    assert _sign_in_error_code("sign in with a acme.com account to join") == ("wrong_domain", "acme.com")
    assert _sign_in_error_code("this invite link is locked") == ("link_locked", None)
    assert _sign_in_error_code("something unexpected") == ("error", None)


def test_callback_hops_onto_the_frontend_origin_when_proxied(monkeypatch):
    """Behind the frontend's /api proxy, Google's direct hit on the registered
    URI is bounced onto the proxy (query intact, plus via=app) so cookies are
    first-party; the proxied hit itself is processed, not bounced again."""
    from fastapi.testclient import TestClient

    from app.config import get_settings
    from app.main import app

    monkeypatch.setattr(get_settings(), "public_api_base", "https://app.example/api")
    client = TestClient(app)
    res = client.get("/auth/callback?code=abc&state=xyz&scope=openid", follow_redirects=False)
    assert res.status_code == 302
    loc = res.headers["location"]
    assert loc.startswith("https://app.example/api/auth/callback?")
    assert "code=abc" in loc and "state=xyz" in loc and "scope=openid" in loc and "via=app" in loc

    # The proxied hit is handled (here: a bad state goes to the sign-in error screen).
    again = client.get("/auth/callback?code=abc&state=xyz&via=app", follow_redirects=False)
    assert again.status_code == 302
    assert "/api/auth/callback" not in again.headers["location"]
