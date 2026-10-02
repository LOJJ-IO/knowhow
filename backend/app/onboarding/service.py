import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.sandbox import is_sandbox_org
from app.activity.changes import team_changes
from app.audit.service import record_audit_entry
from app.auth.google_oauth import build_authorization_url, exchange_code_for_tokens, verify_id_token
from app.auth.login import LoginResult
from app.auth.pkce import build_state_token, decode_state_token, derive_code_challenge, generate_code_verifier
from app.config import get_settings
from app.google.scopes import LOGIN_SCOPES
from app.models.join_link import JoinLink
from app.models.invitation import Invitation, InvitationKind
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.organization import Organization
from app.models.team import Team
from app.models.team_join_request import TeamJoinRequest, TeamJoinRequestStatus
from app.security.jwt import issue_access_token, issue_refresh_token

# Common personal-email providers, used only as a heuristic default for a
# member's auth_type before an organization's Workspace domain has been
# confirmed via delegation. Never authoritative on its own — once
# Organization.verified_domain is set, domain match against it is what
# actually determines auth_type for new members (see add_member below).
_FREE_EMAIL_DOMAINS = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"}

INVITATION_TTL = timedelta(days=7)


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
    standing: MemberStanding = MemberStanding.APPROVED,
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
        standing=standing,
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
    owner_invitation: Invitation | None = None
    super_admin_invitation: Invitation | None = None


def create_org_chart(
    org_id: uuid.UUID,
    initiator_member_id: uuid.UUID,
    is_owner: bool,
    is_super_admin: bool,
    db: Session,
    owner_email: str | None = None,
    super_admin_email: str | None = None,
) -> OrgChartCreationResult:
    """Founder creates the org chart to unlock setup (ADR-0021). Founder ≠ owner:
    calling with is_owner=False leaves owner_member_id unset until an owner invite
    is accepted or someone claims owner. is_super_admin is only a nomination/
    routing hint — Google admin proof grants Super Admin, never this flag.
    Idempotent: if a chart already exists, return it (setup may call this on
    resume without re-asking ownership).
    """
    existing = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    if existing is not None:
        return OrgChartCreationResult(org_chart=existing)

    initiator = db.get(OrgMember, initiator_member_id)
    if initiator is None:
        raise ValueError(f"no OrgMember with id={initiator_member_id}")
    if owner_email and owner_email.lower() == initiator.email.lower():
        # Naming yourself as the owner is saying "yes, I'm the owner".
        is_owner, owner_email = True, None

    org_chart = OrgChart(
        id=uuid.uuid4(),
        org_id=org_id,
        initiator_member_id=initiator_member_id,
        owner_member_id=initiator_member_id if is_owner else None,
        nominated_super_admin_email=None if is_super_admin else super_admin_email,
    )
    db.add(org_chart)
    # The founder starts the org, so nobody is above them to approve them
    # (ADR-0021: founder is not the owner, but is never left waiting).
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

    owner_invitation = None
    if not is_owner and owner_email:
        owner_invitation = create_invitation(org_id, InvitationKind.OWNER, owner_email, initiator, db)

    # is_super_admin is self-declared, so it only routes the flow: the
    # frontend follows a "yes" with admin proof (app/onboarding/admin_proof.py),
    # which is what starts delegation setup once Google confirms it. Both
    # nominations are made at once so the two waits run in parallel.
    super_admin_invitation = None
    if not is_super_admin and super_admin_email:
        super_admin_invitation = create_invitation(org_id, InvitationKind.SUPER_ADMIN, super_admin_email, initiator, db)

    return OrgChartCreationResult(
        org_chart=org_chart, owner_invitation=owner_invitation, super_admin_invitation=super_admin_invitation
    )


# What the lifetime pills on the "How long should the link work?" screen mean.
# `None` is "No end date" — an explicit choice, never a default.
JOIN_LINK_LIFETIMES: dict[str, int | None] = {
    "24h": 1,
    "7d": 7,
    "30d": 30,
    "forever": None,
}


def join_link_url(link: JoinLink) -> str:
    return f"{get_settings().frontend_origin}/join/{link.token}"


def resolve_join_link_preview(token: str, db: Session) -> dict:
    """Public metadata for a join link — used by the frontend's Open Graph
    tags and the sign-in screen when someone arrives on the link. Deliberately
    exposes only the org name and domain, never member data."""
    link = db.execute(select(JoinLink).where(JoinLink.token == token)).scalar_one_or_none()
    # The sales sandbox can make links, but nobody real can arrive through one.
    if link is None or is_sandbox_org(link.organization_id):
        raise ValueError("join link not found")

    org = db.get(Organization, link.organization_id)
    if org is None:
        raise ValueError("join link not found")

    now = datetime.now(timezone.utc)
    alive = link.revoked_at is None and (link.expires_at is None or link.expires_at > now)
    locked = alive and link.locked_at is not None
    valid = alive and not locked
    domain = org.observed_domain or org.verified_domain

    if locked:
        title = "This invite link is locked"
        description = "Ask whoever sent it to unlock it."
    elif valid:
        title = f"Join {org.name} on Knohow"
        description = (
            f"Sign in with your {domain} account to get started."
            if domain
            else f"Use this link to join {org.name} on Knohow."
        )
    else:
        title = "This invite link has expired"
        description = "Ask whoever sent it for a new one."

    return {
        "organization_name": org.name,
        "organization_domain": domain,
        "valid": valid,
        "title": title,
        "description": description,
    }


