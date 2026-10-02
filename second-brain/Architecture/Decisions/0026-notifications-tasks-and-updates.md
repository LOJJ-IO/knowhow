---
type: decision
status: active
tags: [area/frontend, area/backend, notifications]
created: 2026-09-27
updated: 2026-09-27
related: ["[[0021-founder-not-owner-leads-self-claim]]", "[[0024-own-drive-consent-for-work-accounts]]", "[[FEAT-core-app-screens]]"]
---

# ADR-0026: Updates move to Notifications; the bell counts tasks and unseen updates

## Status
`active`

## Context
Home had a **Recent updates** button that replayed the week's changes as connector pulses, and no badges on cards (`4ee5629`). The bell's count was mocked at 0. The user (2026-09-27) asked to remove Recent updates, bring back a "New" badge for unseen updates, move updates into a Notifications dialog with pending tasks first, and make the pulses independent of updates.

## Decision
- **Home**: Recent updates removed; **Manage teams** is `size="lg"` and opens an empty `sm` dialog (contents not specified yet). Every connector pulses continuously. A team shows **New** beside its name while it has updates the viewer hasn't seen.
- **Unseen** = the backend's since-last-seen feed at first load (`changesByTeam`); `dashboard-seen` is stamped after that load, so a refresh starts clean. Within a visit: opening the bell clears all, expanding a team clears it, leaving Home clears the rest. State lives in `UpdatesProvider` (`components/app/updates.tsx`), shared by Home and the topbar.
- **Bell count** = pending tasks + unseen update count. Opening it shows **Notifications** (`AppDialog size="sm"`, the Accounts shape): *Pending tasks*, then *Teams* (last week's changes, New on the ones that were unseen).
- **Tasks** (`GET /organizations/{org_id}/tasks`, `onboarding/tasks.py`), shown only to whoever can act: join requests (team lead; owner / Super Admin backup), owner claim (founder or Super Admin, **never the claimant**; `POST …/owner-claim/decision`), no owner and no Super Admin (founder / owner / Super Admin as fits), company Drive not connected (founder / owner / Super Admin), own Drive not connected (you). Join requests and owner claims are decided inline; no owner / no Super Admin open `InviteDialog`; company Drive opens setup's Connect step (`/?connect=workspace`); own Drive opens Google consent.

## Alternatives considered
- Pulses looping only on changed teams, or once on arrival: offered; user chose every team, always.
- Badge clearing only on bell open / only on leaving Home / only per team: user chose all of them plus refresh.
- Tasks only in the count, or updates only: user chose both.

## Consequences
- The founder's own owner claim (from setup's "Yes") needs a Super Admin to confirm it.
- The Manage teams dialog is an empty shell in the Accounts shape until its contents are specified.
- Tests: `backend/tests/test_tasks.py`.
