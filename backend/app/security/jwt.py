import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum

from jose import JWTError, jwt

from app.config import get_settings


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


class InvalidSessionToken(Exception):
    pass


def issue_access_token(member_id: uuid.UUID, org_id: uuid.UUID) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(member_id),
        "org_id": str(org_id),
        "type": TokenType.ACCESS.value,
        "iat": now,
        "exp": now + timedelta(seconds=settings.jwt_access_token_ttl_seconds),
    }
    return jwt.encode(payload, settings.jwt_signing_key, algorithm=settings.jwt_algorithm)


def issue_refresh_token(member_id: uuid.UUID, org_id: uuid.UUID) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(member_id),
        "org_id": str(org_id),
        "type": TokenType.REFRESH.value,
        "iat": now,
        "exp": now + timedelta(seconds=settings.jwt_refresh_token_ttl_seconds),
    }
    return jwt.encode(payload, settings.jwt_signing_key, algorithm=settings.jwt_algorithm)


def decode_session_token(token: str, expected_type: TokenType) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_signing_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise InvalidSessionToken(str(exc)) from exc

    if payload.get("type") != expected_type.value:
        raise InvalidSessionToken(f"expected a {expected_type.value} token")

    return payload
