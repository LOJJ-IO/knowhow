import uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_member, get_db
from app.auth.login import complete_login, start_login
from app.auth.personal_oauth import complete_personal_oauth_consent, start_personal_oauth_consent
from app.auth.pkce import InvalidOAuthState
from app.config import get_settings
from app.exceptions import MemberNotProvisioned
from app.models.org_member import OrgMember
from app.security.jwt import InvalidSessionToken, TokenType, decode_session_token, issue_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_COOKIE = "knohow_access_token"
REFRESH_COOKIE = "knohow_refresh_token"


def cookie_kwargs() -> dict:
    settings = get_settings()
    is_prod = settings.environment != "development"
    return {"httponly": True, "secure": is_prod, "samesite": "none" if is_prod else "lax"}


def set_session_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    settings = get_settings()
    kwargs = cookie_kwargs()
    response.set_cookie(ACCESS_COOKIE, access_token, max_age=settings.jwt_access_token_ttl_seconds, **kwargs)
    response.set_cookie(REFRESH_COOKIE, refresh_token, max_age=settings.jwt_refresh_token_ttl_seconds, **kwargs)


@router.get("/login")
def login() -> RedirectResponse:
    result = start_login()
    return RedirectResponse(result.authorization_url, status_code=status.HTTP_302_FOUND)


@router.get("/callback")
def login_callback(code: str, state: str, db: Session = Depends(get_db)) -> RedirectResponse:
    settings = get_settings()
    try:
        result = complete_login(code, state, db)
    except InvalidOAuthState as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid or expired login state: {exc}") from exc
    except MemberNotProvisioned as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"no Knohow account exists for {exc.email} yet — organization onboarding must add this "
            "member before they can log in",
        ) from exc

    response = RedirectResponse(settings.frontend_origin, status_code=status.HTTP_302_FOUND)
    set_session_cookies(response, result.access_token, result.refresh_token)
    return response


@router.post("/refresh")
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    knohow_refresh_token: str | None = Cookie(default=None),
) -> dict:
    if knohow_refresh_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no refresh token")

    try:
        payload = decode_session_token(knohow_refresh_token, expected_type=TokenType.REFRESH)
    except InvalidSessionToken as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid refresh token: {exc}") from exc

    member_id = uuid.UUID(payload["sub"])
    if db.get(OrgMember, member_id) is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "member no longer exists")

    access_token = issue_access_token(member_id, uuid.UUID(payload["org_id"]))
    settings = get_settings()
    response.set_cookie(
        ACCESS_COOKIE, access_token, max_age=settings.jwt_access_token_ttl_seconds, **cookie_kwargs()
    )
    return {"status": "refreshed"}


@router.post("/logout")
def logout(response: Response) -> dict:
    for cookie_name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(cookie_name)
    return {"status": "logged_out"}


@router.get("/me")
def me(member: OrgMember = Depends(get_current_member)) -> dict:
    return {
        "id": str(member.id),
        "organization_id": str(member.organization_id),
        "email": member.email,
        "display_name": member.display_name,
        "auth_type": member.auth_type.value,
    }


@router.get("/personal-oauth/start")
def personal_oauth_start(member: OrgMember = Depends(get_current_member)) -> RedirectResponse:
    result = start_personal_oauth_consent(member)
    return RedirectResponse(result.authorization_url, status_code=status.HTTP_302_FOUND)


@router.get("/personal-oauth/callback")
def personal_oauth_callback(code: str, state: str, db: Session = Depends(get_db)) -> RedirectResponse:
    settings = get_settings()
    try:
        complete_personal_oauth_consent(code, state, db)
    except InvalidOAuthState as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid or expired consent state: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return RedirectResponse(f"{settings.frontend_origin}?drive_connected=1", status_code=status.HTTP_302_FOUND)
