---
type: decision
status: active
tags: [area/product, area/backend, google, deletion]
created: 2026-09-18
updated: 2026-09-18
related: ["[[0009-contractor-work-created-as-the-org]]", "[[FEAT-workspace-onboarding-flow]]", "[[FEAT-onboarding-offboarding-automation]]"]
---

# ADR-0010: Every delete through Knohow goes to Trash — recoverable for 30 days, then gone

## Status
`active` — user decision 2026-09-18, raised while scoping contractor actions ([[0009-contractor-work-created-as-the-org]]).

## Context
Contractors may delete company files as the org. The user asked that "all deletions are never permanent" — a deleted file must be recoverable for 30 days — and then confirmed the rule covers **every** delete made through Knohow, by anyone (including offboarding cleanup), not only contractors.

## Decision
Knohow never permanently deletes a Google file. A delete moves it to the owning account's **Drive Trash** (`files.update(trashed=true)`), where it stays recoverable for **30 days**; after that Google removes it **permanently** — that end-of-day-30 behaviour is intended ("gone for good", user).

## Alternatives considered
- **Keep forever in an archive** — rejected by the user: unbounded storage.
- **Owner confirms permanent deletion after 30 days** — rejected by the user.
- **Contractors only** — rejected: the rule applies to every delete.

## Consequences
- Knohow must never call `files.delete` or `files.emptyTrash`. As of 2026-09-18 `backend/` calls neither (its only Drive `delete` is `permissions().delete` in `app/google/ownership.py`, which removes an access grant during an ownership transfer, not a file).
- Restoring within 30 days must be possible; for org-created files the Trash is the automation account's, so Knohow (via delegation) is the one that restores — the UI will need a way to ask for it. Not designed.
- Removing someone's *access* (unsharing) is not a delete and isn't covered.
- Relies on Google's 30-day Trash; if Google changes that period, this ADR needs revisiting.

## Related
[[0009-contractor-work-created-as-the-org]] · [[FEAT-workspace-onboarding-flow]]
