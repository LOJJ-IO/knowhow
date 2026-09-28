import uuid
from types import SimpleNamespace

from app.auth import linked_drive, personal_oauth
from app.google.scopes import DRIVE_SCOPE


def _capture_scopes(monkeypatch, module):
    captured = {}

    def fake_build(scopes, **_kwargs):
        captured["scopes"] = scopes
        return "https://accounts.google.com/o/oauth2/v2/auth"

    monkeypatch.setattr(module, "build_authorization_url", fake_build)
    return captured


def test_personal_drive_consent_asks_for_openid_so_google_returns_an_id_token(monkeypatch):
    captured = _capture_scopes(monkeypatch, personal_oauth)
    member = SimpleNamespace(id=uuid.uuid4(), email="me@acme.com")

    personal_oauth.start_personal_oauth_consent(member)

    assert "openid" in captured["scopes"]
    assert "https://www.googleapis.com/auth/userinfo.email" in captured["scopes"]
    assert DRIVE_SCOPE in captured["scopes"]


def test_linked_drive_consent_asks_for_openid_so_google_returns_an_id_token(monkeypatch):
    captured = _capture_scopes(monkeypatch, linked_drive)
    monkeypatch.setattr(linked_drive, "_require_linked", lambda member, email, db: email)
    member = SimpleNamespace(id=uuid.uuid4(), email="me@acme.com")

    linked_drive.start_linked_drive_consent(member, "me@gmail.com", db=None)

    assert "openid" in captured["scopes"]
    assert "https://www.googleapis.com/auth/userinfo.email" in captured["scopes"]
    assert DRIVE_SCOPE in captured["scopes"]
