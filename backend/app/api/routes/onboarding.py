import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_same_org
from app.api.routes.auth import set_session_cookies  # reuse: same cookie contract as login
from app.auth.pkce import InvalidOAuthState
from app.config import get_settings
from app.models.org_member import OrgMember
from app.onboarding.service import add_member, complete_signup, confirm_owner, create_org_chart, start_signup

router = APIRouter(tags=["onboarding"])


@router.get("/onboarding/signup")
def signup() -> RedirectResponse:
    result = start_signup()
    return RedirectResponse(result.authorization_url, status_code=status.HTTP_302_FOUND)


@router.get("/onboarding/signup/callback")
def signup_callback(code: str, state: str, db: Session = Depends(get_db)) -> RedirectResponse:
    settings = get_settings()
    try:
        result = complete_signup(code, state, db)
    except InvalidOAuthState as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid or expired signup state: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    response = RedirectResponse(settings.frontend_origin, status_code=status.HTTP_302_FOUND)
    set_session_cookies(response, result.access_token, result.refresh_token)
    return response


class CreateOrgChartRequest(BaseModel):
    is_owner: bool
    is_super_admin: bool
    owner_email: EmailStr | None = None


@router.post("/organizations/{org_id}/org-chart")
def create_org_chart_route(
    org_id: uuid.UUID,
    body: CreateOrgChartRequest,
    db: Session = Depends(get_db),
    member: OrgMember = Depends(require_same_org),
) -> dict:
    if not body.is_owner and not body.owner_email:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "owner_email is required when the initiator is not the owner"
        )

    result = create_org_chart(
        org_id, member.id, body.is_owner, body.is_super_admin, db, owner_email=body.owner_email
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
