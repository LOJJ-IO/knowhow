"""What changed in each team, for the dashboard's badges and its pulses.

The source of truth is the **audit log**, not a purpose-built table. Every
action the backend takes already records an entry there, hash-chained and
append-only, so a change feed built on it is complete by construction: a new
action type starts counting the day it is written, with nothing here to
update. That is deliberate — the user asked for badges on *any* change within
a team (2026-09-22), and an enumerated list of event types would start
drifting from reality immediately.

The one thing the audit log doesn't carry is a team. Entries are org-scoped,
so attribution happens here, in one place, by four rules tried in order:

1. `details.team_id` — membership rows carry the team they were written for.
2. `target_resource_id` that is a team's id — the team.* actions.
3. a file id (in `details.file_id` or the target) whose `FileIndex` row has a
   team — every sharing, transfer and reassignment action.
4. nothing — an org-wide change (delegation, onboarding, a rename). Still a
   change, and still shown, but on the organization rather than a team.

Anything that cannot be attributed stays visible as an org-wide change rather
than being dropped: a feed that silently loses events is worse than one that
is occasionally vague about where they happened.
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLogEntry
from app.models.file_index import FileIndex
from app.models.team import Team

#: How many recent entries to carry back per team. The dashboard shows a few
#: under an expanded team, not a log viewer.
PER_TEAM_LIMIT = 6
#: A ceiling on how much of the log one dashboard load will read.
SCAN_LIMIT = 500


def _file_id_of(entry: AuditLogEntry) -> str | None:
    details = entry.details or {}
    for key in ("file_id", "document_id"):
        value = details.get(key)
        if isinstance(value, str):
            return value
    return entry.target_resource_id


def team_changes(
    org_id: uuid.UUID,
    since: datetime | None,
    db: Session,
) -> dict:
    """Changes in `org_id` after `since`, grouped by team.

    `since` of None means "everything we know about" — a member who has never
    opened the dashboard should see that things happened, not an empty slate.
    """
    query = select(AuditLogEntry).where(AuditLogEntry.org_id == org_id)
    if since is not None:
        query = query.where(AuditLogEntry.created_at > since)
    entries = list(
        db.execute(query.order_by(AuditLogEntry.created_at.desc()).limit(SCAN_LIMIT)).scalars()
    )
    if not entries:
        return {"teams": {}, "organization": [], "total": 0}

    team_ids = {
        str(t) for t in db.execute(select(Team.id).where(Team.org_id == org_id)).scalars()
    }

    # One lookup for every file mentioned, rather than one per entry.
    candidate_file_ids = {
        file_id
        for file_id in (_file_id_of(e) for e in entries)
        if file_id and file_id not in team_ids
    }
    file_teams: dict[str, str] = {}
    if candidate_file_ids:
        rows = db.execute(
            select(FileIndex.file_id, FileIndex.team_id).where(
                FileIndex.org_id == org_id, FileIndex.file_id.in_(candidate_file_ids)
            )
        ).all()
        file_teams = {file_id: str(team_id) for file_id, team_id in rows if team_id}

    def team_of(entry: AuditLogEntry) -> str | None:
        details = entry.details or {}
        from_details = details.get("team_id")
        if isinstance(from_details, str) and from_details in team_ids:
            return from_details
        if entry.target_resource_id in team_ids:
            return entry.target_resource_id
        file_id = _file_id_of(entry)
        return file_teams.get(file_id) if file_id else None

    teams: dict[str, dict] = {}
    organization: list[dict] = []
    for entry in entries:
        item = {
            "id": str(entry.id),
            "action": entry.action_type,
            "actor_member_id": str(entry.actor_user_id) if entry.actor_user_id else None,
            "at": entry.created_at.isoformat(),
        }
        team_id = team_of(entry)
        if team_id is None:
            if len(organization) < PER_TEAM_LIMIT:
                organization.append(item)
            continue
        bucket = teams.setdefault(team_id, {"count": 0, "latest_at": item["at"], "events": []})
        bucket["count"] += 1
        # Entries arrive newest first, so the first one seen is the latest.
        if len(bucket["events"]) < PER_TEAM_LIMIT:
            bucket["events"].append(item)

    return {"teams": teams, "organization": organization, "total": len(entries)}
