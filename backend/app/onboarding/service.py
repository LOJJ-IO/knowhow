import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.auth.delegation import initiate_delegation
from app.auth.google_oauth import build_authorization_url, exchange_code_for_tokens, verify_id_token
from app.auth.login import LoginResult
from app.auth.pkce import build_state_token, decode_state_token, derive_code_challenge, generate_code_verifier
from app.config import get_settings
from app.google.scopes import LOGIN_SCOPES
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.organization import Organization
from app.models.owner_confirmation import OwnerConfirmationToken
from app.security.jwt import issue_access_token, issue_refresh_token

# Common personal-email providers, used only as a heuristic default for a
# member's auth_type before an organization's Workspace domain has been
# confirmed via delegation. Never authoritative on its own — once
# Organization.verified_domain is set, domain match against it is what
# actually determines auth_type for new members (see add_member below).
_FREE_EMAIL_DOMAINS = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"}

OWNER_CONFIRMATION_TOKEN_TTL = timedelta(days=7)


def _email_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower()


def _infer_auth_type(email: str, org: Organization) -> AuthType:
    domain = _email_domain(email)
    if org.verified_domain is not None:
        return AuthType.DOMAIN_DELEGATED if domain == org.verified_domain.lower() else AuthType.PERSONAL_OAUTH
    return AuthType.PERSONAL_OAUTH if domain in _FREE_EMAIL_DOMAINS else AuthType.DOMAIN_DELEGATED


def add_member(
    org_id: uuid.UUID,
    email: str,
    display_name: str | None,
    added_by_member_id: uuid.UUID | None,
    db: Session,
) -> OrgMember:
    """Adds a member by email. Idempotent: re-adding an existing email
    returns the existing row rather than erroring, since the onboarding
    flow also uses this to ensure a designated owner has an identity to log
    in with before they've necessarily been "added" in the UI sense.

    Whether this member ends up domain_delegated or personal_oauth is
    determined by their email domain against the organization's verified
    domain (see _infer_auth_type) — a member whose domain doesn't match
    triggers the personal-OAuth consent path the first time they log in
    (see app/auth/personal_oauth.py); this function only decides which
    path they're on, it doesn't start the consent flow itself, since that
    requires the member's own interactive Google session.
    """
    org = db.get(Organization, org_id)
    if org is None:
        raise ValueError(f"no Organization with id={org_id}")

    normalized_email = email.lower()
    existing = db.execute(
        select(OrgMember).where(OrgMember.organization_id == org_id, func.lower(OrgMember.email) == normalized_email)
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    member = OrgMember(
        id=uuid.uuid4(),
        organization_id=org_id,
        email=email,
        display_name=display_name,
        auth_type=_infer_auth_type(email, org),
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=added_by_member_id,
        action_type="onboarding.member_added",
        target_resource_id=str(member.id),
        details={"email": email, "auth_type": member.auth_type.value},
        db=db,
    )
    return member


@dataclass
class OrgChartCreationResult:
    org_chart: OrgChart
    owner_confirmation_link_token: str | None = None


def create_org_chart(
    org_id: uuid.UUID,
    initiator_member_id: uuid.UUID,
    is_owner: bool,
    is_super_admin: bool,
    db: Session,
    owner_email: str | None = None,
) -> OrgChartCreationResult:
    """The first user to log in for a new organization initiates org chart
    creation, auto-approved as having created it. Two independent
    questions, deliberately not conflated (they are frequently different
    people): (a) are you at the top of the org chart (owner/CEO/ED)? — sets
    OrgChart.owner_member_id directly if yes, otherwise a single-use
    confirmation link must be sent to whoever is. (b) are you the Google
    Workspace super-admin for this domain? — only this kicks off domain-wide
    delegation (via the auth module's initiate_delegation, imported not
    duplicated). Any combination of yes/no is valid.
    """
    existing = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    if existing is not None:
        raise ValueError(f"organization {org_id} already has an org chart")

    initiator = db.get(OrgMember, initiator_member_id)
    if initiator is None:
        raise ValueError(f"no OrgMember with id={initiator_member_id}")

    org_chart = OrgChart(
        id=uuid.uuid4(),
        org_id=org_id,
        initiator_member_id=initiator_member_id,
        owner_member_id=initiator_member_id if is_owner else None,
    )
    db.add(org_chart)
    if is_owner:
        # Owner is self-declared (onboarding spec) — claiming it gives the
        # initiator standing; a proven Super Admin can reassign it later.
        initiator.standing = MemberStanding.APPROVED
    db.commit()
    db.refresh(org_chart)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=initiator_member_id,
        action_type="onboarding.org_chart_created",
        target_resource_id=str(org_chart.id),
        details={"is_owner": is_owner, "is_super_admin": is_super_admin},
        db=db,
    )

    token_value: str | None = None
    if not is_owner and owner_email:
        add_member(org_id, owner_email, None, initiator_member_id, db)
        token_value = generate_owner_confirmation_token(org_chart.id, owner_email, initiator_member_id, db)

    if is_super_admin:
        initiate_delegation(
            org_id=org_id,
            verified_domain=_email_domain(initiator.email),
            requested_by_member_id=initiator_member_id,
            db=db,
        )

    return OrgChartCreationResult(org_chart=org_chart, owner_confirmation_link_token=token_value)


