---
type: feature
status: shipped
tags: [area/frontend, area/backend, priority/high]
created: 2026-09-02
updated: 2026-09-02
related: ["[[FEAT-doc-visibility-dashboard]]", "[[0001-mocked-data-first-prototype]]", "[[Current-Context]]"]
---

# FEAT: In-app doc creation with auto-share, Drive auto-filing, and org-wide search

## Status
`shipped` (mocked-data prototype) — built 2026-09-02 for the investor/partner demo.

## Problem
The demo needed the *solution moment* to be visible live: a team member creates a doc and it is instantly shared with the right people and filed in the right Drive folder. The previous "Create New Work" tiles just linked out to real Google create-new URLs, so nothing happened inside Knowhow.

## Solution
- **In-app creation** (`CreateWorkPanel`, `src/components/dashboard/create-work-panel.tsx`): Doc/Sheet/Slide tiles open an inline form (title + "Share with" choice). Members choose Auto (team policy) / team leader / owner / only me; the **owner** chooses everyone / all team leaders / only me. On success a green receipt shows exactly what the automation did: *"Q4 Budget Tracker" filed in Drive › Marketing — auto-shared with Sarah Chen (team leader) and Jordan Blake (owner).*
- **Engine seam** (`createAndFileDocument` in `src/lib/workspace.ts`): applies the share choice or the team's `SharingPolicy`, derives the Drive folder (team name, or "Company" for org-level docs), writes the `Document` + a `DOC_AUTO_SHARED` `ActivityEvent`. Real Drive calls stay mocked per [[0001-mocked-data-first-prototype]].
- **Drive auto-filing panel** (`FolderRoutingPanel`, owner dashboard): one card per Drive folder (Company + each team) with file count and the last file routed there — the "file chart" from the demo ask ("Tim from Marketing creates a doc → it lands in the Marketing folder").
- **Org-wide search** (`GlobalSearch` + `searchDocuments`): debounced title search over every doc the viewer may see, dropdown hits show type icon, creator, folder, date. Owner sees everything shared up to them; members/leaders are visibility-scoped.

## Data model
`Document.sharedWithEveryone` (new, migration `20260902142342_add_shared_with_everyone`) marks org-wide broadcasts (owner docs like the seeded "Company Handbook"). Visibility semantics live in one place: `visibilityWhere(viewer)` in `src/lib/queries.ts` — owner: `sharedWithOwner ∨ sharedWithEveryone`; leader: own team's leader-shared ∨ org-level (teamId null) leader-shared ∨ broadcasts; member: own team's surfaced docs ∨ broadcasts.

## Out of scope
- Real Drive folder creation / permission API calls (ADR-0001 seam).
- Full-text content search (title search only).
- Form/Other tile (rendered disabled, deck parity only).