def create_join_link(org_id: uuid.UUID, lifetime: str, actor: OrgMember, db: Session) -> JoinLink:
    """Mints the org's join link, replacing whatever was live before.

    Issuing a new link **revokes the old one** rather than leaving two in
    circulation: the owner's mental model is "the link", singular, and a
    forgotten second link is exactly the leak this is supposed to avoid.
    People who already joined are unaffected ([[0014-org-setup-and-join-link]])."""
    if lifetime not in JOIN_LINK_LIFETIMES:
        raise ValueError(f"unknown link lifetime: {lifetime}")
    _require_join_link_role(org_id, actor, db)

    now = datetime.now(timezone.utc)
    for live in db.execute(
        select(JoinLink).where(JoinLink.organization_id == org_id, JoinLink.revoked_at.is_(None))
    ).scalars():
        live.revoked_at = now

    days = JOIN_LINK_LIFETIMES[lifetime]
    link = JoinLink(
        id=uuid.uuid4(),
        organization_id=org_id,
        token=secrets.token_urlsafe(32),
        created_by_member_id=actor.id,
        expires_at=None if days is None else now + timedelta(days=days),
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="onboarding.join_link.created",
        target_resource_id=str(link.id),
        details={"lifetime": lifetime},
        db=db,
    )
    return link


