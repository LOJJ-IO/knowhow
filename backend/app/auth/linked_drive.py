"""Drive consent for personal accounts linked to a person (ADR-0025).

A person who has linked a personal Gmail to their work account can connect
that Gmail's Drive and see its files on their own Workspace screen. The
files are read live for that person only: never stored, never indexed, never
shown to anyone else. Links themselves are made elsewhere (ADR-0012); this
only ever reads addresses already proven to be the person's.
"""

import uuid
from dataclasses import dataclass

from google.oauth2 import credentials as user_credentials
from googleapiclient.discovery import Resource, build
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.auth.google_oauth import build_authorization_url, exchange_code_for_tokens, verify_id_token
from app.auth.pkce import build_state_token, decode_state_token, derive_code_challenge, generate_code_verifier
from app.config import get_settings
from app.google.scopes import PERSONAL_OAUTH_SCOPES
from app.models.linked_drive_credential import LinkedDriveCredential
from app.models.org_member import AuthType, OrgMember
from app.models.person_email import PersonEmail
from app.security.crypto import decrypt_refresh_token, encrypt_refresh_token

LINKED_DRIVE_STATE_PURPOSE = "linked_drive"


class NotLinked(ValueError):
    """The address isn't a personal account linked to this person."""


def linked_personal_emails(member: OrgMember, db: Session) -> list[str]:
    """Personal Google addresses linked to the caller's person, other than
    the account they're signed in with: bare linked addresses (PersonEmail)
    and the person's other personal-account memberships."""
    if member.person_id is None:
        return []
    emails = list(
        db.execute(
            select(PersonEmail.email)
            .where(PersonEmail.person_id == member.person_id)
            .order_by(PersonEmail.created_at)
        ).scalars()
    )
    emails += list(
        db.execute(
            select(func.lower(OrgMember.email)).where(
                OrgMember.person_id == member.person_id,
                OrgMember.auth_type == AuthType.PERSONAL_OAUTH,
                OrgMember.id != member.id,
            )
        ).scalars()
    )
    own = member.email.lower()
    return list(dict.fromkeys(e.lower() for e in emails if e.lower() != own))


def _require_linked(member: OrgMember, email: str, db: Session) -> str:
    normalized = email.strip().lower()
    if normalized not in linked_personal_emails(member, db):
        raise NotLinked(f"{normalized} is not a personal account linked to you")
    return normalized


@dataclass
class LinkedDriveStart:
    authorization_url: str
    state: str


def start_linked_drive_consent(member: OrgMember, email: str, db: Session) -> LinkedDriveStart:
    normalized = _require_linked(member, email, db)
    code_verifier = generate_code_verifier()
    state = build_state_token(
        code_verifier,
        purpose=LINKED_DRIVE_STATE_PURPOSE,
        extra={"member_id": str(member.id), "email": normalized},
    )
    url = build_authorization_url(
        PERSONAL_OAUTH_SCOPES,
        state=state,
        code_challenge=derive_code_challenge(code_verifier),
        access_type="offline",  # a refresh token, so the view keeps working
        prompt="consent",  # guarantees that refresh token on a re-grant
        login_hint=normalized,
    )
    return LinkedDriveStart(authorization_url=url, state=state)


def complete_linked_drive_consent(code: str, state: str, db: Session) -> LinkedDriveCredential:
    payload = decode_state_token(state, expected_purpose=LINKED_DRIVE_STATE_PURPOSE)
    member = db.get(OrgMember, uuid.UUID(payload["member_id"]))
    if member is None:
        raise ValueError("member no longer exists")
    email = _require_linked(member, payload["email"], db)

    tokens = exchange_code_for_tokens(code, payload["code_verifier"])
    claims = verify_id_token(tokens["id_token"])
    if claims["email"].lower() != email:
        raise ValueError(f"signed in with {claims['email']}, not {email}")
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        raise ValueError("Google did not return a refresh token")

    credential = db.execute(
        select(LinkedDriveCredential).where(LinkedDriveCredential.email == email)
    ).scalar_one_or_none()
    if credential is None:
        credential = LinkedDriveCredential(id=uuid.uuid4(), person_id=member.person_id, email=email)
        db.add(credential)
    credential.person_id = member.person_id
    credential.google_subject_id = claims["sub"]
    credential.scopes = PERSONAL_OAUTH_SCOPES
    credential.encrypted_refresh_token = encrypt_refresh_token(refresh_token)
    db.commit()
    db.refresh(credential)

    record_audit_entry(
        org_id=member.organization_id,
        actor_user_id=member.id,
        action_type="linked_drive.consent_granted",
        target_resource_id=str(member.person_id),
        # The address is the person's own and is shown only to them; the
        # audit entry records that a linked account was connected, not which.
        details={"scopes": PERSONAL_OAUTH_SCOPES},
        db=db,
    )
    return credential


def linked_drive_client(member: OrgMember, email: str, db: Session) -> Resource | None:
    """A Drive client for one of the caller's linked personal accounts, or
    None if that account hasn't been connected yet."""
    normalized = _require_linked(member, email, db)
    credential = db.execute(
        select(LinkedDriveCredential).where(
            LinkedDriveCredential.email == normalized,
            LinkedDriveCredential.person_id == member.person_id,
        )
    ).scalar_one_or_none()
    if credential is None:
        return None
    settings = get_settings()
    creds = user_credentials.Credentials(
        token=None,
        refresh_token=decrypt_refresh_token(credential.encrypted_refresh_token),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_oauth_client_id,
        client_secret=settings.google_oauth_client_secret,
        scopes=credential.scopes or PERSONAL_OAUTH_SCOPES,
    )
    return build("drive", "v3", credentials=creds)
