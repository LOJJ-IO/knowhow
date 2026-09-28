"""What the signed-in member still has to do, for the Notifications dialog
(ADR-0026). Each task is shown only to someone who can act on it.

Kinds, in the order they're returned:
  join_request    a joiner waiting on a team you lead (owner / Super Admin back up)
  owner_claim     someone claimed to be owner; founder or Super Admin confirms,
                  never the claimant themself (ADR-0021: a claim, not a grant)
  no_owner        nobody sits at the top and nobody has claimed it
  no_super_admin  nobody has been confirmed by Google as a Super Admin
  company_drive   the company-wide Drive connection isn't approved
  own_drive       the caller's own Drive isn't reachable
  linked_drive    a personal account linked to the caller (ADR-0025) whose
                  Drive isn't connected; one per address, only to the caller
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record_audit_entry
from app.auth.linked_drive import unconnected_linked_emails
from app.models.delegation_grant import DelegationStatus
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.organization import Organization
from app.models.team import Team
from app.onboarding.service import (
    is_founding_member,
    is_owner,
    is_verified_super_admin,
    list_pending_team_join_requests,
)


def _person(member: OrgMember | None) -> dict | None:
    if member is None:
        return None
    return {"id": str(member.id), "email": member.email, "display_name": member.display_name}


def _drive_connected(member: OrgMember, org: Organization) -> bool:
    grant = org.delegation_grant
    company = grant is not None and grant.status == DelegationStatus.APPROVED
    if member.auth_type == AuthType.DOMAIN_DELEGATED:
        return company or member.oauth_credential is not None
    return member.oauth_credential is not None


def pending_tasks(org_id: uuid.UUID, member: OrgMember, db: Session) -> list[dict]:
    if member.organization_id != org_id:
        raise PermissionError("not a member of this organization")
    org = db.get(Organization, org_id)
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id)).scalar_one_or_none()

    founder = is_founding_member(org_id, member.id, db)
    owner = is_owner(org_id, member, db)
    super_admin = is_verified_super_admin(org_id, member)
    tasks: list[dict] = []

    try:
        requests = list_pending_team_join_requests(org_id, member, db)
    except PermissionError:
        requests = []
    for req in requests:
        team = db.get(Team, req.team_id)
        tasks.append(
            {
                "kind": "join_request",
                "id": str(req.id),
                "team": {"id": str(req.team_id), "name": team.name if team else None},
                "person": _person(db.get(OrgMember, req.member_id)),
                "created_at": req.created_at.isoformat(),
            }
        )

    if chart is not None:
        claimant_id = chart.pending_owner_member_id
        if claimant_id is not None and (founder or super_admin) and claimant_id != member.id:
            tasks.append(
                {"kind": "owner_claim", "id": str(chart.id), "person": _person(db.get(OrgMember, claimant_id))}
            )
        if chart.owner_member_id is None and claimant_id is None and (founder or super_admin):
            tasks.append({"kind": "no_owner", "id": str(chart.id)})

    any_super_admin = db.execute(
        select(OrgMember.id).where(
            OrgMember.organization_id == org_id, OrgMember.super_admin_verified_at.is_not(None)
        ).limit(1)
    ).first()
    if any_super_admin is None and (founder or owner):
        tasks.append({"kind": "no_super_admin", "id": str(org_id)})

    grant = org.delegation_grant if org else None
    if (grant is None or grant.status != DelegationStatus.APPROVED) and (founder or owner or super_admin):
        tasks.append({"kind": "company_drive", "id": str(org_id)})

    if org is not None and not _drive_connected(member, org):
        tasks.append({"kind": "own_drive", "id": str(member.id)})

    for email in unconnected_linked_emails(member, db):
        tasks.append({"kind": "linked_drive", "id": email, "email": email})

    return tasks


def decide_owner_claim(org_id: uuid.UUID, actor: OrgMember, approve: bool, db: Session) -> OrgChart:
    """Founder or verified Super Admin confirms or declines the pending owner
    claim. Nobody decides their own claim."""
    if actor.organization_id != org_id:
        raise PermissionError("not a member of this organization")
    if not (is_founding_member(org_id, actor.id, db) or is_verified_super_admin(org_id, actor)):
        raise PermissionError("only the founder or a verified Super Admin can confirm an owner claim")
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == org_id).with_for_update()).scalar_one_or_none()
    if chart is None or chart.pending_owner_member_id is None:
        raise ValueError("there is no owner claim to decide")
    claimant_id = chart.pending_owner_member_id
    if claimant_id == actor.id:
        raise PermissionError("you can't confirm your own owner claim")

    if approve:
        chart.owner_member_id = claimant_id
        claimant = db.get(OrgMember, claimant_id)
        if claimant is not None and claimant.standing != MemberStanding.APPROVED:
            claimant.standing = MemberStanding.APPROVED
    chart.pending_owner_member_id = None
    db.commit()
    db.refresh(chart)
    record_audit_entry(
        org_id=org_id,
        actor_user_id=actor.id,
        action_type="onboarding.owner_claim_confirmed" if approve else "onboarding.owner_claim_declined",
        target_resource_id=str(claimant_id),
        details={"decided_at": datetime.now(timezone.utc).isoformat()},
        db=db,
    )
    return chart
