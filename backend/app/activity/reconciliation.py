import uuid
from datetime import datetime, timezone

from googleapiclient.errors import HttpError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.activity.detection import ActivityEvent, handle_activity_event
from app.exceptions import PersonalAccountNotConsented
from app.google.drive_client import get_drive_client_for_user
from app.google.retry import google_api_call
from app.models.file_index import FileIndex
from app.models.org_member import OrgMember


def _list_owned_files(member_id: uuid.UUID, db: Session) -> list[dict]:
    drive = get_drive_client_for_user(member_id, db=db)
    files: list[dict] = []
    page_token = None
    while True:
        response = google_api_call(
            drive.files()
            .list(
                q="'me' in owners and trashed = false",
                fields="nextPageToken, files(id, name, mimeType, createdTime, modifiedTime)",
                pageSize=200,
                pageToken=page_token,
            )
            .execute
        )
        files.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break
    return files


def reconcile_organization(org_id: uuid.UUID, db: Session) -> dict:
    """Periodic full sweep per organization: catches drift (FileIndex
    metadata falling out of sync) and missed events (a file that was
    created/shared while a webhook or the Reports feed didn't (yet) surface
    it). Runs over every member — expect quota pressure here, which is why
    every Drive call in this codebase, this sweep included, goes through
    google_api_call rather than calling the API directly.
    """
    members = db.execute(select(OrgMember).where(OrgMember.organization_id == org_id)).scalars().all()

    files_synced = 0
    new_files_detected = 0
    errors = 0

    for member in members:
        try:
            owned_files = _list_owned_files(member.id, db)
        except PersonalAccountNotConsented:
            continue
        except HttpError:
            errors += 1
            continue

        for f in owned_files:
            file_id = f["id"]
            now = datetime.now(timezone.utc)
            existing = db.get(FileIndex, file_id)

            if existing is None:
                # Never seen before — treat as a (possibly missed) creation
                # event so it goes through the normal sharing-engine
                # reaction rather than silently appearing in FileIndex.
                event = ActivityEvent(
                    org_id=org_id,
                    file_id=file_id,
                    event_type="created",
                    actor_email=member.email,
                    source="reconciliation_sweep",
                    event_key=f"reconciliation_sweep:{file_id}:created",
                    occurred_at=now,
                    title=f.get("name", ""),
                    file_type=f.get("mimeType", "unknown"),
                    created_via_knohow=False,
                )
                handle_activity_event(event, db)
                new_files_detected += 1
            else:
                existing.title = f.get("name", existing.title)
                existing.last_synced_at = now
                db.commit()
            files_synced += 1

    return {
        "org_id": str(org_id),
        "members_swept": len(members),
        "files_synced": files_synced,
        "new_files_detected": new_files_detected,
        "errors": errors,
    }
