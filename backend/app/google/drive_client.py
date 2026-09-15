import json
import uuid

from google.oauth2 import credentials as user_credentials
from google.oauth2 import service_account
from googleapiclient.discovery import Resource, build
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.exceptions import CrossOrgAccessDenied, DelegationNotApproved, PersonalAccountNotConsented
from app.google.scopes import DOMAIN_DELEGATION_SCOPES, PERSONAL_OAUTH_SCOPES
from app.models.delegation_grant import DelegationStatus
from app.models.org_member import AuthType, OrgMember
from app.security.crypto import decrypt_refresh_token


def load_service_account_info() -> dict:
    raw = get_settings().google_service_account_json
    stripped = raw.strip()
    if stripped.startswith("{"):
        return json.loads(stripped)
    with open(raw, encoding="utf-8") as f:
        return json.load(f)


def _resolve_member(user_id: uuid.UUID, db: Session) -> OrgMember:
    member = db.get(OrgMember, user_id)
    if member is None:
        raise ValueError(f"no OrgMember with id={user_id}")
    return member


def is_domain_member(user_id: uuid.UUID, db: Session | None = None) -> bool:
    owns_session = db is None
    session = db or SessionLocal()
    try:
        member = _resolve_member(user_id, session)
        return member.auth_type == AuthType.DOMAIN_DELEGATED
    finally:
        if owns_session:
            session.close()


def _domain_delegated_client(member: OrgMember, db: Session) -> Resource:
    grant = member.organization.delegation_grant

    # Enforced here, not by convention: a request for this member is only ever
    # allowed to impersonate a user inside THIS member's own organization's
    # verified domain. There is no code path in this function that accepts an
    # org id or domain from anywhere other than the member's own row.
    if grant is None or grant.status != DelegationStatus.APPROVED:
        raise DelegationNotApproved(
            f"organization {member.organization_id} does not have approved domain-wide delegation"
        )

    member_domain = member.email.rsplit("@", 1)[-1].lower()
    if member_domain != grant.verified_domain.lower():
        # A domain_delegated member whose email domain doesn't match their own
        # org's approved delegation domain indicates a data integrity bug, not
        # a normal runtime case — fail loudly rather than impersonate anyway.
        raise CrossOrgAccessDenied(
            f"member {member.id} email domain {member_domain!r} does not match "
            f"organization {member.organization_id}'s verified domain {grant.verified_domain!r}"
        )

    info = load_service_account_info()
    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=DOMAIN_DELEGATION_SCOPES
    )
    # Impersonation subject is always the requested member's own email, inside
    # their own org's verified domain — this is what makes cross-org
    # impersonation structurally impossible, not just policy.
    delegated_credentials = credentials.with_subject(member.email)
    return build("drive", "v3", credentials=delegated_credentials)


def _personal_oauth_client(member: OrgMember, db: Session) -> Resource:
    if member.oauth_credential is None:
        raise PersonalAccountNotConsented(str(member.id))

    settings = get_settings()
    refresh_token = decrypt_refresh_token(member.oauth_credential.encrypted_refresh_token)
    creds = user_credentials.Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_oauth_client_id,
        client_secret=settings.google_oauth_client_secret,
        scopes=member.oauth_credential.scopes or PERSONAL_OAUTH_SCOPES,
    )
    return build("drive", "v3", credentials=creds)


def get_drive_client_for_user(user_id: uuid.UUID, db: Session | None = None) -> Resource:
    """Single entry point for obtaining an authenticated Drive client for a
    member, routed by their auth_type. Domain members go through service
    account impersonation (scoped to their own org's verified domain only);
    personal-account members go through their stored, individually-consented
    OAuth token. Raises PersonalAccountNotConsented rather than silently
    falling back to delegation when a personal-account member hasn't
    consented yet — delegation cannot reach a personal Gmail account at all,
    so a silent fallback would be a security bug, not a convenience.
    """
    owns_session = db is None
    session = db or SessionLocal()
    try:
        member = _resolve_member(user_id, session)
        if member.auth_type == AuthType.DOMAIN_DELEGATED:
            return _domain_delegated_client(member, session)
        return _personal_oauth_client(member, session)
    finally:
        if owns_session:
            session.close()
