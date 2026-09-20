import uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_member, get_db
from app.auth.login import complete_login, start_login
from app.auth.personal_oauth import complete_personal_oauth_consent, start_personal_oauth_consent
from app.auth.pkce import InvalidOAuthState, decode_state_token, peek_state_purpose
from app.auth.identity import (
    AccountAlreadyLinked,
    LINK_ACCOUNT_STATE_PURPOSE,
    attach_pending_personal_email,
    link_account_to_person,
    person_for,
    start_link_account,
    start_link_account_for_pending_personal,
)
from app.auth.remembered import forget_device, list_remembered_orgs, remember_account
from app.config import get_settings
from app.exceptions import MemberNotProvisioned
from app.google.directory import DirectoryLookupError
from app.logging_config import get_logger
from app.models.org_member import OrgMember
from app.onboarding.admin_proof import ADMIN_PROOF_STATE_PURPOSE, complete_admin_proof, start_admin_proof
from app.onboarding.service import (
    PENDING_PERSONAL_SIGNUP_TTL,
    SIGNUP_STATE_PURPOSE,
    SignupResult,
    complete_signup,
    accept_invitations_on_sign_in,
    is_owner,
    needs_org_setup,
)
from app.security.jwt import InvalidSessionToken, TokenType, decode_session_token, issue_access_token

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)

ACCESS_COOKIE = "knohow_access_token"
REFRESH_COOKIE = "knohow_refresh_token"
PENDING_PERSONAL_SIGNUP_COOKIE = "knohow_pending_signup"
# Opaque per-browser id behind the Log In account picker. Long-lived on
# purpose — it has to outlive sessions to be worth anything — and it names
# no one by itself; the accounts it maps to are removable from the picker.
DEVICE_COOKIE = "knohow_device"
DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
ADMIN_PROOF_START_PATH = "/auth/admin-proof/start"


def cookie_kwargs() -> dict:
    settings = get_settings()
    is_prod = settings.environment != "development"
    return {"httponly": True, "secure": is_prod, "samesite": "none" if is_prod else "lax"}


def remember_on_this_device(
    response: Response, device_cookie: str | None, member: OrgMember, db: Session
) -> None:
    """Adds the member to this browser's account picker, minting the device
    id if the browser doesn't have one yet. Failing to remember must never
    fail a sign-in, so this is best-effort."""
    try:
        device_id = uuid.UUID(device_cookie) if device_cookie else uuid.uuid4()
    except ValueError:
        device_id = uuid.uuid4()
    try:
        # Every account belongs to a person from its first sign-in; linking
        # is what later brings two accounts under one.
        person_for(member, db)
        remember_account(device_id, member, db)
    except Exception as exc:  # noqa: BLE001 - never break sign-in over the picker
        logger.warning("auth.remember_account_failed", error=str(exc))
        return
    response.set_cookie(
        DEVICE_COOKIE, str(device_id), max_age=DEVICE_COOKIE_MAX_AGE, **cookie_kwargs()
    )


def set_session_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    settings = get_settings()
    kwargs = cookie_kwargs()
    response.set_cookie(ACCESS_COOKIE, access_token, max_age=settings.jwt_access_token_ttl_seconds, **kwargs)
    response.set_cookie(REFRESH_COOKIE, refresh_token, max_age=settings.jwt_refresh_token_ttl_seconds, **kwargs)


