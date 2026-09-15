import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.google.scopes import DOMAIN_DELEGATION_SCOPES
from app.models.delegation_grant import DelegationGrant, DelegationStatus
from app.models.organization import Organization


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
    """Called once the Workspace super-admin confirms they completed the
    Admin console authorization step. There is no way for Knohow to verify
    this independently ahead of the first impersonated API call actually
    succeeding — this records the client's attestation, not a proof."""
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
