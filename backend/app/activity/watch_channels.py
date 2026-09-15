import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from googleapiclient.errors import HttpError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.exceptions import PersonalAccountNotConsented
from app.google.drive_client import get_drive_client_for_user
from app.google.retry import google_api_call
from app.models.activity import WatchChannel
from app.models.org_member import AuthType, OrgMember

# Drive push notification channels expire within a fixed maximum window;
# Google enforces the upper bound, this is Knohow's own renewal threshold
# (renew with this much runway left, well inside Google's cap).
CHANNEL_TTL = timedelta(hours=24)
RENEWAL_THRESHOLD = timedelta(hours=2)


def register_watch_channel(org_id: uuid.UUID, member_id: uuid.UUID, db: Session) -> WatchChannel:
    """Personal-account members have no domain-level activity view (unlike
    domain members, covered by the org-wide Reports feed — see
    reports_feed.py) — for them ONLY, Knohow maintains a per-user Drive
    push notification channel, with the scheduled renewal this module's
    other function handles, since these channels expire within days."""
    member = db.get(OrgMember, member_id)
    if member is None:
        raise ValueError(f"no OrgMember with id={member_id}")
    if member.auth_type != AuthType.PERSONAL_OAUTH:
        raise ValueError("watch channels are only used for personal-account members")

    drive = get_drive_client_for_user(member_id, db=db)
    channel_id = str(uuid.uuid4())
    webhook_token = secrets.token_urlsafe(32)
    expiration_ms = int((datetime.now(timezone.utc) + CHANNEL_TTL).timestamp() * 1000)
    start_page_token = google_api_call(drive.changes().getStartPageToken().execute)["startPageToken"]

    response = google_api_call(
        drive.changes()
        .watch(
            pageToken=start_page_token,
            body={
                "id": channel_id,
                "type": "web_hook",
                "address": _webhook_address(),
                "expiration": expiration_ms,
                "token": webhook_token,
            },
        )
        .execute
    )

    channel = WatchChannel(
        id=uuid.uuid4(),
        org_id=org_id,
        member_id=member_id,
        channel_id=channel_id,
        resource_id=response["resourceId"],
        page_token=start_page_token,
        webhook_token=webhook_token,
        expires_at=datetime.fromtimestamp(int(response["expiration"]) / 1000, tz=timezone.utc),
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


def _webhook_address() -> str:
    settings = get_settings()
    # The backend's own public URL is not currently a dedicated setting —
    # FRONTEND_ORIGIN is the frontend's. Railway exposes the service's own
    # public domain as RAILWAY_PUBLIC_DOMAIN; fall back to it here rather
    # than adding a new required setting for a single derived value.
    domain = os.environ.get("RAILWAY_PUBLIC_DOMAIN")
    base = f"https://{domain}" if domain else settings.frontend_origin
    return f"{base}/webhooks/drive-changes"


def renew_expiring_channels(db: Session) -> int:
    """Scheduled job (see app/jobs/scheduler.py): re-registers any
    personal-account watch channel expiring within RENEWAL_THRESHOLD.
    Google does not support extending a channel's expiration in place —
    renewal means stopping the old one and creating a new one."""
    cutoff = datetime.now(timezone.utc) + RENEWAL_THRESHOLD
    expiring = db.execute(select(WatchChannel).where(WatchChannel.expires_at < cutoff)).scalars().all()

    renewed = 0
    for channel in expiring:
        try:
            drive = get_drive_client_for_user(channel.member_id, db=db)
            google_api_call(
                drive.channels().stop(body={"id": channel.channel_id, "resourceId": channel.resource_id}).execute
            )
        except PersonalAccountNotConsented:
            db.delete(channel)
            db.commit()
            continue
        except HttpError:
            # Best-effort stop — an already-expired/unknown channel on
            # Google's side must not block issuing the replacement below.
            pass

        db.delete(channel)
        db.commit()
        register_watch_channel(channel.org_id, channel.member_id, db)
        renewed += 1

    return renewed


def process_notification(
    channel_id: str, resource_state: str, message_number: str | None, webhook_token: str | None, db: Session
) -> list:
    """Handles one Drive push notification delivery. The webhook payload
    itself carries no details — only "something changed" — so this fetches
    what actually changed via changes.list(pageToken=...) and advances the
    stored page_token past what was just read, then converts each change
    into an ActivityEvent and dispatches it through the same
    handle_activity_event() every other detection source uses.

    resource_state "sync" is Drive's initial handshake on channel
    creation, not a real change — ignored here rather than processed.
    """
    from app.activity.detection import ActivityEvent, handle_activity_event  # avoids a module-load cycle
    from app.exceptions import WebhookTokenMismatch
    from app.models.file_index import FileIndex

    channel = db.execute(select(WatchChannel).where(WatchChannel.channel_id == channel_id)).scalar_one_or_none()
    if channel is None:
        return []
    if webhook_token != channel.webhook_token:
        raise WebhookTokenMismatch(f"token mismatch for channel {channel_id}")

    if resource_state == "sync":
        return []

    member = db.get(OrgMember, channel.member_id)
    if member is None:
        return []

    try:
        drive = get_drive_client_for_user(channel.member_id, db=db)
    except PersonalAccountNotConsented:
        return []

    results = []
    page_token = channel.page_token
    while page_token:
        response = google_api_call(
            drive.changes()
            .list(pageToken=page_token, fields="nextPageToken,newStartPageToken,changes(fileId,file(name,mimeType,trashed))")
            .execute
        )
        for change in response.get("changes", []):
            file_info = change.get("file")
            if not file_info or file_info.get("trashed"):
                continue
            # No FileIndex row yet means this is the first time Knohow has
            # seen this file — treated as a creation event so it goes
            # through the sharing engine's Auto-Share/Auto-Own/SuggestedShare
            # reaction, same as the reconciliation sweep's equivalent check.
            event_type = "created" if db.get(FileIndex, change["fileId"]) is None else "modified"
            event = ActivityEvent(
                org_id=channel.org_id,
                file_id=change["fileId"],
                event_type=event_type,
                actor_email=member.email,
                source="watch_channel",
                event_key=f"watch_channel:{channel_id}:{change['fileId']}:{message_number or page_token}",
                occurred_at=datetime.now(timezone.utc),
                title=file_info.get("name"),
                file_type=file_info.get("mimeType"),
                created_via_knohow=False,
            )
            results.append(handle_activity_event(event, db))

        page_token = response.get("nextPageToken")
        if not page_token:
            channel.page_token = response.get("newStartPageToken", channel.page_token)
            db.commit()
            break

    return results