def signup_redirect(
    result: SignupResult, device_cookie: str | None = None, db: Session | None = None
) -> RedirectResponse:
    """Where the browser goes after a signup callback. A personal Google
    account with no org yet gets no session — only a short-lived pending
    cookie — and `?signup=personal`, so the frontend can ask whether their
    company uses Google Workspace (onboarding spec, "Personal account at
    sign-in")."""
    settings = get_settings()
    if result.pending_personal_token is not None:
        query = "signup=personal&invite=wrong_account" if result.invite_wrong_account else "signup=personal"
        response = RedirectResponse(f"{settings.frontend_origin}?{query}", status_code=status.HTTP_302_FOUND)
        response.set_cookie(
            PENDING_PERSONAL_SIGNUP_COOKIE,
            result.pending_personal_token,
            max_age=int(PENDING_PERSONAL_SIGNUP_TTL.total_seconds()),
            **cookie_kwargs(),
        )
        return response

    if result.needs_admin_proof:
        # Invited as Super Admin: straight on to Google's check. The session
        # cookies set here ride along on the next hop (same backend origin).
        location = ADMIN_PROOF_START_PATH
    elif result.invite_wrong_account:
        location = f"{settings.frontend_origin}?invite=wrong_account"
    else:
        location = settings.frontend_origin
    response = RedirectResponse(location, status_code=status.HTTP_302_FOUND)
    set_session_cookies(response, result.login.access_token, result.login.refresh_token)
    if db is not None:
        remember_on_this_device(response, device_cookie, result.login.member, db)
    return response


def link_account_redirect(
    code: str, state: str, device_cookie: str | None, db: Session
) -> RedirectResponse:
    """Back from Google after "add another account". The account that just
    signed in joins the person who started the flow; the session stays as
    that newly signed-in account."""
    settings = get_settings()
    state_payload = decode_state_token(state, expected_purpose=LINK_ACCOUNT_STATE_PURPOSE)
    result = complete_login(code, state, db, expected_purpose=LINK_ACCOUNT_STATE_PURPOSE)
    # Two ways in: an already-signed-in person adding an account, or a
    # personal sign-in that answered "yes, I have an organization account"
    # and so has no session yet.
    pending_email = state_payload.get("pending_personal_email")
    person_id = (
        person_for(result.member, db).id
        if pending_email
        else uuid.UUID(state_payload["person_id"])
    )
    try:
        if pending_email:
            attach_pending_personal_email(person_id, pending_email, db)
        else:
            link_account_to_person(person_id, result.member, db)
        outcome = "linked"
    except AccountAlreadyLinked:
        outcome = "already_linked"
    response = RedirectResponse(
        f"{settings.frontend_origin}?link={outcome}", status_code=status.HTTP_302_FOUND
    )
    set_session_cookies(response, result.access_token, result.refresh_token)
    # The pending personal signup is spent either way — no domainless org was
    # created for it, by design.
    response.delete_cookie(PENDING_PERSONAL_SIGNUP_COOKIE)
    remember_on_this_device(response, device_cookie, result.member, db)
    return response


def admin_proof_redirect(code: str, state: str, db: Session) -> RedirectResponse:
    """Back to the frontend with `?admin_proof=verified|not_verified|error`."""
    settings = get_settings()
    try:
        outcome = "verified" if complete_admin_proof(code, state, db).proven else "not_verified"
    except DirectoryLookupError as exc:
        # The check didn't run (e.g. Admin SDK API not enabled in the GCP
        # project) — log Google's reason so it can be fixed.
        logger.warning("auth.admin_proof_check_failed", error=str(exc))
        outcome = "error"
    return RedirectResponse(f"{settings.frontend_origin}?admin_proof={outcome}", status_code=status.HTTP_302_FOUND)


@router.get("/login")
def login() -> RedirectResponse:
    result = start_login()
    return RedirectResponse(result.authorization_url, status_code=status.HTTP_302_FOUND)