def live_join_link(org_id: uuid.UUID, actor: OrgMember, db: Session) -> JoinLink | None:
    """The org's current join link, if one is live — so setup can put the
    founder back on the copy screen with the link they already made instead
    of minting (and revoking) another."""
    _require_join_link_role(org_id, actor, db)
    now = datetime.now(timezone.utc)
    return db.execute(
        select(JoinLink)
        .where(
            JoinLink.organization_id == org_id,
            JoinLink.revoked_at.is_(None),
            or_(JoinLink.expires_at.is_(None), JoinLink.expires_at > now),
        )
        .order_by(JoinLink.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def revoke_join_link(org_id: uuid.UUID, actor: OrgMember, db: Session) -> int:
    """Kills the org's live link. People already in stay in."""
    _require_join_link_role(org_id, actor, db)
    now = datetime.now(timezone.utc)
    killed = 0
    for live in db.execute(
        select(JoinLink).where(JoinLink.organization_id == org_id, JoinLink.revoked_at.is_(None))
    ).scalars():
        live.revoked_at = now
        killed += 1
    db.commit()
    if killed:
        record_audit_entry(
            org_id=org_id,
            actor_user_id=actor.id,
            action_type="onboarding.join_link.revoked",
            target_resource_id=str(org_id),
            details={"count": killed},
            db=db,
        )
    return killed


def set_join_link_locked(org_id: uuid.UUID, locked: bool, actor: OrgMember, db: Session) -> JoinLink:
    """Locks or unlocks the org's current link. Locking stops it letting anyone
    in without replacing it, so unlocking brings back the same link people
    already have. Nothing to lock (no live link) is an error."""
    _require_join_link_role(org_id, actor, db)
    now = datetime.now(timezone.utc)
    link = next(
        iter(
            db.execute(
                select(JoinLink)
                .where(
                    JoinLink.organization_id == org_id,
                    JoinLink.revoked_at.is_(None),
                    or_(JoinLink.expires_at.is_(None), JoinLink.expires_at > now),
                )
                .order_by(JoinLink.created_at.desc())
                .limit(1)
            ).scalars()
        ),
        None,
    )
    if link is None:
        raise ValueError("there is no live join link")
    if (link.locked_at is not None) == locked:
        return link
    link.locked_at = now if locked else None
    db.commit()
    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="onboarding.join_link.locked" if locked else "onboarding.join_link.unlocked",
        target_resource_id=str(link.id),
        details={},
        db=db,
    )
    return link


def invite_url(invitation: Invitation) -> str:
    return f"{get_settings().frontend_origin}/?invite={invitation.token}"


def create_invitation(
    org_id: uuid.UUID, kind: InvitationKind, email: str | None, actor: OrgMember, db: Session
) -> Invitation:
    """A forwardable nomination link. Re-nominating the same person returns
    their live invitation instead of minting another. `email=None` (Super
    Admin only) is the open admin link — one live per org."""
    if email is None and kind != InvitationKind.SUPER_ADMIN:
        raise ValueError("only a Super Admin link can be open (no email)")
    email = email.lower() if email else None
    now = datetime.now(timezone.utc)
    existing = db.execute(
        select(Invitation).where(
            Invitation.organization_id == org_id,
            Invitation.kind == kind,
            Invitation.email.is_(None) if email is None else Invitation.email == email,
            Invitation.consumed_at.is_(None),
            Invitation.expires_at > now,
        )
    ).scalars().first()
    if existing is not None:
        return existing

    if kind == InvitationKind.OWNER:
        # Limited until they sign in as that account and become owner.
        add_member(org_id, email, None, actor.id, db, standing=MemberStanding.AUTO_AFFILIATED)

    invitation = Invitation(
        id=uuid.uuid4(),
        organization_id=org_id,
        kind=kind,
        email=email,
        token=secrets.token_urlsafe(32),
        created_by_member_id=actor.id,
        expires_at=now + INVITATION_TTL,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="onboarding.invitation_created",
        target_resource_id=str(invitation.id),
        details={"kind": kind.value, "email": email},
        db=db,
    )
    return invitation


def find_invitation(token: str, db: Session) -> Invitation | None:
    invitation = db.execute(select(Invitation).where(Invitation.token == token)).scalar_one_or_none()
    if invitation is not None and is_sandbox_org(invitation.organization_id):
        return None
    if invitation is None or invitation.consumed_at is not None or invitation.expires_at <= datetime.now(timezone.utc):
        return None
    return invitation


def _pending_invitations_for(member: OrgMember, kind: InvitationKind, db: Session) -> list[Invitation]:
    return list(
        db.execute(
            select(Invitation).where(
                Invitation.organization_id == member.organization_id,
                Invitation.kind == kind,
                Invitation.email == member.email.lower(),
                Invitation.consumed_at.is_(None),
                Invitation.expires_at > datetime.now(timezone.utc),
            )
        ).scalars()
    )


def accept_invitations_on_sign_in(member: OrgMember, db: Session) -> bool:
    """Invitations are accepted by signing in *as* the invited account —
    proof of that account, which holding a forwarded link can't give. An
    owner invitation makes them owner now. A Super Admin invitation can't be
    accepted on sign-in (Super Admin is Google's to prove), so this returns
    True to send them straight to admin proof."""
    now = datetime.now(timezone.utc)
    for invitation in _pending_invitations_for(member, InvitationKind.OWNER, db):
        org_chart = db.execute(select(OrgChart).where(OrgChart.org_id == member.organization_id)).scalar_one_or_none()
        invitation.consumed_at = now
        if org_chart is None or org_chart.owner_member_id is not None:
            continue  # nothing to accept any more — ownership was settled another way
        org_chart.owner_member_id = member.id
        member.standing = MemberStanding.APPROVED
        db.commit()
        record_audit_entry(
            org_id=member.organization_id,
            actor_user_id=member.id,
            action_type="onboarding.owner_confirmed",
            target_resource_id=str(org_chart.id),
            details={"owner_email": member.email, "invitation_id": str(invitation.id)},
            db=db,
        )
    db.commit()
    db.refresh(member)
    return member.super_admin_verified_at is None and bool(
        _pending_invitations_for(member, InvitationKind.SUPER_ADMIN, db)
    )


def consume_super_admin_invitations(member: OrgMember, db: Session) -> None:
    """Called once admin proof succeeds for this member: their own Super
    Admin invitations and the org's open admin link are done."""
    open_links = db.execute(
        select(Invitation).where(
            Invitation.organization_id == member.organization_id,
            Invitation.kind == InvitationKind.SUPER_ADMIN,
            Invitation.email.is_(None),
            Invitation.consumed_at.is_(None),
        )
    ).scalars()
    for invitation in [*_pending_invitations_for(member, InvitationKind.SUPER_ADMIN, db), *open_links]:
        invitation.consumed_at = datetime.now(timezone.utc)
    db.commit()


def list_invitations(org_id: uuid.UUID, requester: OrgMember, db: Session) -> list[Invitation]:
    _require_setup_role(org_id, requester, db)
    return list(
        db.execute(
            select(Invitation)
            .where(
                Invitation.organization_id == org_id,
                Invitation.consumed_at.is_(None),
                Invitation.expires_at > datetime.now(timezone.utc),
            )
            .order_by(Invitation.created_at)
        ).scalars()
    )


def invite_to_org(
    org_id: uuid.UUID, requester: OrgMember, kind: InvitationKind, email: str | None, db: Session
) -> Invitation:
    """Nominate the owner or Super Admin after setup — e.g. "I don't know"
    at first, found out later."""
    _require_setup_role(org_id, requester, db)
    if kind == InvitationKind.OWNER:
        org_chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
        if org_chart is not None and org_chart.owner_member_id is not None:
            raise ValueError("this organization already has an owner")
    return create_invitation(org_id, kind, email, requester, db)


def _require_setup_role(org_id: uuid.UUID, member: OrgMember, db: Session) -> None:
    """The founding member (even while limited — they're the one chasing the
    owner and admin), the owner, or a verified Super Admin."""
    if member.organization_id != org_id:
        raise PermissionError("not a member of this organization")
    if not (
        is_founding_member(org_id, member.id, db)
        or is_owner(org_id, member, db)
        or is_verified_super_admin(org_id, member)
    ):
        raise PermissionError("only the organization's first member, owner or verified Super Admin can do this")


def is_team_lead(org_id: uuid.UUID, member: OrgMember, db: Session) -> bool:
    return (
        db.execute(
            select(Team.id).where(Team.org_id == org_id, Team.team_leader_id == member.id).limit(1)
        ).first()
        is not None
    )


def _require_join_link_role(org_id: uuid.UUID, member: OrgMember, db: Session) -> None:
    """Who may mint/reissue the org-wide join link (ADR-0021): team lead,
    founder, owner, or verified Super Admin."""
    if member.organization_id != org_id:
        raise PermissionError("not a member of this organization")
    if not (
        is_founding_member(org_id, member.id, db)
        or is_owner(org_id, member, db)
        or is_verified_super_admin(org_id, member)
        or is_team_lead(org_id, member, db)
    ):
        raise PermissionError(
            "only a team lead, the organization's first member, owner or verified Super Admin can manage the join link"
        )


SIGNUP_STATE_PURPOSE = "signup"
PENDING_PERSONAL_SIGNUP_PURPOSE = "pending_personal_signup"
PENDING_PERSONAL_SIGNUP_TTL = timedelta(minutes=15)


@dataclass
class SignupStart:
    authorization_url: str
    state: str


def start_signup(
    switch_account: bool = False,
    invite_token: str | None = None,
    db: Session | None = None,
    email_hint: str | None = None,
    join_token: str | None = None,
) -> SignupStart:
    """Google OAuth, same as app/auth/login.py's login flow (same scopes,
    same PKCE primitives — imported, not reimplemented) but with its own
    state purpose, so the callback knows a brand-new Organization/OrgMember
    may need to be created rather than requiring one to already exist.

    switch_account forces Google's account chooser — used when someone who
    signed in with a personal account says their company uses Workspace and
    goes back to sign in with their work account instead.

    invite_token (from a forwarded `?invite=` link) pre-selects the invited
    Google account; the invitation is still only accepted by signing in as
    that account.

    join_token (from `/join/{token}`) is carried through OAuth state so the
    callback can domain-lock the joiner to that org (ADR-0021).

    email_hint comes from picking a row in the Log In account picker. Like
    the invite hint it only pre-selects the account at Google — it proves
    nothing and grants nothing, and Google still decides who signs in. An
    invitation's own email always wins over it."""
    invitation = find_invitation(invite_token, db) if invite_token and db is not None else None
    code_verifier = generate_code_verifier()
    code_challenge = derive_code_challenge(code_verifier)
    extra: dict | None = None
    if invitation is not None:
        extra = {"invite_email": invitation.email} if invitation.email else {"open_admin_invite": invitation.token}
    elif join_token:
        extra = {"join_token": join_token}
    state = build_state_token(code_verifier, purpose=SIGNUP_STATE_PURPOSE, extra=extra)
    url = build_authorization_url(
        LOGIN_SCOPES,
        state=state,
        code_challenge=code_challenge,
        access_type="online",
        prompt="select_account" if switch_account else None,
        login_hint=(invitation.email if invitation and invitation.email else None) or email_hint,
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
    # Signed in as someone with a pending Super Admin invitation — go
    # straight on to admin proof.
    needs_admin_proof: bool = False
    # Came from an invite link but signed in with a different Google account.
    invite_wrong_account: bool = False


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
    account, whether Knohow already has an org for that domain.

    With a `join_token` in state (ADR-0021): the link must be live, and `hd`
    must match the org's domain — personal accounts cannot use the org link."""
    state_payload = decode_state_token(state, expected_purpose=SIGNUP_STATE_PURPOSE)
    tokens = exchange_code_for_tokens(code, state_payload["code_verifier"])
    id_token_claims = verify_id_token(tokens["id_token"])

    email = id_token_claims["email"].lower()
    if not id_token_claims.get("email_verified"):
        raise ValueError("Google account email is not verified")

    # Org-agnostic lookup (same as app/auth/login.py::complete_login) — if
    # this email already has an OrgMember somewhere, signing up is just a
    # login, not a second bootstrap.
    invite_email = state_payload.get("invite_email")
    wrong_account = invite_email is not None and invite_email != email
    join_token = state_payload.get("join_token")
    join_org: Organization | None = None
    if join_token:
        join_org = _org_for_valid_join_token(join_token, db)

    member = db.execute(select(OrgMember).where(func.lower(OrgMember.email) == email)).scalar_one_or_none()
    if member is None:
        hosted_domain = id_token_claims.get("hd")
        if join_org is not None:
            _assert_join_domain_lock(join_org, hosted_domain)
            member = _join_existing_org(
                email, id_token_claims.get("name"), join_org, hosted_domain.lower() if hosted_domain else None, db
            )
        elif not hosted_domain:
            return SignupResult(
                pending_personal_token=issue_pending_personal_signup_token(email, id_token_claims.get("name")),
                invite_wrong_account=wrong_account,
            )
        else:
            member = join_or_create_domain_org(email, id_token_claims.get("name"), hosted_domain.lower(), db)
    elif join_org is not None:
        hosted_domain = id_token_claims.get("hd")
        _assert_join_domain_lock(join_org, hosted_domain)
        if member.organization_id != join_org.id:
            raise ValueError("this Google account already belongs to another organization")

    needs_admin_proof = accept_invitations_on_sign_in(member, db)
    open_invite = find_invitation(state_payload["open_admin_invite"], db) if "open_admin_invite" in state_payload else None
    if (
        open_invite is not None
        and open_invite.organization_id == member.organization_id
        and member.super_admin_verified_at is None
    ):
        # Came through the open admin link: let Google say whether this is
        # the Super Admin. If not, they're simply a member like anyone else.
        needs_admin_proof = True
    return SignupResult(
        login=_login_result(member), needs_admin_proof=needs_admin_proof, invite_wrong_account=wrong_account
    )


def _org_for_valid_join_token(token: str, db: Session) -> Organization:
    link = db.execute(select(JoinLink).where(JoinLink.token == token)).scalar_one_or_none()
    if link is None or is_sandbox_org(link.organization_id):
        raise ValueError("join link not found")
    now = datetime.now(timezone.utc)
    if link.revoked_at is not None or (link.expires_at is not None and link.expires_at <= now):
        raise ValueError("this invite link has expired")
    if link.locked_at is not None:
        raise ValueError("this invite link is locked")
    org = db.get(Organization, link.organization_id)
    if org is None:
        raise ValueError("join link not found")
    return org


def _assert_join_domain_lock(org: Organization, hosted_domain: str | None) -> None:
    if not hosted_domain:
        raise ValueError("join links are for work Google accounts only")
    org_domain = (org.observed_domain or org.verified_domain or "").lower()
    if org_domain and hosted_domain.lower() != org_domain:
        raise ValueError(f"sign in with a {org_domain} account to join")


def _join_existing_org(
    email: str, display_name: str | None, org: Organization, hosted_domain: str | None, db: Session
) -> OrgMember:
    """Place a new Workspace account into an org that already exists (join link)."""
    member = OrgMember(
        id=uuid.uuid4(),
        organization_id=org.id,
        email=email,
        display_name=display_name,
        auth_type=AuthType.DOMAIN_DELEGATED,
        standing=(
            MemberStanding.APPROVED if org.auto_accept_workspace_members else MemberStanding.AUTO_AFFILIATED
        ),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    record_audit_entry(
        org_id=org.id,
        actor_user_id=member.id,
        action_type="onboarding.joined_via_link",
        target_resource_id=str(member.id),
        details={"email": email, "observed_domain": hosted_domain},
        db=db,
    )
    return member



def join_or_create_domain_org(email: str, display_name: str | None, hosted_domain: str, db: Session) -> OrgMember:
    """One active org per observed domain (ADR-0006). A later signup with the
    same `hd` joins the existing org as auto-affiliated — evidence only, no
    standing, waiting for the owner — unless the owner opted into
    auto-accepting Workspace accounts; it is never given a second org. The first signup creates the
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
        standing=(
            MemberStanding.APPROVED
            if not created_org and org.auto_accept_workspace_members
            else MemberStanding.AUTO_AFFILIATED
        ),
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
        action_type=(
            "onboarding.member_auto_accepted"
            if member.standing == MemberStanding.APPROVED
            else "onboarding.member_auto_affiliated"
        ),
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


def create_domainless_org(pending_token: str, db: Session, name: str | None = None) -> LoginResult:
    """The "No / just me" answer for a personal Google account: a domainless
    org with exactly one owner, the creator. A person can't hold two of these
    — the email lookup below turns a repeat into a login.

    `name` is what the person called their personal org; it's the label the
    Log In picker leads with (user, 2026-09-20), so it matters more than it
    looks. Falling back to their Google name keeps old callers working."""
    payload = decode_pending_personal_signup_token(pending_token)
    email = payload["email"]

    existing = db.execute(select(OrgMember).where(func.lower(OrgMember.email) == email)).scalar_one_or_none()
    if existing is not None:
        return _login_result(existing)

    org_name = (name or "").strip() or payload.get("name") or email
    org = Organization(id=uuid.uuid4(), name=org_name, observed_domain=None, verified_domain=None)
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


def is_owner(org_id: uuid.UUID, member: OrgMember, db: Session) -> bool:
    org_chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    return org_chart is not None and org_chart.owner_member_id == member.id


SETUP_DONE = "done"
# The screens setup can stop on, in order. Anything else is refused rather
# than stored, so a typo can't strand a founder on a step that doesn't exist.
# inviteOwner is after the join link; connectWorkspace is offer-only (not stored —
# closing there must not reopen setup).
# Founder setup order (ADR-0023): the Google check comes before the owner
# question, and setup is only done after the owner question.
SETUP_STEPS = ("orgName", "teams", "ownTeam", "inviteLink", "connectWorkspace", "inviteOwner", SETUP_DONE)


def record_setup_step(org_id: uuid.UUID, step: str, db: Session) -> Organization:
    """Remembers where the founder got to. Called as each setup screen is
    finished, so the next sign-in resumes there ([[0014-org-setup-and-join-link]])."""
    if step not in SETUP_STEPS:
        raise ValueError(f"unknown setup step: {step}")
    org = db.get(Organization, org_id)
    if org is None:
        raise ValueError(f"no Organization with id={org_id}")
    org.setup_step = step
    if step == SETUP_DONE and org.setup_completed_at is None:
        org.setup_completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)
    return org


def resume_setup_step(member: OrgMember, db: Session) -> str | None:
    """The step to put this person back on, or None when there's nothing to
    resume. Only the founder runs setup, so only the founder can resume it;
    everyone else gets None however far setup got."""
    org = db.get(Organization, member.organization_id)
    if org is None or org.setup_step == SETUP_DONE:
        return None
    if not is_founding_member(member.organization_id, member.id, db):
        return None
    if org.setup_step is not None:
        return org.setup_step
    # Orgs that answered the owner questions before setup progress was
    # recorded: their chart exists, so `needs_org_setup` is already false,
    # but they never saw the screens after it. Send them to the first one.
    # Nothing had finished setup before this column existed, so this cannot
    # re-prompt someone who was genuinely done.
    has_chart = db.execute(
        select(OrgChart.id).where(OrgChart.org_id == member.organization_id)
    ).first()
    return SETUP_STEPS[0] if has_chart else None


def needs_org_setup(member: OrgMember, db: Session) -> bool:
    """Whether this member still has to answer the owner / Super Admin
    questions: they're the org's first member and no org chart exists."""
    has_chart = db.execute(select(OrgChart.id).where(OrgChart.org_id == member.organization_id)).first() is not None
    return not has_chart and is_founding_member(member.organization_id, member.id, db)


def is_verified_super_admin(org_id: uuid.UUID, member: OrgMember) -> bool:
    return member.organization_id == org_id and member.super_admin_verified_at is not None


def _require_owner(org_id: uuid.UUID, member: OrgMember, db: Session) -> None:
    """Owner, or a Google-proven Super Admin — who outranks a self-declared
    owner (onboarding spec, "Approving auto-joined members")."""
    if not (is_owner(org_id, member, db) or is_verified_super_admin(org_id, member)):
        raise PermissionError("only the organization's owner or a verified Super Admin can do this")


def reassign_owner(org_id: uuid.UUID, requester: OrgMember, new_owner_member_id: uuid.UUID, db: Session) -> OrgChart:
    """A proven Super Admin can take ownership away from a self-declared
    owner — e.g. someone who signed up first and claimed it."""
    if not is_verified_super_admin(org_id, requester):
        raise PermissionError("only a verified Super Admin can reassign the owner")
    new_owner = db.get(OrgMember, new_owner_member_id)
    if new_owner is None or new_owner.organization_id != org_id:
        raise ValueError(f"no member {new_owner_member_id} in organization {org_id}")

    org_chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    if org_chart is None:
        org_chart = OrgChart(id=uuid.uuid4(), org_id=org_id, initiator_member_id=requester.id)
        db.add(org_chart)
    previous_owner_id = org_chart.owner_member_id
    org_chart.owner_member_id = new_owner.id
    new_owner.standing = MemberStanding.APPROVED
    db.commit()
    db.refresh(org_chart)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=requester.id,
        action_type="onboarding.owner_reassigned",
        target_resource_id=str(org_chart.id),
        details={
            "previous_owner_member_id": str(previous_owner_id) if previous_owner_id else None,
            "new_owner_member_id": str(new_owner.id),
        },
        db=db,
    )
    return org_chart


def list_pending_members(org_id: uuid.UUID, requester: OrgMember, db: Session) -> list[OrgMember]:
    """Join requests waiting for the owner: auto-affiliated members."""
    _require_owner(org_id, requester, db)
    return list(
        db.execute(
            select(OrgMember)
            .where(OrgMember.organization_id == org_id, OrgMember.standing == MemberStanding.AUTO_AFFILIATED)
            .order_by(OrgMember.created_at)
        ).scalars()
    )


def list_members(org_id: uuid.UUID, db: Session) -> list[OrgMember]:
    """Everyone in the organization, approved or still waiting, oldest first.

    Deliberately readable by any member of the org rather than owner-only
    (unlike list_pending_members, which is a queue of decisions the owner has
    to make): the app shows who is in the organization on its own screens, and
    that is not privileged information inside a tenant. Scoped to one org by
    the caller's route dependency."""
    return list(
        db.execute(
            select(OrgMember).where(OrgMember.organization_id == org_id).order_by(OrgMember.created_at)
        ).scalars()
    )


def _pending_owner(chart: OrgChart | None, db: Session) -> dict | None:
    if chart is None or chart.owner_member_id is not None or chart.pending_owner_member_id is None:
        return None
    claimant = db.get(OrgMember, chart.pending_owner_member_id)
    if claimant is None:
        return None
    return {"id": str(claimant.id), "email": claimant.email, "display_name": claimant.display_name}


def org_overview(org_id: uuid.UUID, db: Session, viewer: OrgMember | None = None) -> dict:
    """Everything onboarding produced, in one read, for the app's dashboard.

    Onboarding asks a long series of questions and each answer lands in a
    different table. A dashboard that reflected only one of them would tell a
    founder almost nothing, so this assembles all of them:

    - the organization's name and the domain it was observed on, plus whether
      setup actually finished (`setup_step` / `setup_completed_at`)
    - who owns it, and any nominated Super Admin who hasn't signed in yet
    - whether Google confirmed a Super Admin (`super_admin_verified_at`)
    - the teams that were named, with their leads and members
    - every member, their standing, and the teams they said they were in
    - linked accounts: `person_id` is shared by one human's several addresses
    - whether the join link is live, and how many invitations are outstanding
    - how many people are waiting for the owner to approve them

    With a `viewer`, it also carries **what changed since they last opened the
    dashboard** (`app.activity.changes`), which is what the team cards badge
    and what the connectors pulse for. Reading does not clear it: the caller
    stamps `dashboard_seen_at` after the response is sent, so this visit shows
    the badges and the next one starts clean.

    One round trip on purpose: the dashboard is the first thing rendered after
    sign-in, and five parallel requests to build it is five ways to half-render.

    Readable by any member of the org (the route scopes it with
    `require_same_org`). Approving people stays owner-only — that lives in
    list_pending_members, which is a queue of decisions, not a summary."""
    org = db.get(Organization, org_id)
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    teams = list(db.execute(select(Team).where(Team.org_id == org_id).order_by(Team.created_at)).scalars())
    memberships = list(db.execute(select(OrgMembership).where(OrgMembership.org_id == org_id)).scalars())
    members = list_members(org_id, db)

    team_member_ids: dict[str, list[str]] = {}
    member_team_ids: dict[str, list[str]] = {}
    member_org_roles: dict[str, list[str]] = {}
    for m in memberships:
        member_key = str(m.user_id)
        if m.team_id is None:
            member_org_roles.setdefault(member_key, []).append(m.role.value)
            continue
        team_member_ids.setdefault(str(m.team_id), []).append(member_key)
        member_team_ids.setdefault(member_key, []).append(str(m.team_id))

    now = datetime.now(timezone.utc)
    live_link = db.execute(
        select(JoinLink)
        .where(JoinLink.organization_id == org_id, JoinLink.revoked_at.is_(None))
        .order_by(JoinLink.created_at.desc())
    ).scalars().first()
    link_is_live = live_link is not None and (live_link.expires_at is None or live_link.expires_at > now)

    open_invitations = db.execute(
        select(func.count(Invitation.id)).where(
            Invitation.organization_id == org_id,
            Invitation.consumed_at.is_(None),
            Invitation.expires_at > now,
        )
    ).scalar_one()

    return {
        "organization": {
            "id": str(org_id),
            "name": org.name,
            "observed_domain": org.observed_domain,
            "verified_domain": org.verified_domain,
            "auto_accept_workspace_members": org.auto_accept_workspace_members,
            "setup_step": org.setup_step,
            "setup_completed_at": org.setup_completed_at.isoformat() if org.setup_completed_at else None,
        },
        "owner_member_id": str(chart.owner_member_id) if chart and chart.owner_member_id else None,
        # Someone said "I'm the owner" and it awaits the founder / a Super
        # Admin (ADR-0021). Carried whole: the claimant may not be approved
        # yet, so may not be in `members`.
        "pending_owner": _pending_owner(chart, db),
        "nominated_super_admin_email": chart.nominated_super_admin_email if chart else None,
        "teams": [
            {
                "id": str(t.id),
                "name": t.name,
                "team_leader_id": str(t.team_leader_id) if t.team_leader_id else None,
                "parent_team_id": str(t.parent_team_id) if t.parent_team_id else None,
                "auto_own_enabled": t.auto_own_enabled,
                "member_ids": team_member_ids.get(str(t.id), []),
            }
            for t in teams
        ],
        "members": [
            {
                "id": str(m.id),
                "email": m.email,
                "display_name": m.display_name,
                "auth_type": m.auth_type.value,
                "standing": m.standing.value,
                # One human's several addresses share a person_id, which is how
                # "add another account" in onboarding shows up here.
                "person_id": str(m.person_id) if m.person_id else None,
                "is_super_admin": m.super_admin_verified_at is not None,
                "team_ids": member_team_ids.get(str(m.id), []),
                "org_wide_roles": member_org_roles.get(str(m.id), []),
                "joined_at": m.created_at.isoformat(),
            }
            for m in members
        ],
        "join_link": {
            "active": link_is_live,
            "locked": bool(link_is_live and live_link.locked_at is not None),
            "created_at": live_link.created_at.isoformat() if live_link and link_is_live else None,
        },
        "open_invitations": open_invitations,
        "pending_members": sum(1 for m in members if m.standing == MemberStanding.AUTO_AFFILIATED),
        "changes": team_changes(org_id, viewer.dashboard_seen_at if viewer else None, db),
        # Everything in the last week, regardless of whether this person has
        # seen it. "Changes" above is scoped to *you* and empties as soon as
        # you look, which is right for a badge and useless for a replay - the
        # Home screen's "Recent updates" plays a time window, not an inbox
        # (user, 2026-09-22).
        "recent_changes": team_changes(org_id, datetime.now(timezone.utc) - timedelta(days=7), db),
        "viewer_last_seen_at": (
            viewer.dashboard_seen_at.isoformat() if viewer and viewer.dashboard_seen_at else None
        ),
    }


def mark_dashboard_seen(member: OrgMember, db: Session) -> datetime:
    """Stamps "you have seen the dashboard as of now" on the member.

    Separate from `org_overview` on purpose: if reading the dashboard cleared
    the badges, the badges would be gone in the same render that was supposed
    to show them. The frontend asks for the overview, draws it, then calls
    this."""
    member.dashboard_seen_at = datetime.now(timezone.utc)
    db.commit()
    return member.dashboard_seen_at


def set_auto_accept_workspace_members(org_id: uuid.UUID, requester: OrgMember, enabled: bool, db: Session) -> Organization:
    """Opt-in to approve same-domain Workspace signups on arrival.
    Applies to future signups only; anyone already waiting stays pending
    until approved. It sits beside the join link in Manage teams, so the same
    people may flip it (user 2026-09-27)."""
    _require_join_link_role(org_id, requester, db)
    org = db.get(Organization, org_id)
    org.auto_accept_workspace_members = enabled
    db.commit()
    db.refresh(org)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=requester.id,
        action_type="onboarding.auto_accept_workspace_members_set",
        target_resource_id=str(org_id),
        details={"enabled": enabled},
        db=db,
    )
    return org


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
    _require_owner(org_id, approver, db)

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


def needs_join_placement(member: OrgMember, db: Session) -> bool:
    """True when a joiner still owes the team-pick wizard (ADR-0021)."""
    if member.join_placement_completed_at is not None:
        return False
    if needs_org_setup(member, db) or resume_setup_step(member, db) is not None:
        return False
    team_count = db.execute(
        select(func.count()).select_from(Team).where(Team.org_id == member.organization_id)
    ).scalar_one()
    if team_count == 0:
        return False
    # Founder who finished setup without join placement still doesn't need it.
    if is_founding_member(member.organization_id, member.id, db):
        org = db.get(Organization, member.organization_id)
        if org is not None and org.setup_step == SETUP_DONE:
            return False
    return True


def owner_claim_available(org_id: uuid.UUID, db: Session) -> bool:
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()
    return chart is not None and chart.owner_member_id is None


@dataclass
class TeamPlacementChoice:
    team_id: uuid.UUID
    claim_lead: bool


def complete_join_placement(
    org_id: uuid.UUID,
    member: OrgMember,
    placements: list[TeamPlacementChoice],
    claim_owner: bool,
    db: Session,
) -> dict:
    """Apply team pick + lead claims/requests + optional owner claim (ADR-0021)."""
    if member.organization_id != org_id:
        raise PermissionError("not a member of this organization")

    from app.org_chart.service import upsert_membership

    outcomes: list[dict] = []
    for choice in placements:
        team = db.execute(
            select(Team).where(Team.id == choice.team_id, Team.org_id == org_id).with_for_update()
        ).scalar_one_or_none()
        if team is None:
            raise ValueError(f"no team {choice.team_id} in organization {org_id}")

        if choice.claim_lead and team.team_leader_id is None:
            team.team_leader_id = member.id
            upsert_membership(org_id, team.id, member.id, OrgRole.TEAM_LEADER, db, _skip_audit=True)
            if member.standing != MemberStanding.APPROVED:
                member.standing = MemberStanding.APPROVED
            outcomes.append({"team_id": str(team.id), "result": "lead_claimed"})
            record_audit_entry(
                org_id=org_id,
                actor_user_id=member.id,
                action_type="onboarding.team_lead_claimed",
                target_resource_id=str(team.id),
                details={},
                db=db,
            )
        elif choice.claim_lead and team.team_leader_id == member.id:
            outcomes.append({"team_id": str(team.id), "result": "already_lead"})
        elif team.team_leader_id is None:
            upsert_membership(org_id, team.id, member.id, OrgRole.MEMBER, db, _skip_audit=True)
            # No lead exists, so nobody could approve this person: placing
            # them directly is the approval. Only a pending request waits.
            if member.standing != MemberStanding.APPROVED:
                member.standing = MemberStanding.APPROVED
            outcomes.append({"team_id": str(team.id), "result": "joined_member"})
        elif team.team_leader_id == member.id:
            outcomes.append({"team_id": str(team.id), "result": "already_lead"})
        else:
            existing = db.execute(
                select(TeamJoinRequest).where(
                    TeamJoinRequest.team_id == team.id,
                    TeamJoinRequest.member_id == member.id,
                )
            ).scalar_one_or_none()
            if existing is None:
                db.add(
                    TeamJoinRequest(
                        id=uuid.uuid4(),
                        org_id=org_id,
                        team_id=team.id,
                        member_id=member.id,
                        status=TeamJoinRequestStatus.PENDING,
                    )
                )
                outcomes.append({"team_id": str(team.id), "result": "requested"})
            elif existing.status == TeamJoinRequestStatus.PENDING:
                outcomes.append({"team_id": str(team.id), "result": "request_pending"})
            else:
                outcomes.append({"team_id": str(team.id), "result": existing.status.value})

    owner_result = None
    if claim_owner:
        owner_result = claim_pending_owner(org_id, member, db, commit=False)

    member.join_placement_completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(member)
    return {"placements": outcomes, "owner_claim": owner_result, "join_placement_completed": True}


def claim_pending_owner(
    org_id: uuid.UUID, member: OrgMember, db: Session, *, commit: bool = True
) -> str:
    """Someone said "I'm the owner" while owner unset — records a pending
    claim, or confirms it at once for the founder who is also the verified
    Super Admin (see `confirm_founder_admin_owner_claim`)."""
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id).with_for_update()).scalar_one_or_none()
    if chart is None:
        raise ValueError("organization has no org chart yet")
    if chart.owner_member_id is not None:
        if chart.owner_member_id == member.id:
            return "already_owner"
        raise ValueError("this organization already has an owner")
    if is_founding_member(org_id, member.id, db) and is_verified_super_admin(org_id, member):
        chart.pending_owner_member_id = None
        chart.owner_member_id = member.id
        _record_auto_owner_confirmation(org_id, member, chart, db)
        if commit:
            db.commit()
        return "owner"
    chart.pending_owner_member_id = member.id
    record_audit_entry(
        org_id=org_id,
        actor_user_id=member.id,
        action_type="onboarding.owner_claimed_pending",
        target_resource_id=str(chart.id),
        details={},
        db=db,
    )
    if commit:
        db.commit()
    return "pending"


