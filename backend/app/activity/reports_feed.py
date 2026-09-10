import uuid
from datetime import datetime, timezone

from dateutil import parser as date_parser
from google.oauth2 import service_account
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from app.activity.detection import ActivityEvent
from app.exceptions import DelegationNotApproved
from app.google.drive_client import load_service_account_info
from app.google.retry import google_api_call
from app.google.scopes import DOMAIN_DELEGATION_SCOPES
from app.models.delegation_grant import DelegationStatus
from app.models.organization import Organization

# Admin SDK Reports API scope — read-only, org-wide Drive activity feed for
# domain members. Requested alongside DOMAIN_DELEGATION_SCOPES on the same
# service account; separate from the Drive scope itself since this is a
# different API surface (audit/reporting, not file mutation).
REPORTS_SCOPE = "https://www.googleapis.com/auth/admin.reports.audit.readonly"


def _reports_client(admin_email: str):
    info = load_service_account_info()
    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=[*DOMAIN_DELEGATION_SCOPES, REPORTS_SCOPE]
    ).with_subject(admin_email)
    return build("admin", "reports_v1", credentials=credentials)


def poll_domain_activity(org_id: uuid.UUID, db: Session, since: datetime | None = None) -> list[ActivityEvent]:
    """Org-wide Drive activity for domain members via the Admin SDK Reports
    API, impersonating the approving admin — deliberately NOT one watch
    channel per member, which would mean maintaining and renewing N
    expiring subscriptions per organization instead of one polled feed.
    Personal-account members have no equivalent org-wide view and are
    covered separately by per-user watch channels (see watch_channels.py).

    Note: this feed can lag minutes to hours behind real activity — fine
    for the reconciliation sweep this mainly feeds, but see
    app/activity/detection.py for why the latency-sensitive
    "did you mean to share this?" path is kept swappable to a faster
    source rather than assuming this feed is fast enough for that.
    """
    org = db.get(Organization, org_id)
    if org is None:
        raise ValueError(f"no Organization with id={org_id}")

    grant = org.delegation_grant
    if grant is None or grant.status != DelegationStatus.APPROVED or grant.approving_admin_email is None:
        raise DelegationNotApproved(f"organization {org_id} has no approved delegation with a recorded admin")

    reports = _reports_client(grant.approving_admin_email)
    params = {"userKey": "all", "applicationName": "drive", "maxResults": 1000}
    if since is not None:
        params["startTime"] = since.astimezone(timezone.utc).isoformat()

    events: list[ActivityEvent] = []
    page_token = None
    while True:
        if page_token:
            params["pageToken"] = page_token
        response = google_api_call(reports.activities().list(**params).execute)

        for item in response.get("items", []):
            actor_email = item.get("actor", {}).get("email")
            occurred_at = date_parser.isoparse(item["id"]["time"])
            unique_qualifier = item["id"].get("uniqueQualifier", "")

            for event in item.get("events", []):
                event_name = event.get("name")
                if event_name not in ("create", "edit", "new_access"):
                    continue
                file_id = next(
                    (p.get("value") for p in event.get("parameters", []) if p.get("name") == "doc_id"), None
                )
                title = next(
                    (p.get("value") for p in event.get("parameters", []) if p.get("name") == "doc_title"), None
                )
                if not file_id:
                    continue

                events.append(
                    ActivityEvent(
                        org_id=org_id,
                        file_id=file_id,
                        event_type="created" if event_name == "create" else "modified",
                        actor_email=actor_email,
                        source="reports_feed",
                        event_key=f"reports_feed:{file_id}:{event_name}:{occurred_at.isoformat()}:{unique_qualifier}",
                        occurred_at=occurred_at,
                        title=title,
                        file_type=None,
                        created_via_knohow=False,
                    )
                )

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return events
