from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.google_oauth import build_authorization_url, exchange_code_for_tokens, verify_id_token
from app.auth.pkce import build_state_token, decode_state_token, derive_code_challenge, generate_code_verifier
from app.exceptions import MemberNotProvisioned
from app.google.scopes import LOGIN_SCOPES
from app.models.org_member import OrgMember
from app.security.jwt import issue_access_token, issue_refresh_token

LOGIN_STATE_PURPOSE = "login"


@dataclass
class LoginStart:
    authorization_url: str
    state: str


def start_login() -> LoginStart:
    """Google OAuth 2.0 is the sole login mechanism — no passwords, no local
    credential storage. Standard authorization code flow with PKCE."""
    code_verifier = generate_code_verifier()
    code_challenge = derive_code_challenge(code_verifier)
    # `access_type=online`: this is the identity/login flow only, it does not
    # need a refresh token — Drive access tokens (which do) are requested
    # separately via the personal-OAuth consent flow (app/auth/personal_oauth.py).
    state = build_state_token(code_verifier, purpose=LOGIN_STATE_PURPOSE)
    url = build_authorization_url(LOGIN_SCOPES, state=state, code_challenge=code_challenge, access_type="online")
    return LoginStart(authorization_url=url, state=state)


@dataclass
class LoginResult:
    member: OrgMember
    access_token: str
    refresh_token: str


def complete_login(code: str, state: str, db: Session, expected_purpose: str = LOGIN_STATE_PURPOSE) -> LoginResult:
    """expected_purpose lets the identity-linking flow reuse this: adding
    another account is an ordinary login that happens to carry a different
    state purpose (app/auth/identity.py)."""
    state_payload = decode_state_token(state, expected_purpose=expected_purpose)
    code_verifier = state_payload["code_verifier"]

    tokens = exchange_code_for_tokens(code, code_verifier)
    id_token_claims = verify_id_token(tokens["id_token"])

    email = id_token_claims["email"].lower()
    if not id_token_claims.get("email_verified"):
        raise MemberNotProvisioned(email)

    member = db.execute(
        select(OrgMember).where(func.lower(OrgMember.email) == email)
    ).scalar_one_or_none()

    if member is None:
        raise MemberNotProvisioned(email)

    access_token = issue_access_token(member.id, member.organization_id)
    refresh_token = issue_refresh_token(member.id, member.organization_id)
    return LoginResult(member=member, access_token=access_token, refresh_token=refresh_token)
