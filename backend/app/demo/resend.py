"""Send the abandoned Book a Demo recovery email via Resend's HTTP API."""

from __future__ import annotations

import httpx

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)

ISAAC_LINKEDIN = "https://www.linkedin.com/in/isaac-ekwaru-284249217/"
ISAAC_EMAIL = "iekwaru@gmail.com"


def build_recovery_html(*, first_name: str, resume_url: str) -> str:
    name = first_name.strip() or "there"
    return f"""\
<div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#1c1917;">
  <p>Hey {name},</p>
  <p>Great to meet you — I'm Isaac, co-founder of Knohow (Marketing &amp; Sales).
  It looks like you started telling us about your organisation but got pulled away.
  No worries; it happens all the time.</p>
  <p>You can pick up right where you left off here:</p>
  <p><a href="{resume_url}" style="color:#1c1917;font-weight:bold;">Pick up where you left off</a></p>
  <p>It takes about two minutes, and you'll have the option to book time on my
  calendar at the end if that would be helpful. I would love to chat!</p>
  <p>Cheers,<br/>
  Isaac<br/>
  Co-founder, Marketing &amp; Sales<br/>
  Knohow<br/>
  Email · <a href="mailto:{ISAAC_EMAIL}">{ISAAC_EMAIL}</a><br/>
  LinkedIn · <a href="{ISAAC_LINKEDIN}">LinkedIn</a></p>
</div>
"""


def build_recovery_text(*, first_name: str, resume_url: str) -> str:
    name = first_name.strip() or "there"
    return (
        f"Hey {name},\n\n"
        "Great to meet you — I'm Isaac, co-founder of Knohow (Marketing & Sales). "
        "It looks like you started telling us about your organisation but got pulled away. "
        "No worries; it happens all the time.\n\n"
        "You can pick up right where you left off here:\n"
        f"{resume_url}\n\n"
        "It takes about two minutes, and you'll have the option to book time on my "
        "calendar at the end if that would be helpful. I would love to chat!\n\n"
        "Cheers,\n"
        "Isaac\n"
        "Co-founder, Marketing & Sales\n"
        "Knohow\n"
        f"Email · {ISAAC_EMAIL}\n"
        f"LinkedIn · {ISAAC_LINKEDIN}\n"
    )


def send_recovery_email(*, to_email: str, first_name: str, resume_url: str) -> str | None:
    """Returns Resend's email id on success, None if Resend isn't configured."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("demo.resend_skipped_no_api_key")
        return None

    payload = {
        "from": f"Knohow <{settings.resend_from_email}>",
        "to": [to_email],
        "subject": "Pick up where you left off?",
        "html": build_recovery_html(first_name=first_name, resume_url=resume_url),
        "text": build_recovery_text(first_name=first_name, resume_url=resume_url),
    }
    with httpx.Client(timeout=20.0) as client:
        res = client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if res.status_code >= 400:
        logger.error(
            "demo.resend_failed",
            status=res.status_code,
            body=res.text[:500],
            to=to_email,
        )
        res.raise_for_status()
    email_id = res.json().get("id")
    logger.info("demo.resend_sent", to=to_email, resend_id=email_id)
    return email_id
