import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.members.lookup import resolve_member_by_email
from app.sharing.service import handle_file_created


@dataclass
class ActivityEvent:
    """A detected Drive event, normalized to one shape regardless of which
    source produced it. Every field the sharing engine needs is here so
    handle_activity_event never has to reach back into a source-specific
    payload — this is what keeps the detection source swappable (see the
    module docstring below).
    """

    org_id: uuid.UUID
    file_id: str
    event_type: str  # "created" | "modified" | "shared"
    actor_email: str | None
    source: str  # e.g. "reports_feed", "drive_activity_api", "watch_channel", "reconciliation_sweep"
    # Stable identifier for idempotency — must be reconstructible identically
    # on redelivery. Convention: "{source}:{file_id}:{event_type}:{occurred_at.isoformat()}".
    event_key: str
    occurred_at: datetime
    title: str | None = None
    file_type: str | None = None
    created_via_knohow: bool = False


def handle_activity_event(event: ActivityEvent, db: Session) -> dict | None:
    """The single entry point every activity source (Reports feed sweep,
    Drive Activity API, a personal-account watch channel notification, or a
    reconciliation sweep) calls into. Deliberately source-agnostic: nothing
    below branches on event.source except to pass it through as
    SuggestedShare.detected_via. That decoupling is what lets a
    lower-latency source (Drive Activity API, or per-user watch channels
    for high-value members) be substituted later for the
    latency-sensitive "did you mean to share this?" path without touching
    the sharing engine at all — the Reports/Admin SDK feed used today can
    lag minutes to hours, which is fine for reconciliation/dashboards but
    would be too slow if this dispatcher were hardcoded to only accept
    events shaped like that one feed.

    Idempotent: every event is keyed on event.event_key, recorded in
    ProcessedActivityEvent under a unique constraint. Google redelivers
    notifications; a duplicate delivery hits the IntegrityError branch and
    is a no-op, not reprocessed.
    """
    from app.models.activity import ProcessedActivityEvent  # local import: avoids a cycle at module load time

    try:
        db.add(
            ProcessedActivityEvent(id=uuid.uuid4(), org_id=event.org_id, event_key=event.event_key, source=event.source)
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        return None

    if event.event_type != "created":
        # Modification/share events currently only need the idempotency
        # ledger entry above (dedup for future handlers); the sharing
        # engine's reaction is defined for file *creation* only, per this
        # module's spec. Extending this dispatcher to update FileIndex
        # metadata on "modified" events is a natural next step, not built
        # here to keep this pass scoped to what's specified.
        return None

    creator = resolve_member_by_email(event.org_id, event.actor_email, db)
    if creator is None:
        return None

    return handle_file_created(
        org_id=event.org_id,
        file_id=event.file_id,
        title=event.title or "",
        file_type=event.file_type or "unknown",
        creator_user_id=creator.id,
        created_via_knohow=event.created_via_knohow,
        detected_via=event.source,
        db=db,
    )
