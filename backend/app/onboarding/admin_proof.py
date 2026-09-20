import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.auth.delegation import initiate_delegation
from app.auth.google_oauth import build_authorization_url, exchange_code_for_tokens, verify_id_token
from app.auth.pkce import build_state_token, decode_state_token, derive_code_challenge, generate_code_verifier
from app.google.directory import is_super_admin
from app.google.scopes import ADMIN_PROOF_SCOPES
from app.models.org_member import MemberStanding, OrgMember
from app.models.organization import Organization
from app.onboarding.service import consume_super_admin_invitations

ADMIN_PROOF_STATE_PURPOSE = "admin_proof"


@dataclass
class AdminProofStart:
    authorization_url: str
    state: str


def start_admin_proof(member: OrgMember) -> AdminProofStart:
    """Sends the member back to Google to grant one read-only Directory
    permission, so Knohow can ask Google whether they're a Super Admin. Runs
    when they answer "Yes" to the Super Admin question, or from a "verify I'm
    the Workspace admin" action — never silently at sign-in, since Google
    asks the person to approve the extra permission."""
    code_verifier = generate_code_verifier()
    code_challenge = derive_code_challenge(code_verifier)
    state = build_state_token(code_verifier, purpose=ADMIN_PROOF_STATE_PURPOSE, extra={"member_id": str(member.id)})
    url = build_authorization_url(
        ADMIN_PROOF_SCOPES,
        state=state,
        code_challenge=code_challenge,
        access_type="online",
        login_hint=member.email,
    )
    return AdminProofStart(authorization_url=url, state=state)


@dataclass
class AdminProofResult:
    member: OrgMember
    proven: bool


def complete_admin_proof(code: str, state: str, db: Session) -> AdminProofResult:
    state_payload = decode_state_token(state, expected_purpose=ADMIN_PROOF_STATE_PURPOSE)
    member = db.get(OrgMember, uuid.UUID(state_payload["member_id"]))
    if member is None:
        raise ValueError("member no longer exists")

    tokens = exchange_code_for_tokens(code, state_payload["code_verifier"])
    claims = verify_id_token(tokens["id_token"])
    if claims["email"].lower() != member.email.lower():
        raise ValueError("signed in with a different Google account than the one being verified")

    org = db.get(Organization, member.organization_id)
    org_domain = org.verified_domain or org.observed_domain
    hosted_domain = (claims.get("hd") or "").lower()

    # The account must belong to this org's Workspace, and Google must say
    # it's a Super Admin there. The access token is used for this one call
    # and never stored.
    proven = bool(org_domain) and hosted_domain == org_domain and is_super_admin(tokens["access_token"], member.email)

    if not proven:
        record_audit_entry(
            org_id=org.id,
            actor_user_id=member.id,
            action_type="onboarding.super_admin_not_proven",
            target_resource_id=str(member.id),
            details={"hosted_domain": hosted_domain or None, "org_domain": org_domain},
            db=db,
        )
        return AdminProofResult(member=member, proven=False)

    member.super_admin_verified_at = datetime.now(timezone.utc)
    member.standing = MemberStanding.APPROVED
    bound_domain = False
    if org.verified_domain is None:
        taken = db.execute(
            select(Organization.id).where(Organization.verified_domain == hosted_domain, Organization.id != org.id)
        ).first()
        if taken is None:
            org.verified_domain = hosted_domain
            bound_domain = True
    db.commit()
    db.refresh(member)
    consume_super_admin_invitations(member, db)

    record_audit_entry(
        org_id=org.id,
        actor_user_id=member.id,
        action_type="onboarding.super_admin_verified",
        target_resource_id=str(member.id),
        details={"domain": hosted_domain, "domain_bound": bound_domain},
        db=db,
    )
    # Delegation setup starts on proof, with the domain Google reported —
    # never from a self-declared answer or the email string.
    initiate_delegation(org_id=org.id, verified_domain=hosted_domain, requested_by_member_id=member.id, db=db)
    return AdminProofResult(member=member, proven=True)