def _record_auto_owner_confirmation(org_id: uuid.UUID, member: OrgMember, chart: OrgChart, db: Session) -> None:
    record_audit_entry(
        org_id=org_id,
        actor_user_id=member.id,
        action_type="onboarding.owner_claim_confirmed",
        target_resource_id=str(member.id),
        details={"automatic": True, "reason": "founder_is_verified_super_admin"},
        db=db,
    )


def confirm_founder_admin_owner_claim(org_id: uuid.UUID, member: OrgMember, db: Session) -> bool:
    """A founder's own owner claim can't be confirmed by anyone else when the
    founder is also the only confirmer (founder + Super Admin), so it would
    wait forever. Google proving they're a Super Admin of the company's
    Workspace is enough: the claim is confirmed automatically (user
    2026-09-29). Covers a claim made before the proof. Returns True if it
    confirmed one."""
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id).with_for_update()).scalar_one_or_none()
    if (
        chart is None
        or chart.owner_member_id is not None
        or chart.pending_owner_member_id != member.id
        or not is_founding_member(org_id, member.id, db)
        or not is_verified_super_admin(org_id, member)
    ):
        return False
    chart.pending_owner_member_id = None
    chart.owner_member_id = member.id
    _record_auto_owner_confirmation(org_id, member, chart, db)
    db.commit()
    return True


