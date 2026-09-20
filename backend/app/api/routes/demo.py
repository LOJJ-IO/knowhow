from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.demo import service as demo_service

router = APIRouter(tags=["demo"])


class UpsertDemoLeadRequest(BaseModel):
    email: EmailStr
    first_name: str = ""
    last_name: str = ""
    website: str | None = None
    segment: str | None = None
    other_text: str | None = None
    team_size: str | None = None
    step: Literal["names", "email", "website", "segment", "size", "booking"] = "email"


class PatchDemoLeadRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    website: str | None = None
    segment: str | None = None
    other_text: str | None = None
    team_size: str | None = None
    step: Literal["names", "email", "website", "segment", "size", "booking"] | None = None


class CancelDemoLeadRequest(BaseModel):
    reason: Literal["reopen", "cta", "booked"] = Field(default="reopen")


@router.post("/demo-leads")
def upsert_demo_lead(body: UpsertDemoLeadRequest, db: Session = Depends(get_db)) -> dict:
    """Create or update a lead once a valid work email exists. Public — no auth."""
    lead = demo_service.upsert_lead(
        db,
        email=str(body.email),
        first_name=body.first_name,
        last_name=body.last_name,
        website=body.website,
        segment=body.segment,
        other_text=body.other_text,
        team_size=body.team_size,
        step=body.step,
    )
    return demo_service.lead_to_dict(lead)


@router.patch("/demo-leads/by-token/{token}")
def patch_demo_lead(
    token: str, body: PatchDemoLeadRequest, db: Session = Depends(get_db)
) -> dict:
    lead = demo_service.update_by_token(
        db,
        token,
        first_name=body.first_name,
        last_name=body.last_name,
        website=body.website,
        segment=body.segment,
        other_text=body.other_text,
        team_size=body.team_size,
        step=body.step,
    )
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown resume token")
    return demo_service.lead_to_dict(lead)


@router.post("/demo-leads/by-token/{token}/touch")
def touch_demo_lead(token: str, db: Session = Depends(get_db)) -> dict:
    lead = demo_service.touch_activity(db, token)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown resume token")
    return {"ok": True, "last_activity_at": lead.last_activity_at.isoformat()}


@router.post("/demo-leads/by-token/{token}/cancel")
def cancel_demo_lead(
    token: str, body: CancelDemoLeadRequest, db: Session = Depends(get_db)
) -> dict:
    lead = demo_service.cancel_lead(db, token, reason=body.reason)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown resume token")
    return demo_service.lead_to_dict(lead)


@router.get("/demo-leads/resume/{token}")
def resume_demo_lead(token: str, db: Session = Depends(get_db)) -> dict:
    """Email CTA: load progress and cancel any pending recovery send."""
    lead = demo_service.get_by_token(db, token)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown resume token")
    # Clicking the CTA cancels a pending send (and marks the one-shot done path).
    demo_service.cancel_lead(db, token, reason="cta")
    lead = demo_service.get_by_token(db, token)
    assert lead is not None
    return demo_service.lead_to_dict(lead)
