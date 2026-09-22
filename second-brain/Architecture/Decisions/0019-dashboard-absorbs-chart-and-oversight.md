---
type: decision
status: active
tags: [area/frontend, area/backend, area/design]
created: 2026-09-22
updated: 2026-09-22
related: ["[[0018-dashboard-reflects-onboarding]]", "[[FEAT-core-app-screens]]", "[[0015-seeded-generative-identity-system]]", "[[0016-app-reads-the-backend-not-fixtures]]"]
---

# ADR-0019: The dashboard is the org chart and oversight in one, and changes are read from the audit log

## Status
`active`

## Context
`/dashboard`, `/org-chart` and `/oversight` were three screens answering one question from three
angles. The user's direction (2026-09-22): the dashboard **is** the org chart and oversight at once,
teams expand by a caret to enumerate members, a team that changed carries a badge and a highlighted
border, and connectors carry a data-transfer pulse.

Supersedes the three-screen split in [[FEAT-core-app-screens]] for these two screens only; the other
five are unaffected.

## Decision

**1. One screen.** `/org-chart` and `/oversight` are deleted, routes and nav rows both. The chart is the
layout, the changes drawn on it are the oversight. "What changed?" is always asked about a particular
team, so the two belong on the same object.

**2. Changes come from the audit log, not a new table.** `app/activity/changes.py` reads
`audit_log_entries` — already hash-chained and append-only — so the feed is **complete by
construction**: a new action type starts counting the day it is first written, with nothing to update
here. The user asked for badges on *any* change in a team, and an enumerated list of event types would
have started drifting from reality immediately.

**3. Team attribution is four rules, in one place.** Audit entries are org-scoped, so:
   1. `details.team_id` — membership rows carry the team they were written for.
   2. `target_resource_id` that is a team id — the `org_chart.team.*` actions.
   3. a file id whose `FileIndex` row has a team — every sharing, transfer and reassignment action.
   4. otherwise it is an **organization-wide** change: still shown, never dropped. A feed that silently
      loses events is worse than one that is occasionally vague about where they happened.

**4. "New" means since *you* last opened the dashboard.** `org_members.dashboard_seen_at` (migration
`0016_dashboard_seen`), per person rather than per device, so signing in on a laptop doesn't leave stale
badges on a phone. Null means never opened, and everything counts. **Reading does not clear it**: the
frontend fetches, draws, then `POST /organizations/{id}/dashboard-seen`. Clearing first would erase the
badges in the render meant to show them.

**5. The pulse is driven by real events only** (the user's choice over an ambient option). An edge
pulses because that team actually changed; an edge with no news is a plain static line. Quiet is the
correct state when nothing has happened — including today, when no Drive data exists at all.

Pulse spec, as built (`src/components/app/edge-pulse.tsx`): the line never moves; a 2.6px core with one
restrained halo, no trail or particles; ~680ms with an ease that starts fast and settles; fades out over
the last fifth and never bounces back; every ~7s per active edge, staggered by 900ms so several edges
never fire in lockstep; direction is **team → owner**, because oversight flows upward; position comes
from `getPointAtLength` on the live path, so a pulse follows a card being dragged mid-flight; disabled
entirely under `prefers-reduced-motion`, where the badge carries the same information without moving.

**6. The canvas fits the window, and rows use the full width** (user 2026-09-22). Height is
**measured** (`getBoundingClientRect().top` against `window.innerHeight`) rather than inherited through
flex, because a percentage height only resolves if every ancestor has a definite one and a single
missing link collapses it to content height — see [[Lessons-Learned]]. Spare height goes into the row
gap, so cards keep their designed size instead of scaling. `spread` lays each row out from the real card
widths with equal gutters, rather than at `x` fractions that leave a wide canvas empty at both ends.
Content taller or wider than the canvas scrolls rather than shrinking.

## Consequences
- Backend: `changes` and `viewer_last_seen_at` on the overview payload, one new route, one migration,
  4 new tests (attribution by each rule, file→team resolution, stamping, never-opened). Suite: **116
  passing**.
- Adding an onboarding or sharing action now shows up on the dashboard for free, but a *new kind of
  target* (something that is neither a team, a file, nor org-wide) would land in the organization
  bucket until a fifth rule is added.
- `describe()` on the frontend maps known action types to sentences and tidies unknown ones rather than
  rendering blanks — the same open-endedness, honoured in the UI.
- `SCAN_LIMIT` caps one dashboard load at 500 entries. A very busy org would see a capped count, which
  is the right trade for a screen that loads on every sign-in.
