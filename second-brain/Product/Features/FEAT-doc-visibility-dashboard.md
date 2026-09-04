---
type: feature
status: shipped
tags: [area/frontend, area/backend]
created: 2026-08-31
updated: 2026-08-31
related: ["[[Product-Vision]]", "[[FEAT-org-chart-builder]]", "[[Architecture-Overview]]"]
---

# FEAT: Doc visibility dashboard

## Status
`shipped` (mocked-data prototype)

## Problem
This is the core problem from the original pitch deck: documents created by team members aren't automatically visible to the org owner/leader. The product needs to make that gap visible before it can claim to close it.

## Solution
- **Owner/leader dashboard** (`/dashboard` when `role !== MEMBER`... actually role-branch is `role === OWNER` for the team-board view, see note below) — a team switcher (pills) and a three-column board (Docs/Sheets/Slides) per team, each row showing owner name/date and a status dot: green = `sharedWithOwner`, red = not. Team Leader and Timeframe filters are client-side (`TeamDocumentsBoard`, `src/components/dashboard/team-documents-board.tsx`).
- **Personal dashboard** ("Welcome back, {name}") for team leaders/members — Create New Work tiles (since 2026-09-02: real in-app creation with a share-with choice — see [[FEAT-doc-creation-auto-share]]), a "My Recent Work" list with per-doc share status, a static All Apps grid, and a "Shared With You" board using the same `TeamDocumentsBoard` component fed by `getDocumentsSharedWithUser`.

## Out of scope
- Real Drive API scanning of actual documents.
- Full-text document search/preview.

## UI/UX
Matches mockup pages 4–8 (owner "Team Leaders: Recent Google Workspace Documents" board; member "Welcome back" workspace).

## Technical approach
`src/lib/queries.ts`: `getTeamDocumentsByType` (all docs for a team, both shared and not) vs. `getDocumentsSharedWithUser` (role-dependent visibility; since 2026-09-02 the rules live in `visibilityWhere()` and include `sharedWithEveryone` broadcasts — see [[FEAT-doc-creation-auto-share]]). Both return `TeamDocumentColumns` (`Prisma.DocumentGetPayload<{include:{owner:true}}>[]` per type).

**Known nuance, not a bug:** the green/red status dot always means "shared with the org owner specifically," even on a teammate's personal "Shared With You" board where every doc shown is already, by definition, shared with *that viewer*. This is intentional — it keeps a single consistent meaning across the app and lets a team leader see at a glance which of their team's docs are still invisible to ownership, which is the whole point of the product. If this reads as confusing in user testing, reconsider before "fixing" it away.

## Open questions
- Should the owner dashboard's team switcher persist as a URL param (`?team=`) permanently, or move to a proper nested route (`/dashboard/[teamId]`)? Currently a query param, chosen for a smaller diff.

## Related
[[FEAT-org-chart-builder]], [[FEAT-onboarding-offboarding-automation]], [[Architecture-Overview]]
