import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import get_settings

STATE_TTL_SECONDS = 600


class InvalidOAuthState(Exception):
    pass


def generate_code_verifier() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode("ascii")


def derive_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def build_state_token(code_verifier: str, purpose: str, extra: dict | None = None) -> str:
    """Encodes the PKCE code_verifier plus flow context into a short-lived
    signed token that is round-tripped through Google as the `state`
    parameter. This avoids needing a server-side session store between the
    authorize redirect and the callback, which matters on Railway where
    consecutive requests aren't guaranteed to hit the same instance."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict = {
        "code_verifier": code_verifier,
        "purpose": purpose,
        "nonce": secrets.token_hex(8),
        "iat": now,
        "exp": now + timedelta(seconds=STATE_TTL_SECONDS),
    }
    payload.update(extra or {})
    return jwt.encode(payload, settings.jwt_signing_key, algorithm=settings.jwt_algorithm)


def decode_state_token(token: str, expected_purpose: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_signing_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise InvalidOAuthState(str(exc)) from exc

    if payload.get("purpose") != expected_purpose:
        raise InvalidOAuthState(f"expected state purpose {expected_purpose!r}, got {payload.get('purpose')!r}")

    return payload