def generate_owner_confirmation_token(
    org_chart_id: uuid.UUID, owner_email: str, actor_member_id: uuid.UUID, db: Session
) -> str:
    org_chart = db.get(OrgChart, org_chart_id)
    if org_chart is None:
        raise ValueError(f"no OrgChart with id={org_chart_id}")

    token_value = secrets.token_urlsafe(32)
    token = OwnerConfirmationToken(
        id=uuid.uuid4(),
        org_chart_id=org_chart_id,
        owner_email=owner_email,
        token=token_value,
        expires_at=datetime.now(timezone.utc) + OWNER_CONFIRMATION_TOKEN_TTL,
    )
    db.add(token)
    db.commit()

    # Sending the email itself is an infrastructure dependency (a transactional
    # email provider) out of scope for this module — the caller (API layer /
    # future notification service) is responsible for actually delivering a
    # link containing this token to owner_email.
    record_audit_entry(
        org_id=org_chart.org_id,
        actor_user_id=actor_member_id,
        action_type="onboarding.owner_confirmation_link_generated",
        target_resource_id=str(token.id),
        details={"owner_email": owner_email},
        db=db,
    )
    return token_value


def confirm_owner(token_value: str, db: Session) -> OrgChart:
    token = db.execute(
        select(OwnerConfirmationToken).where(OwnerConfirmationToken.token == token_value)
    ).scalar_one_or_none()
    if token is None:
        raise ValueError("invalid owner confirmation token")
    if token.consumed_at is not None:
        raise ValueError("owner confirmation token has already been used")
    if token.expires_at < datetime.now(timezone.utc):
        raise ValueError("owner confirmation token has expired")

    org_chart = db.get(OrgChart, token.org_chart_id)
    if org_chart is None:
        raise ValueError(f"no OrgChart with id={token.org_chart_id}")

    owner_member = db.execute(
        select(OrgMember).where(
            OrgMember.organization_id == org_chart.org_id, func.lower(OrgMember.email) == token.owner_email.lower()
        )
    ).scalar_one_or_none()
    if owner_member is None:
        raise ValueError(f"no OrgMember found for {token.owner_email}")

    org_chart.owner_member_id = owner_member.id
    owner_member.standing = MemberStanding.APPROVED
    token.consumed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org_chart)

    record_audit_entry(
        org_id=org_chart.org_id,
        actor_user_id=owner_member.id,
        action_type="onboarding.owner_confirmed",
        target_resource_id=str(org_chart.id),
        details={"owner_email": token.owner_email},
        db=db,
    )
    return org_chart


SIGNUP_STATE_PURPOSE = "signup"
PENDING_PERSONAL_SIGNUP_PURPOSE = "pending_personal_signup"
PENDING_PERSONAL_SIGNUP_TTL = timedelta(minutes=15)


@dataclass
class SignupStart:
    authorization_url: str
    state: str


