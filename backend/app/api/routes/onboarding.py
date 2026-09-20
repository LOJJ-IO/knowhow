import uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org, require_same_org_any_standing
from app.api.routes.auth import (  # reuse: same cookie contract as login
    PENDING_PERSONAL_SIGNUP_COOKIE,
    set_session_cookies,
    signup_redirect,
)
from app.auth.identity import start_link_account_for_pending_personal
from app.auth.pkce import InvalidOAuthState
from app.models.invitation import InvitationKind
from app.models.org_member import OrgMember
from app.onboarding.service import (
    add_member,
    decode_pending_personal_signup_token,
    approve_member,
    list_invitations,
    list_pending_members,
    reassign_owner,
    set_auto_accept_workspace_members,
    complete_signup,
    create_domainless_org,
    create_org_chart,
    invite_to_org,
    invite_url,
    is_founding_member,
    start_signup,
)

router = APIRouter(tags=["onboarding"])


@router.get("/onboarding/signup")
def signup(
    switch_account: bool = False,
    invite: str | None = None,
    email: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    result = start_signup(switch_account=switch_account, invite_token=invite, db=db, email_hint=email)
    return RedirectResponse(result.authorization_url, status_code=status.HTTP_302_FOUND)


@router.get("/onboarding/signup/callback")
def signup_callback(code: str, state: str, db: Session = Depends(get_db)) -> RedirectResponse:
    try:
        return signup_redirect(complete_signup(code, state, db))
    except InvalidOAuthState as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid or expired signup state: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/onboarding/link-org-account")
def link_org_account(knohow_pending_signup: str | None = Cookie(default=None)) -> RedirectResponse:
    """"Yes, my company uses Google Workspace" — sends them to sign in to the
    work account. The personal identity they already proved is carried in the
    OAuth state and recorded against the same person on the way back; **no
    personal org is created** (user, 2026-09-20)."""
    if knohow_pending_signup is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no pending personal signup — sign in with Google again")
    try:
        payload = decode_pending_personal_signup_token(knohow_pending_signup)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    start = start_link_account_for_pending_personal(payload["email"])
    return RedirectResponse(start.authorization_url, status_code=status.HTTP_302_FOUND)


class PersonalOrgRequest(BaseModel):
    """What the person called their own workspace. The Log In picker leads
    with the org name, so this is the label they'll see next time."""

    name: str | None = None


@router.post("/onboarding/personal-org")
def personal_org(
    response: Response,
    payload: PersonalOrgRequest | None = None,
    db: Session = Depends(get_db),
    knohow_pending_signup: str | None = Cookie(default=None),
) -> dict:
    """The "No / just me" answer after a personal-account sign-in: creates
    the person's domainless org, under the name they chose, and starts their
    session. That name is what the Log In picker shows for this row."""
    if knohow_pending_signup is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no pending personal signup — sign in with Google again")
    try:
        result = create_domainless_org(knohow_pending_signup, db, name=payload.name if payload else None)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    set_session_cookies(response, result.access_token, result.refresh_token)
    response.delete_cookie(PENDING_PERSONAL_SIGNUP_COOKIE)
    return {"organization_id": str(result.member.organization_id), "member_id": str(result.member.id)}


class CreateOrgChartRequest(BaseModel):
    is_owner: bool
    is_super_admin: bool
    owner_email: EmailStr | None = None
    # Who the Super Admin is, when it isn't the initiator — recorded as a
    # nomination only.
    super_admin_email: EmailStr | None = None


@router.post("/organizations/{org_id}/org-chart")
def create_org_chart_route(
    org_id: uuid.UUID,
    body: CreateOrgChartRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org_any_standing),
) -> dict:
    # The founding member runs this before anyone has standing; nobody else
    # who auto-joined the domain may pre-empt them and claim ownership.
    if not is_founding_member(org_id, member.id, db):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only the organization's first member can set up its org chart")
    if not body.is_owner and not body.owner_email:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "owner_email is required when the initiator is not the owner"
        )

    result = create_org_chart(
        org_id,
        member.id,
        body.is_owner,
        body.is_super_admin,
        db,
        owner_email=body.owner_email,
        super_admin_email=body.super_admin_email,
    )
    return {
        "org_chart_id": str(result.org_chart.id),
        "owner_member_id": str(result.org_chart.owner_member_id) if result.org_chart.owner_member_id else None,
        "owner_confirmation_pending": result.owner_invitation is not None,
        # Forwardable links — Knohow sends no email yet, so the setup person
        # passes these on themselves.
        "owner_invite_url": invite_url(result.owner_invitation) if result.owner_invitation else None,
        "super_admin_invite_url": (
            invite_url(result.super_admin_invitation) if result.super_admin_invitation else None
        ),
    }