@router.get("/callback")
def login_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
    knohow_device: str | None = Cookie(default=None),
) -> RedirectResponse:
    settings = get_settings()
    try:
        # Signup shares this redirect URI with login (one GOOGLE_OAUTH_REDIRECT_URI),
        # so Google returns a signup here too — route it by its state purpose.
        purpose = peek_state_purpose(state)
        if purpose == SIGNUP_STATE_PURPOSE:
            return signup_redirect(complete_signup(code, state, db), knohow_device, db)
        if purpose == ADMIN_PROOF_STATE_PURPOSE:
            return admin_proof_redirect(code, state, db)
        if purpose == LINK_ACCOUNT_STATE_PURPOSE:
            return link_account_redirect(code, state, knohow_device, db)
        result = complete_login(code, state, db)
        needs_admin_proof = accept_invitations_on_sign_in(result.member, db)
    except InvalidOAuthState as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid or expired login state: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except MemberNotProvisioned as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"no Knohow account exists for {exc.email} yet — organization onboarding must add this "
            "member before they can log in",
        ) from exc

    response = RedirectResponse(
        ADMIN_PROOF_START_PATH if needs_admin_proof else settings.frontend_origin, status_code=status.HTTP_302_FOUND
    )
    set_session_cookies(response, result.access_token, result.refresh_token)
    remember_on_this_device(response, knohow_device, result.member, db)
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
    # DEVICE_COOKIE deliberately survives: after logging out the picker
    # should still offer the account ("pick up where you left off").
    for cookie_name in (ACCESS_COOKIE, REFRESH_COOKIE, PENDING_PERSONAL_SIGNUP_COOKIE):
        response.delete_cookie(cookie_name)
    return {"status": "logged_out"}


@router.get("/me")
def me(member: OrgMember = Depends(get_current_member), db: Session = Depends(get_db)) -> dict:
    return {
        "id": str(member.id),
        "organization_id": str(member.organization_id),
        "email": member.email,
        "display_name": member.display_name,
        "auth_type": member.auth_type.value,
        "standing": member.standing.value,
        "is_owner": is_owner(member.organization_id, member, db),
        "needs_org_setup": needs_org_setup(member, db),
        "is_super_admin": member.super_admin_verified_at is not None,
    }


@router.get("/remembered-accounts")
def remembered_accounts(
    db: Session = Depends(get_db), knohow_device: str | None = Cookie(default=None)
) -> dict:
    """Organizations this browser has signed in to, newest first — the Log In
    screen's picker. Signing in is signing in to an org (user, 2026-09-20), so
    a row is an org, not a person: two companies plus a personal org is three
    rows, each carrying the person's name as subtext. Unauthenticated on purpose: it runs *before*
    sign-in, and the device cookie is the only thing identifying the browser.
    It returns names and emails, so it stays limited to what this browser
    itself did; it never reveals an organization's members."""
    if not knohow_device:
        return {"organizations": []}
    try:
        device_id = uuid.UUID(knohow_device)
    except ValueError:
        return {"organizations": []}
    return {
        "organizations": [
            {
                "member_id": str(row.member_id),
                "organization_name": row.organization_name,
                "person_name": row.person_name,
                "email": row.email,
                "kind": row.kind,
                "linked_personal_emails": row.linked_personal_emails,
            }
            for row in list_remembered_orgs(device_id, db)
        ]
    }


@router.delete("/remembered-accounts")
def remove_remembered_accounts(
    response: Response, db: Session = Depends(get_db), knohow_device: str | None = Cookie(default=None)
) -> dict:
    """"Remove accounts" on the picker. Forgets every account on this
    browser and drops the device cookie, so the next sign-in starts a fresh
    device. Nothing about the members or their orgs changes."""
    removed = 0
    if knohow_device:
        try:
            removed = forget_device(uuid.UUID(knohow_device), db)
        except ValueError:
            removed = 0
    response.delete_cookie(DEVICE_COOKIE)
    return {"removed": removed}


@router.get("/link-account/start")
def link_account_start(member: OrgMember = Depends(get_current_member), db: Session = Depends(get_db)) -> RedirectResponse:
    """Adds another of this person's Google accounts. Identity linking is
    only ever done this way — by someone already signed in choosing to sign
    in again as themselves. Nothing is inferred from names or devices."""
    person_for(member, db)
    return RedirectResponse(start_link_account(member).authorization_url, status_code=status.HTTP_302_FOUND)


@router.get("/admin-proof/start")
def admin_proof_start(member: OrgMember = Depends(get_current_member)) -> RedirectResponse:
    """Full-page redirect: asks Google to confirm this member is a Super
    Admin of their org's Workspace domain."""
    return RedirectResponse(start_admin_proof(member).authorization_url, status_code=status.HTTP_302_FOUND)


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
