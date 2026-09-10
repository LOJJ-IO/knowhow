from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.activity.watch_channels import process_notification
from app.api.deps import get_db

router = APIRouter(tags=["webhooks"])


@router.post("/webhooks/drive-changes")
def drive_changes_webhook(
    db: Session = Depends(get_db),
    x_goog_channel_id: str = Header(...),
    x_goog_resource_state: str = Header(...),
    x_goog_message_number: str | None = Header(default=None),
    x_goog_channel_token: str | None = Header(default=None),
) -> dict:
    """Receives Drive's push notification for a personal-account member's
    watch channel (see app/activity/watch_channels.py::register_watch_channel).
    Google expects a fast 200 here regardless of what was found — the actual
    work (fetching and dispatching the underlying changes) happens
    synchronously in process_notification, which is intentionally cheap
    (bounded by changes.list pagination, itself behind google_api_call's
    retry/backoff)."""
    results = process_notification(
        x_goog_channel_id, x_goog_resource_state, x_goog_message_number, x_goog_channel_token, db
    )
    return {"processed": len(results)}
