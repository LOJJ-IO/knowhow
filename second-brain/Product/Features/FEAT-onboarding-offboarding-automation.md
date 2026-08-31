---
type: feature
status: shipped
tags: [area/backend, area/frontend]
created: 2026-08-31
updated: 2026-08-31
related: ["[[Product-Vision]]", "[[FEAT-org-chart-builder]]", "[[0001-mocked-data-first-prototype]]"]
---

# FEAT: Onboarding / offboarding automation

## Status
`shipped` (mocked-data prototype — the automation is real, the Google API calls behind it are not)

## Problem
This is the feature the user explicitly asked for: "automated onboarding and offboarding for Google Workspace." Manually granting/revoking access and reassigning documents when people join or leave is exactly the kind of thing that gets forgotten.

## Solution
`src/lib/workspace.ts` — the engine, called from `src/app/(app)/team/[teamId]/actions.ts`:

- **`onboardPerson(orgId, teamId, actorId, name, email, role)`** — creates the `User`, checks for an existing email first (throws a friendly error instead of an unhandled unique-constraint 500 — see [[Lessons-Learned]]), applies the team's `SharingPolicy`, writes `ONBOARDED` + (if policy is on) `DOC_AUTO_SHARED` activity events. Returns `{ userId, appsGranted, autoShareEnabled }` which the UI shows as an inline summary.
- **`offboardPerson(orgId, userId, actorId)`** — sets `status = OFFBOARDED`, reassigns every document they owned to a successor (their team leader, or the org owner if they *were* the leader), vacates their team-leader seat if they held one, writes `OFFBOARDED` + one `DOC_REASSIGNED` event per document + one `ACCESS_REVOKED` event. Returns `{ userId, docsTransferred, accessRevoked }`.

Both are wrapped by Server Actions that `revalidatePath` every route that shows the result (`/team/[teamId]/people`, `/dashboard`, `/activity`, `/org-chart`), and the client (`src/components/team/people-manager.tsx`) shows the returned summary inline plus calls `router.refresh()`.

The `/activity` page (`getRecentActivity`) is the audit trail that makes this automation visible and checkable — every onboarding/offboarding/sharing action the "system" has taken, in order.

## Out of scope
- Real Google Admin SDK provisioning/deprovisioning (see [[0001-mocked-data-first-prototype]]).
- Bulk offboarding.
- Undo/reinstate a removed person (currently one-way — `status: OFFBOARDED` has no path back).

## UI/UX
`src/components/team/people-manager.tsx` — roster list with per-person "Make leader" / "View as" / "Remove" actions, an Add Person form, and an inline result banner (success = muted box, error = destructive-tinted box).

## Technical approach
Two separate `useTransition` hooks (add vs. remove) so the "Add Person" button doesn't show a stale "Adding…" label while an unrelated remove is in flight — see [[Lessons-Learned]] for why this mattered.

## Open questions
- When `offboardPerson` reassigns documents, should the previous owner's name stay attached to historical activity events even after their `User` row is offboarded? Currently yes (soft-delete via `status`, never hard-deleted) — intentional, keeps the audit trail readable.

## Related
[[FEAT-org-chart-builder]], [[FEAT-doc-visibility-dashboard]], [[Architecture-Overview]]