def start_signup(switch_account: bool = False) -> SignupStart:
    """Google OAuth, same as app/auth/login.py's login flow (same scopes,
    same PKCE primitives — imported, not reimplemented) but with its own
    state purpose, so the callback knows a brand-new Organization/OrgMember
    may need to be created rather than requiring one to already exist.

    switch_account forces Google's account chooser — used when someone who
    signed in with a personal account says their company uses Workspace and
    goes back to sign in with their work account instead."""
    code_verifier = generate_code_verifier()
    code_challenge = derive_code_challenge(code_verifier)
    state = build_state_token(code_verifier, purpose=SIGNUP_STATE_PURPOSE)
    url = build_authorization_url(
        LOGIN_SCOPES,
        state=state,
        code_challenge=code_challenge,
        access_type="online",
        prompt="select_account" if switch_account else None,
    )
    return SignupStart(authorization_url=url, state=state)


@dataclass
class SignupResult:
    """Exactly one of the two is set. `login` — the person now has a member
    row and a session. `pending_personal_token` — a personal Google account
    with no org yet: nothing was created, and the frontend must ask whether
    their company uses Workspace before create_domainless_org runs."""

    login: LoginResult | None = None
    pending_personal_token: str | None = None


def _login_result(member: OrgMember) -> LoginResult:
    return LoginResult(
        member=member,
        access_token=issue_access_token(member.id, member.organization_id),
        refresh_token=issue_refresh_token(member.id, member.organization_id),
    )


def complete_signup(code: str, state: str, db: Session) -> SignupResult:
    """The domain check (onboarding spec, "Domain check = two independent
    checks"): (1) Google's `hd` claim on the verified ID token says whether
    this is a Workspace account — never the email string; (2) for a Workspace
    account, whether Knohow already has an org for that domain."""
    state_payload = decode_state_token(state, expected_purpose=SIGNUP_STATE_PURPOSE)
    tokens = exchange_code_for_tokens(code, state_payload["code_verifier"])
    id_token_claims = verify_id_token(tokens["id_token"])

    email = id_token_claims["email"].lower()
    if not id_token_claims.get("email_verified"):
        raise ValueError("Google account email is not verified")

    # Org-agnostic lookup (same as app/auth/login.py::complete_login) — if
    # this email already has an OrgMember somewhere, signing up is just a
    # login, not a second bootstrap.
    member = db.execute(select(OrgMember).where(func.lower(OrgMember.email) == email)).scalar_one_or_none()
    if member is not None:
        return SignupResult(login=_login_result(member))

    hosted_domain = id_token_claims.get("hd")
    if not hosted_domain:
        return SignupResult(
            pending_personal_token=issue_pending_personal_signup_token(email, id_token_claims.get("name"))
        )

    member = join_or_create_domain_org(email, id_token_claims.get("name"), hosted_domain.lower(), db)
    return SignupResult(login=_login_result(member))


def join_or_create_domain_org(email: str, display_name: str | None, hosted_domain: str, db: Session) -> OrgMember:
    """One active org per observed domain (ADR-0006). A later signup with the
    same `hd` joins the existing org as auto-affiliated — evidence only, no
    standing — and is never given a second org. The first signup creates the
    org unbound (verified_domain stays null until admin proof) and is itself
    auto-affiliated: the first joiner is only the first claimant, not a role.
    They gain standing by claiming ownership (create_org_chart) or when the
    nominated owner approves them."""
    org = db.execute(
        select(Organization).where(
            (Organization.observed_domain == hosted_domain) | (Organization.verified_domain == hosted_domain)
        )
    ).scalar_one_or_none()

    created_org = org is None
    if created_org:
        org = Organization(id=uuid.uuid4(), name=hosted_domain, observed_domain=hosted_domain, verified_domain=None)
        db.add(org)

    member = OrgMember(
        id=uuid.uuid4(),
        organization_id=org.id,
        email=email,
        display_name=display_name,
        # Google vouched for this account's membership of hosted_domain, so
        # it is eligible for the delegated path once delegation exists.
        auth_type=AuthType.DOMAIN_DELEGATED,
        standing=MemberStanding.AUTO_AFFILIATED,
    )
    db.add(member)
    # Org and first member in one transaction — a failure can't leave an
    # org with no members behind.
    db.commit()
    db.refresh(member)

    if created_org:
        record_audit_entry(
            org_id=org.id,
            actor_user_id=member.id,
            action_type="onboarding.domain_org_created",
            target_resource_id=str(org.id),
            details={"observed_domain": hosted_domain},
            db=db,
        )
    record_audit_entry(
        org_id=org.id,
        actor_user_id=member.id,
        action_type="onboarding.member_auto_affiliated",
        target_resource_id=str(member.id),
        details={"email": email, "observed_domain": hosted_domain},
        db=db,
    )
    return member


