import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.auth.google_oauth import build_authorization_url, exchange_code_for_tokens, verify_id_token
from app.auth.pkce import build_state_token, decode_state_token, derive_code_challenge, generate_code_verifier
from app.google.scopes import PERSONAL_OAUTH_SCOPES
from app.models.oauth_credential import OAuthCredential
from app.models.org_member import OrgMember
from app.security.crypto import encrypt_refresh_token

PERSONAL_OAUTH_STATE_PURPOSE = "personal_oauth"


@dataclass
class PersonalOAuthStart:
    authorization_url: str
    state: str


def start_personal_oauth_consent(member: OrgMember) -> PersonalOAuthStart:
    """Individual consent flow for personal-account members, triggered
    (by the org-engine module) when a member's email domain does not match
    the organization's verified Workspace domain — domain-wide delegation
    cannot reach a personal Gmail account, so each such member must grant
    Knohow access to their own Drive directly.

    Note (see docs/gcp-setup.md): this path uses Google's external OAuth
    consent screen and is subject to an unverified-app 100-user cap until
    Google's verification review completes, since it requests the
    restricted `drive` scope. Domain-delegated members are NOT subject to
    this cap — delegation is authorized once in the Admin console, not per
    user through this screen.
    """
    code_verifier = generate_code_verifier()
    code_challenge = derive_code_challenge(code_verifier)
    state = build_state_token(
        code_verifier, purpose=PERSONAL_OAUTH_STATE_PURPOSE, extra={"member_id": str(member.id)}
    )
    url = build_authorization_url(
        PERSONAL_OAUTH_SCOPES,
        state=state,
        code_challenge=code_challenge,
        access_type="offline",  # required to receive a refresh token
        prompt="consent",  # forces the consent screen even on re-grant, guaranteeing a refresh token
        login_hint=member.email,
    )
    return PersonalOAuthStart(authorization_url=url, state=state)


def complete_personal_oauth_consent(code: str, state: str, db: Session) -> OAuthCredential:
    state_payload = decode_state_token(state, expected_purpose=PERSONAL_OAUTH_STATE_PURPOSE)
    member_id = uuid.UUID(state_payload["member_id"])
    member = db.get(OrgMember, member_id)
    if member is None:
        raise ValueError(f"no OrgMember with id={member_id}")

    tokens = exchange_code_for_tokens(code, state_payload["code_verifier"])
    id_token_claims = verify_id_token(tokens["id_token"])

    if id_token_claims["email"].lower() != member.email.lower():
        raise ValueError("Google account used for consent does not match the member's registered email")

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        raise ValueError(
            "Google did not return a refresh token; the consent screen must be re-shown with "
            "prompt=consent (already set) — this indicates an unexpected OAuth response, not a "
            "normal re-consent"
        )

    credential = member.oauth_credential
    if credential is None:
        credential = OAuthCredential(
            id=uuid.uuid4(),
            member_id=member.id,
            google_subject_id=id_token_claims["sub"],
            scopes=PERSONAL_OAUTH_SCOPES,
            encrypted_refresh_token=encrypt_refresh_token(refresh_token),
        )
        db.add(credential)
    else:
        credential.google_subject_id = id_token_claims["sub"]
        credential.scopes = PERSONAL_OAUTH_SCOPES
        credential.encrypted_refresh_token = encrypt_refresh_token(refresh_token)

    db.commit()
    db.refresh(credential)

    record_audit_entry(
        org_id=member.organization_id,
        actor_user_id=member.id,
        action_type="personal_oauth.consent_granted",
        target_resource_id=str(member.id),
        details={"scopes": PERSONAL_OAUTH_SCOPES},
        db=db,
    )

    return credential
