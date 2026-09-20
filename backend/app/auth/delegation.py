import uuid
from datetime import datetime, timezone

from dataclasses import dataclass, field

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from googleapiclient.discovery import build
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.google.drive_client import load_service_account_info
from app.google.scopes import ADMIN_CONSOLE_DELEGATION_SCOPES, DOMAIN_DELEGATION_SCOPES
from app.models.delegation_grant import DelegationGrant, DelegationStatus
from app.models.org_member import OrgMember
from app.models.organization import Organization

ADMIN_CONSOLE_DELEGATION_URL = "https://admin.google.com/ac/owl/domainwidedelegation"


def initiate_delegation(org_id: uuid.UUID, verified_domain: str, requested_by_member_id: uuid.UUID, db: Session) -> DelegationGrant:
    """Records that an organization is beginning the domain-wide delegation
    setup: the client's Workspace super-admin still has to actually authorize
    Knohow's service account client ID with DOMAIN_DELEGATION_SCOPES in their
    Admin console (see docs/gcp-setup.md) — this function only creates the
    pending record that approve_delegation() later flips."""
    org = db.get(Organization, org_id)
    if org is None:
        raise ValueError(f"no Organization with id={org_id}")

    grant = org.delegation_grant
    if grant is None:
        grant = DelegationGrant(
            id=uuid.uuid4(),
            organization_id=org_id,
            status=DelegationStatus.PENDING,
            verified_domain=verified_domain,
            granted_scopes=DOMAIN_DELEGATION_SCOPES,
        )
        db.add(grant)
    else:
        grant.status = DelegationStatus.PENDING
        grant.verified_domain = verified_domain
        grant.granted_scopes = DOMAIN_DELEGATION_SCOPES
        grant.approved_at = None
        grant.revoked_at = None

    db.commit()
    db.refresh(grant)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=requested_by_member_id,
        action_type="delegation.initiated",
        target_resource_id=str(grant.id),
        details={"verified_domain": verified_domain, "scopes": DOMAIN_DELEGATION_SCOPES},
        db=db,
    )
    return grant


def approve_delegation(org_id: uuid.UUID, approving_admin_email: str, db: Session) -> DelegationGrant:
    """Marks delegation approved. Only called by check_delegation once an
    impersonated call has actually succeeded (delegation proof) — never on
    someone's word that they did the Admin console step."""
    org = db.get(Organization, org_id)
    if org is None:
        raise ValueError(f"no Organization with id={org_id}")

    grant = org.delegation_grant
    if grant is None:
        raise ValueError(f"organization {org_id} has no delegation grant to approve — call initiate_delegation first")

    grant.status = DelegationStatus.APPROVED
    grant.approving_admin_email = approving_admin_email
    grant.approved_at = datetime.now(timezone.utc)
    grant.revoked_at = None

    if org.verified_domain is None:
        org.verified_domain = grant.verified_domain

    db.commit()
    db.refresh(grant)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=None,
        action_type="delegation.approved",
        target_resource_id=str(grant.id),
        details={"approving_admin_email": approving_admin_email, "verified_domain": grant.verified_domain},
        db=db,
    )
    return grant


def revoke_delegation(org_id: uuid.UUID, actor_member_id: uuid.UUID | None, db: Session) -> DelegationGrant:
    org = db.get(Organization, org_id)
    if org is None:
        raise ValueError(f"no Organization with id={org_id}")

    grant = org.delegation_grant
    if grant is None:
        raise ValueError(f"organization {org_id} has no delegation grant to revoke")

    grant.status = DelegationStatus.REVOKED
    grant.revoked_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(grant)

    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor_member_id,
        action_type="delegation.revoked",
        target_resource_id=str(grant.id),
        details={},
        db=db,
    )
    return grant


@dataclass
class DelegationSetup:
    """What the Super Admin enters in the Admin console — shown verbatim by
    the setup guide so nothing has to be looked up or retyped."""

    client_id: str
    scopes: list[str]
    admin_console_url: str = ADMIN_CONSOLE_DELEGATION_URL

    @property
    def scopes_csv(self) -> str:
        return ",".join(self.scopes)


def delegation_setup() -> DelegationSetup:
    # The service account's numeric client ID — not the OAuth web client ID.
    return DelegationSetup(client_id=str(load_service_account_info()["client_id"]), scopes=ADMIN_CONSOLE_DELEGATION_SCOPES)


class DelegationCheckError(Exception):
    """The check couldn't run (Google outage, bad service account key) —
    not a verdict on whether delegation is set up."""


@dataclass
class DelegationCheck:
    status: str  # "approved" | "pending" | "needs_admin_proof" | "not_started"
    missing_scopes: list[str] = field(default_factory=list)


def _impersonation_works(subject: str, scopes: list[str]) -> bool:
    """Mints an impersonated token for `subject` with `scopes`. Google only
    issues it once the Super Admin has authorized the service account for
    those scopes in the Admin console."""
    credentials = service_account.Credentials.from_service_account_info(
        load_service_account_info(), scopes=scopes
    ).with_subject(subject)
    try:
        credentials.refresh(Request())
    except RefreshError as exc:
        if "unauthorized_client" in str(exc) or "access_denied" in str(exc):
            return False
        raise DelegationCheckError(str(exc)) from exc
    except Exception as exc:  # transport errors etc. — the check didn't run
        raise DelegationCheckError(str(exc)) from exc
    return True


def _drive_call_works(subject: str) -> bool:
    credentials = service_account.Credentials.from_service_account_info(
        load_service_account_info(), scopes=DOMAIN_DELEGATION_SCOPES
    ).with_subject(subject)
    try:
        build("drive", "v3", credentials=credentials, cache_discovery=False).about().get(fields="user").execute()
    except Exception as exc:
        raise DelegationCheckError(str(exc)) from exc
    return True


def check_delegation(org_id: uuid.UUID, db: Session) -> DelegationCheck:
    """Delegation proof (onboarding spec): an impersonated call actually
    succeeding, as the verified Super Admin, for every scope the guide asked
    for. Approves the grant on success; otherwise reports which scopes are
    still missing. Runs on demand and from the scheduler."""
    org = db.get(Organization, org_id)
    if org is None:
        raise ValueError(f"no Organization with id={org_id}")
    grant = org.delegation_grant
    if grant is None:
        return DelegationCheck(status="not_started")
    if grant.status == DelegationStatus.APPROVED:
        return DelegationCheck(status="approved")

    # Only a grant whose domain Google proved (admin proof) is checked, and
    # impersonation runs as the member Google proved is a Super Admin there.
    admin = db.execute(
        select(OrgMember)
        .where(OrgMember.organization_id == org_id, OrgMember.super_admin_verified_at.is_not(None))
        .order_by(OrgMember.super_admin_verified_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if admin is None or org.verified_domain is None or org.verified_domain != grant.verified_domain:
        return DelegationCheck(status="needs_admin_proof")

    scopes = ADMIN_CONSOLE_DELEGATION_SCOPES
    if not _impersonation_works(admin.email, scopes):
        missing = [scope for scope in scopes if not _impersonation_works(admin.email, [scope])]
        return DelegationCheck(status="pending", missing_scopes=missing or scopes)

    _drive_call_works(admin.email)
    grant.granted_scopes = scopes
    approve_delegation(org_id, admin.email, db)
    return DelegationCheck(status="approved")
