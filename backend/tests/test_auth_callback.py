import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api import deps
from app.api.routes import auth as auth_routes
from app.auth.login import LOGIN_STATE_PURPOSE
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
    monkeypatch.setattr(auth_routes, "confirm_owner_on_sign_in", lambda member, db: False)
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


def test_callback_rejects_tampered_state(monkeypatch):
    calls: list[str] = []
    try:
        response = _client(monkeypatch, calls).get("/auth/callback", params={"code": "c", "state": "not-a-jwt"})
    finally:
        app.dependency_overrides.clear()

    assert calls == []
    assert response.status_code == 400