def list_pending_team_join_requests(org_id: uuid.UUID, actor: OrgMember, db: Session) -> list[TeamJoinRequest]:
    """Pending team joins visible to this actor: leads see their teams;
    owner and verified Super Admin see all."""
    if actor.organization_id != org_id:
        raise PermissionError("not a member of this organization")
    q = select(TeamJoinRequest).where(
        TeamJoinRequest.org_id == org_id,
        TeamJoinRequest.status == TeamJoinRequestStatus.PENDING,
    )
    if not (is_owner(org_id, actor, db) or is_verified_super_admin(org_id, actor)):
        led = list(
            db.execute(select(Team.id).where(Team.org_id == org_id, Team.team_leader_id == actor.id)).scalars()
        )
        if not led:
            return []
        q = q.where(TeamJoinRequest.team_id.in_(led))
    return list(db.execute(q.order_by(TeamJoinRequest.created_at)).scalars())


def decide_team_join_request(
    org_id: uuid.UUID,
    request_id: uuid.UUID,
    approve: bool,
    actor: OrgMember,
    db: Session,
) -> TeamJoinRequest:
    from app.org_chart.service import upsert_membership

    req = db.get(TeamJoinRequest, request_id)
    if req is None or req.org_id != org_id:
        raise ValueError("join request not found")
    if req.status != TeamJoinRequestStatus.PENDING:
        return req

    team = db.get(Team, req.team_id)
    if team is None:
        raise ValueError("team not found")
    can_decide = (
        team.team_leader_id == actor.id
        or is_owner(org_id, actor, db)
        or is_verified_super_admin(org_id, actor)
    )
    if not can_decide:
        raise PermissionError("only this team's lead, the owner, or a verified Super Admin can decide")

    req.status = TeamJoinRequestStatus.APPROVED if approve else TeamJoinRequestStatus.REJECTED
    if approve:
        upsert_membership(org_id, req.team_id, req.member_id, OrgRole.MEMBER, db, _skip_audit=True)
        joiner = db.get(OrgMember, req.member_id)
        if joiner is not None and joiner.standing != MemberStanding.APPROVED:
            joiner.standing = MemberStanding.APPROVED
    db.commit()
    db.refresh(req)
    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="onboarding.team_join_request." + ("approved" if approve else "rejected"),
        target_resource_id=str(req.id),
        details={"team_id": str(req.team_id), "member_id": str(req.member_id)},
        db=db,
    )
    return req