def issue_pending_personal_signup_token(email: str, display_name: str | None) -> str:
    """A short-lived signed record of a verified personal Google identity
    that has no org yet, so the question "does your company use Workspace?"
    can be asked without creating anything first."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "purpose": PENDING_PERSONAL_SIGNUP_PURPOSE,
        "email": email,
        "name": display_name,
        "iat": now,
        "exp": now + PENDING_PERSONAL_SIGNUP_TTL,
    }
    return jwt.encode(payload, settings.jwt_signing_key, algorithm=settings.jwt_algorithm)


def decode_pending_personal_signup_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_signing_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError(f"invalid or expired personal signup: {exc}") from exc
    if payload.get("purpose") != PENDING_PERSONAL_SIGNUP_PURPOSE:
        raise ValueError("invalid personal signup token")
    return payload


def create_domainless_org(pending_token: str, db: Session) -> LoginResult:
    """The "No / just me" answer for a personal Google account: a domainless
    org with exactly one owner, the creator. A person can't hold two — the
    email lookup below turns a repeat into a login."""
    payload = decode_pending_personal_signup_token(pending_token)
    email = payload["email"]

    existing = db.execute(select(OrgMember).where(func.lower(OrgMember.email) == email)).scalar_one_or_none()
    if existing is not None:
        return _login_result(existing)

    org = Organization(id=uuid.uuid4(), name=payload.get("name") or email, observed_domain=None, verified_domain=None)
    member = OrgMember(
        id=uuid.uuid4(),
        organization_id=org.id,
        email=email,
        display_name=payload.get("name"),
        auth_type=AuthType.PERSONAL_OAUTH,
        standing=MemberStanding.APPROVED,
    )
    org_chart = OrgChart(id=uuid.uuid4(), org_id=org.id, initiator_member_id=member.id, owner_member_id=member.id)
    db.add(org)
    db.flush()
    db.add(member)
    db.flush()
    db.add(org_chart)
    db.commit()
    db.refresh(member)

    record_audit_entry(
        org_id=org.id,
        actor_user_id=member.id,
        action_type="onboarding.domainless_org_created",
        target_resource_id=str(org.id),
        details={"email": email},
        db=db,
    )
    return _login_result(member)


def is_founding_member(org_id: uuid.UUID, member_id: uuid.UUID, db: Session) -> bool:
    first = db.execute(
        select(OrgMember.id)
        .where(OrgMember.organization_id == org_id)
        .order_by(OrgMember.created_at, OrgMember.id)
        .limit(1)
    ).scalar_one_or_none()
    return first == member_id


def approve_member(org_id: uuid.UUID, approver: OrgMember, target_member_id: uuid.UUID, db: Session) -> OrgMember:
    """Owner approves an auto-affiliated member (onboarding spec, "Approving
    auto-joined members"). A proven Super Admin may approve too once admin
    proof exists — not built yet, so only the owner can today."""
    org_chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    if org_chart is None or org_chart.owner_member_id != approver.id:
        raise PermissionError("only the organization's owner can approve members")

    target = db.get(OrgMember, target_member_id)
    if target is None or target.organization_id != org_id:
        raise ValueError(f"no member {target_member_id} in organization {org_id}")
    if target.standing == MemberStanding.APPROVED:
        return target

    target.standing = MemberStanding.APPROVED
    db.commit()
    db.refresh(target)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=approver.id,
        action_type="onboarding.member_approved",
        target_resource_id=str(target.id),
        details={"email": target.email},
        db=db,
    )
    return target
