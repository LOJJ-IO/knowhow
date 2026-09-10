import uuid
from collections.abc import Generator

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.exceptions import CrossOrgAccessDenied
from app.models.org_member import OrgMember
from app.security.jwt import InvalidSessionToken, TokenType, decode_session_token


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_member(
    knohow_access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> OrgMember:
    if knohow_access_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "not authenticated")

    try:
        payload = decode_session_token(knohow_access_token, expected_type=TokenType.ACCESS)
    except InvalidSessionToken as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid session: {exc}") from exc

    member = db.get(OrgMember, uuid.UUID(payload["sub"]))
    if member is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "member no longer exists")

    return member


def require_same_org(org_id: uuid.UUID, member: OrgMember = Depends(get_current_member)) -> OrgMember:
    """Route-level guard mirroring the boundary enforced inside the service
    functions themselves (get_drive_client_for_user, revoke_and_offboard,
    etc.) — belt-and-suspenders, since the service-layer check is the one
    that actually matters for safety, this just fails fast with a clean 403."""
    if member.organization_id != org_id:
        raise CrossOrgAccessDenied(f"member {member.id} does not belong to organization {org_id}")
    return member