class AddMemberRequest(BaseModel):
    email: EmailStr
    display_name: str | None = None


@router.post("/organizations/{org_id}/members")
def add_member_route(
    org_id: uuid.UUID,
    body: AddMemberRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    new_member = add_member(org_id, body.email, body.display_name, member.id, db)
    return {"id": str(new_member.id), "email": new_member.email, "auth_type": new_member.auth_type.value}


@router.post("/organizations/{org_id}/members/{member_id}/approve")
def approve_member_route(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    try:
        approved = approve_member(org_id, member, member_id, db)
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return {"id": str(approved.id), "email": approved.email, "standing": approved.standing.value}


@router.get("/organizations/{org_id}/members/pending")
def pending_members_route(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> list[dict]:
    """Join requests for the owner to verify: people who signed in with a
    matching Workspace domain and are waiting for approval."""
    try:
        pending = list_pending_members(org_id, member, db)
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    return [
        {"id": str(m.id), "email": m.email, "display_name": m.display_name, "requested_at": m.created_at.isoformat()}
        for m in pending
    ]


class OrganizationSettingsRequest(BaseModel):
    auto_accept_workspace_members: bool


@router.patch("/organizations/{org_id}/settings")
def organization_settings_route(
    org_id: uuid.UUID,
    body: OrganizationSettingsRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    try:
        org = set_auto_accept_workspace_members(org_id, member, body.auto_accept_workspace_members, db)
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    return {"auto_accept_workspace_members": org.auto_accept_workspace_members}


class ReassignOwnerRequest(BaseModel):
    member_id: uuid.UUID


@router.post("/organizations/{org_id}/owner")
def reassign_owner_route(
    org_id: uuid.UUID,
    body: ReassignOwnerRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    """Verified Super Admin only: make another member the owner."""
    try:
        org_chart = reassign_owner(org_id, member, body.member_id, db)
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return {"org_chart_id": str(org_chart.id), "owner_member_id": str(org_chart.owner_member_id)}


def _serialize_invitation(invitation) -> dict:
    return {
        "id": str(invitation.id),
        "kind": invitation.kind.value,
        "email": invitation.email,
        "url": invite_url(invitation),
        "expires_at": invitation.expires_at.isoformat(),
    }


@router.get("/organizations/{org_id}/invitations")
def invitations_route(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org_any_standing),
) -> list[dict]:
    """Live owner / Super Admin invite links — for the setup person to copy
    and forward (they may still be limited; they're the one chasing)."""
    try:
        return [_serialize_invitation(i) for i in list_invitations(org_id, member, db)]
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc


class InviteRequest(BaseModel):
    kind: InvitationKind
    # Omit (Super Admin only) for the open admin link — one to paste in a
    # team chat when nobody knows who the Super Admin is.
    email: EmailStr | None = None


@router.post("/organizations/{org_id}/invitations")
def invite_route(
    org_id: uuid.UUID,
    body: InviteRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org_any_standing),
) -> dict:
    """Nominate the owner or Super Admin later (e.g. "I don't know" at
    setup), or get the open admin link (Super Admin, no email)."""
    try:
        return _serialize_invitation(invite_to_org(org_id, member, body.kind, body.email, db))
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
