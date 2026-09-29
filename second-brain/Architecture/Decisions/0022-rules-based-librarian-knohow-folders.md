---
type: decision
status: active
tags: [area/frontend, area/backend, priority/high]
created: 2026-09-27
updated: 2026-09-27
related: ["[[Proposal-Ready-Plan]]", "[[FEAT-drive-file-classification]]", "[[UI-Consistency-Rules]]", "[[0001-mocked-data-first-prototype]]"]
---

# ADR-0022: Rules-based librarian, Knohow-only folders, agent-designed screens

## Status
`active` (user, 2026-09-27, to get BCW to a paid pilot fast)

## Context
BCW wants to pay now. Six of seven deck features have no screen. The librarian (Workspace tab: go through Drive, sort org work into Knohow folders, separate personal files) was unbuilt and undefined. Invariant 7 made the user the designer of every screen, which serialised all UI work through them.

## Decision
1. **The agent designs screens** within [[UI-Consistency-Rules]]; the user reviews after, instead of specifying first. This relaxes invariant 7 for Phase E screens only; copy stays reviewable.
2. **The librarian is rules-based first.** A file is suggested as company work from signals Drive already has (in a Shared Drive, shared with coworkers in the domain, edited by a teammate). Everything else is "ask the owner". AI classification comes later, on top.
3. **A Knohow folder is a grouping in Knohow's database** (per team, plus custom). Drive is never reorganised; files are not moved.

## Alternatives considered
- **AI classification now**: needs a model API key and a privacy review of file content leaving Drive. Deferred, not rejected.
- **Folders as real Drive folders**: moving files in a customer's Drive is the riskiest possible first version.
- **User designs every screen**: correct long-term, too slow for this pilot.

## Consequences
- The classification confirm rule ([[FEAT-drive-file-classification]]) still binds: a suggestion never enters `FileIndex` until confirmed.
- Folder membership is new schema (migration), scoped by `organizationId`.
- Rules are explainable ("shared with 3 coworkers"), which the confirm UI can show.
