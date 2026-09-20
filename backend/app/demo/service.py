"""Book a Demo lead persistence + abandoned-recovery sends."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.demo.resend import send_recovery_email
from app.logging_config import get_logger
from app.models.demo_lead import DemoLead

logger = get_logger(__name__)

VALID_STEPS = frozenset({"names", "email", "website", "segment", "size", "booking"})


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def resume_url(token: str) -> str:
    return f"{get_settings().frontend_origin}/?demo_resume={token}"


def lead_to_dict(lead: DemoLead) -> dict:
    return {
        "id": str(lead.id),
        "email": lead.email,
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "website": lead.website,
        "segment": lead.segment,
        "other_text": lead.other_text,
        "team_size": lead.team_size,
        "step": lead.step,
        "resume_token": lead.resume_token,
        "recovery_sent": lead.recovery_sent_at is not None,
        "cancelled": lead.cancelled_at is not None,
        "booked": lead.booked_at is not None,
    }


def upsert_lead(
    db: Session,
    *,
    email: str,
    first_name: str = "",
    last_name: str = "",
    website: str | None = None,
    segment: str | None = None,
    other_text: str | None = None,
    team_size: str | None = None,
    step: str = "email",
) -> DemoLead:
    email_norm = email.strip().lower()
    if not email_norm or "@" not in email_norm:
        raise ValueError("a valid work email is required")
    if step not in VALID_STEPS:
        raise ValueError(f"invalid step: {step}")

    now = _now()
    lead = db.execute(select(DemoLead).where(DemoLead.email == email_norm)).scalar_one_or_none()
    if lead is None:
        lead = DemoLead(
            id=uuid.uuid4(),
            email=email_norm,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            website=website,
            segment=segment,
            other_text=other_text,
            team_size=team_size,
            step=step,
            resume_token=_new_token(),
            last_activity_at=now,
            updated_at=now,
        )
        db.add(lead)
    else:
        # Fresh activity — if they abandoned before and come back typing,
        # clear cancel only when they explicitly reopen/cancel; reopen sets
        # cancelled. Upsert from an in-progress form resets activity and
        # clears cancel so a new idle window can start (they resumed in-app).
        lead.first_name = first_name.strip() or lead.first_name
        lead.last_name = last_name.strip() or lead.last_name
        if website is not None:
            lead.website = website
        if segment is not None:
            lead.segment = segment
        if other_text is not None:
            lead.other_text = other_text
        if team_size is not None:
            lead.team_size = team_size
        lead.step = step
        lead.last_activity_at = now
        lead.updated_at = now
        # In-sheet progress means they're back — allow a future send only if
        # they never got one and weren't booked. Re-arm by clearing cancel
        # from a prior "reopen" when they keep filling the form.
        if lead.booked_at is None and lead.recovery_sent_at is None:
            lead.cancelled_at = None

    db.commit()
    db.refresh(lead)
    return lead


def touch_activity(db: Session, token: str) -> DemoLead | None:
    lead = db.execute(select(DemoLead).where(DemoLead.resume_token == token)).scalar_one_or_none()
    if lead is None:
        return None
    now = _now()
    lead.last_activity_at = now
    lead.updated_at = now
    if lead.booked_at is None and lead.recovery_sent_at is None:
        lead.cancelled_at = None
    db.commit()
    db.refresh(lead)
    return lead


def update_by_token(
    db: Session,
    token: str,
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    website: str | None = None,
    segment: str | None = None,
    other_text: str | None = None,
    team_size: str | None = None,
    step: str | None = None,
) -> DemoLead | None:
    lead = db.execute(select(DemoLead).where(DemoLead.resume_token == token)).scalar_one_or_none()
    if lead is None:
        return None
    if step is not None and step not in VALID_STEPS:
        raise ValueError(f"invalid step: {step}")
    now = _now()
    if first_name is not None:
        lead.first_name = first_name.strip()
    if last_name is not None:
        lead.last_name = last_name.strip()
    if website is not None:
        lead.website = website
    if segment is not None:
        lead.segment = segment
    if other_text is not None:
        lead.other_text = other_text
    if team_size is not None:
        lead.team_size = team_size
    if step is not None:
        lead.step = step
    lead.last_activity_at = now
    lead.updated_at = now
    if lead.booked_at is None and lead.recovery_sent_at is None:
        lead.cancelled_at = None
    db.commit()
    db.refresh(lead)
    return lead


def cancel_lead(db: Session, token: str, *, reason: str) -> DemoLead | None:
    """Suppress a pending recovery send (reopen, CTA, or book)."""
    lead = db.execute(select(DemoLead).where(DemoLead.resume_token == token)).scalar_one_or_none()
    if lead is None:
        return None
    now = _now()
    lead.cancelled_at = now
    lead.updated_at = now
    if reason == "booked":
        lead.booked_at = now
        lead.step = "booking"
    db.commit()
    db.refresh(lead)
    logger.info("demo.lead_cancelled", reason=reason, email=lead.email)
    return lead


def get_by_token(db: Session, token: str) -> DemoLead | None:
    return db.execute(select(DemoLead).where(DemoLead.resume_token == token)).scalar_one_or_none()


def send_due_recovery_emails(db: Session) -> int:
    """One-shot Resend for leads idle longer than the configured window."""
    settings = get_settings()
    idle = timedelta(seconds=settings.demo_recovery_idle_seconds)
    cutoff = _now() - idle
    due = db.execute(
        select(DemoLead).where(
            DemoLead.recovery_sent_at.is_(None),
            DemoLead.cancelled_at.is_(None),
            DemoLead.booked_at.is_(None),
            DemoLead.last_activity_at <= cutoff,
        )
    ).scalars().all()

    sent = 0
    for lead in due:
        try:
            send_recovery_email(
                to_email=lead.email,
                first_name=lead.first_name,
                resume_url=resume_url(lead.resume_token),
            )
            lead.recovery_sent_at = _now()
            lead.updated_at = _now()
            db.commit()
            sent += 1
        except Exception:
            db.rollback()
            logger.exception("demo.recovery_send_failed", email=lead.email)
    return sent
