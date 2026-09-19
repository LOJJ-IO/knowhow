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
from app.auth.pkce import InvalidOAuthState
from app.models.org_member import OrgMember
from app.onboarding.service import (
    add_member,
    approve_member,
    list_pending_members,
    set_auto_accept_workspace_members,
    complete_signup,
    confirm_owner,
    create_domainless_org,
    create_org_chart,
    is_founding_member,
    start_signup,
)

router = APIRouter(tags=["onboarding"])


@router.get("/onboarding/signup")
def signup(switch_account: bool = False) -> RedirectResponse:
    result = start_signup(switch_account=switch_account)
    return RedirectResponse(result.authorization_url, status_code=status.HTTP_302_FOUND)


@router.get("/onboarding/signup/callback")
def signup_callback(code: str, state: str, db: Session = Depends(get_db)) -> RedirectResponse:
    try:
        return signup_redirect(complete_signup(code, state, db))
    except InvalidOAuthState as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid or expired signup state: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/onboarding/personal-org")
def personal_org(
    response: Response,
    db: Session = Depends(get_db),
    knohow_pending_signup: str | None = Cookie(default=None),
) -> dict:
    """The "No / just me" answer after a personal-account sign-in: creates
    the person's domainless org and starts their session."""
    if knohow_pending_signup is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no pending personal signup — sign in with Google again")
    try:
        result = create_domainless_org(knohow_pending_signup, db)
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
        "owner_confirmation_pending": result.owner_confirmation_link_token is not None,
    }


@router.get("/onboarding/confirm-owner/{token}")
def confirm_owner_route(token: str, db: Session = Depends(get_db)) -> dict:
    try:
        org_chart = confirm_owner(token, db)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {"org_chart_id": str(org_chart.id), "owner_member_id": str(org_chart.owner_member_id)}


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
