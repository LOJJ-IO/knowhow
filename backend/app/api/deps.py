import uuid
from collections.abc import Generator

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.exceptions import CrossOrgAccessDenied
from app.models.org_member import MemberStanding, OrgMember
from app.security.jwt import InvalidSessionToken, TokenType, decode_session_token


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_member(
    knohow_access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> OrgMember:
    if knohow_access_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "not authenticated")

    try:
        payload = decode_session_token(knohow_access_token, expected_type=TokenType.ACCESS)
    except InvalidSessionToken as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid session: {exc}") from exc

    member = db.get(OrgMember, uuid.UUID(payload["sub"]))
    if member is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "member no longer exists")

    return member


def get_approved_member(member: OrgMember = Depends(get_current_member)) -> OrgMember:
    """Any route that exposes other members' data (org chart, files,
    search, transfers) requires standing. An auto-affiliated member — placed
    in the org by a matching Google `hd` alone — may only use routes that
    touch their own identity until the owner approves them."""
    if member.standing != MemberStanding.APPROVED:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "membership not yet approved by the organization's owner")
    return member


def require_same_org_any_standing(
    org_id: uuid.UUID, member: OrgMember = Depends(get_current_member)
) -> OrgMember:
    """require_same_org without the standing check — only for onboarding
    steps an unapproved first joiner must still be able to take."""
    if member.organization_id != org_id:
        raise CrossOrgAccessDenied(f"member {member.id} does not belong to organization {org_id}")
    return member


def require_same_org_for_setup(
    org_id: uuid.UUID, member: OrgMember = Depends(get_current_member), db: Session = Depends(get_db)
) -> OrgMember:
    """The org-chart routes setup itself drives (naming the org, adding and
    removing teams, the founder's own membership).

    Approved members pass as usual. The **founding member also passes while
    setup is unfinished**, because the founder of a brand-new org starts out
    `auto_affiliated` — there is nobody approved to approve them yet, so
    requiring standing here would lock them out of their own setup. Once
    setup is done they need standing like everyone else, so this can't become
    a way for an auto-joined member to edit the chart."""
    if member.organization_id != org_id:
        raise CrossOrgAccessDenied(f"member {member.id} does not belong to organization {org_id}")
    if member.standing == MemberStanding.APPROVED:
        return member

    # Imported here: the onboarding service pulls in a good deal of the app,
    # and deps is imported by every route module.
    from app.models.organization import Organization
    from app.onboarding.service import SETUP_DONE, is_founding_member

    org = db.get(Organization, org_id)
    setup_finished = org is not None and org.setup_step == SETUP_DONE
    if not setup_finished and is_founding_member(org_id, member.id, db):
        return member
    raise HTTPException(
        status.HTTP_403_FORBIDDEN, "membership not yet approved by the organization's owner"
    )


def require_same_org(org_id: uuid.UUID, member: OrgMember = Depends(get_approved_member)) -> OrgMember:
    """Route-level guard mirroring the boundary enforced inside the service
    functions themselves (get_drive_client_for_user, revoke_and_offboard,
    etc.) — belt-and-suspenders, since the service-layer check is the one
    that actually matters for safety, this just fails fast with a clean 403."""
    if member.organization_id != org_id:
        raise CrossOrgAccessDenied(f"member {member.id} does not belong to organization {org_id}")
    return member
