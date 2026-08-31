---
type: feature
status: shipped
tags: [area/frontend, area/backend]
created: 2026-08-31
updated: 2026-08-31
related: ["[[Product-Vision]]", "[[FEAT-doc-visibility-dashboard]]", "[[Architecture-Overview]]"]
---

# FEAT: Org chart builder

## Status
`shipped` (mocked-data prototype — see [[0001-mocked-data-first-prototype]])

## Problem
Every other feature (doc visibility, sharing policy, onboarding/offboarding) needs a structure to hang off: who owns the org, what teams exist, who leads them.

## Solution
- `/org-chart` — Step 1 shows the org owner (the account that signed up); Step 2 lists teams with leader + member count and a "Create New Team" form (`createTeam` server action in `src/app/(app)/org-chart/actions.ts`), each team creation also creates a default `SharingPolicy` (auto-share with leader + owner, both on).
- `/team/[teamId]/people` — per-team roster: add a person (name/email/role → `onboardPerson`, see [[FEAT-onboarding-offboarding-automation]]), promote a member to leader (`setTeamLeader`), remove a person (→ `offboardPerson`), and a demo-only "View as" (`viewAs` in `src/app/(auth)/actions.ts`) to see what that person's dashboard looks like without a password.

## Out of scope
- Nested teams / sub-teams.
- Bulk import (CSV, Google Directory sync) — single-person-at-a-time only this pass.
- Real Google Workspace org unit sync.

## UI/UX
Matches the mockup deck's "Build Your Organization Chart" screen (Step 1 owner, Step 2 teams) and reuses Sage's design tokens — see [[Architecture-Overview]].

## Technical approach
`src/lib/queries.ts` (`getOrgTeams`, `getTeamWithRoster`) for reads, `src/app/(app)/org-chart/actions.ts` and `src/app/(app)/team/[teamId]/actions.ts` for mutations. All scoped by `organizationId`.

## Open questions
- Should team leader promotion require the person to already be a member of that team, or can any org member be promoted cross-team? Currently `setTeamLeader` moves them onto the team (`teamId` update) — no cross-team leadership yet.

## Related
[[Architecture-Overview]], [[FEAT-onboarding-offboarding-automation]]
