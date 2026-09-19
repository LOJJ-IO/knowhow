---
type: decision
status: active
tags: [area/product, area/backend, google, contractors, ownership]
created: 2026-09-18
updated: 2026-09-18
related: ["[[FEAT-workspace-onboarding-flow]]", "[[0007-shared-drive-support]]", "[[FEAT-drive-file-classification]]", "[[FEAT-org-chart-builder]]", "[[Known-Issues]]"]
---

# ADR-0009: Contractor work is company-owned by being created as the org, through Knohow

## Status
`active` — user decision 2026-09-18 ("lets go with option 3"). **Decided, not built.**

## Context
Google doesn't allow ownership transfer from a personal (consumer) account to a Workspace, so Knohow cannot "auto-own" what a contractor on a personal Gmail account creates in their own Drive. The company can only own that work if it owns it **from creation**. Three ways were compared (2026-09-18): give the contractor a Workspace account, a Shared Drive ([[0007-shared-drive-support]]), or have the contractor work through Knohow acting as the org — the direction already sketched in [[FEAT-workspace-onboarding-flow]] → "Acting as the organization — contractors".

## Decision
Contractors' work is created **as the organization**: the contractor signs into Knohow (any Google account), and Knohow creates files as the org's dedicated automation account (e.g. `automations@acme.com`, a Workspace account nobody logs into) via domain-wide delegation, then gives the contractor edit access. The file is company-owned from its first second; the contractor edits it in Google Docs/Drive as normal, and editing never changes ownership. Knohow's audit log records which person asked for each action.

## Alternatives considered
- **Workspace account per contractor** — works with the backend as built, but costs a seat per contractor and puts outsiders in the company directory. Still available case by case; not the default.
- **Shared Drive** — also company-owned at creation, but needs Shared Drive support the backend doesn't have, and adds a second access layer (Shared Drive membership). [[0007-shared-drive-support]] stays open for other reasons (Shared Drive files are invisible to the sweep).
- **Per-file transfer** — not possible from a personal account.

## Consequences
- **Only work started through Knohow is covered.** A file the contractor creates in their *own* Drive is still theirs — Knohow can't reach or claim it. The contractor needs a way to start work in Knohow (e.g. "new doc"), and the company should expect them to use it.
- **Requires, per org:** domain-wide delegation authorized by a Super Admin, plus an automation Workspace account (one seat). Not available to domainless orgs or orgs in per-user-consent mode.
- **The audit log becomes load-bearing** — Google's logs will name the automation account, not the contractor.
- **When the contract ends,** removing the contractor's edit access is enough; nothing is stranded.
- **Nothing exists in `backend/` for this yet:** no automation-account setting per org, no create-as-org action, no contractor role, no scoped/time-limited access.
- **Contractor actions (user, 2026-09-18):** **create, edit, share and delete** files as the org. **Deletes are never permanent** — a delete moves the file somewhere recoverable for **30 days** (user: "All deletions are never permanent"). Mechanics: an editor can't delete a file they don't own in Google, so a contractor delete must go through Knohow, which trashes it as the automation account; Drive Trash keeps it 30 days. Open: what happens after day 30, and whether the rule covers every Knohow delete or only contractors'.
- **Still deferred (user, 2026-09-17):** whether the owner approves per action, per scope or per time window; what the contractor may read. Entry path leaning to deep links / email invites. These must be answered before building.
- Takes pressure off [[0007-shared-drive-support]] for the contractor case; that ADR is otherwise unchanged.

## Related
[[FEAT-workspace-onboarding-flow]] · [[0007-shared-drive-support]] · [[0008-continue-with-google-via-backend]] · [[FEAT-org-chart-builder]]
