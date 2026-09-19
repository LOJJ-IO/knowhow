---
type: decision
status: draft
tags: [area/backend, area/product, google, open-question]
created: 2026-09-17
updated: 2026-09-18
related: ["[[FEAT-workspace-onboarding-flow]]", "[[FEAT-drive-file-classification]]", "[[0006-observed-domain-tenant-identity]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[Known-Issues]]"]
---

# ADR-0007: Does Knowhow support Google Shared Drives?

## Status
`draft` — **open question, no decision made.** Raised 2026-09-17 while specifying [[FEAT-workspace-onboarding-flow]]; the user asked for it to be written up rather than settled now. Promote to `active` when answered.

## Context
`backend/` has **no Shared Drive support at all** — no `driveId`, no `supportsAllDrives`, nothing that reads or writes a shared drive. **No ADR, doc or code comment records why.** The backend predates this conversation, so what follows is read from the code, not a recovered decision.

**The codebase assumes files have individual owners.** The reconciliation sweep lists `q="'me' in owners and trashed = false"` (`app/activity/reconciliation.py`), i.e. only files a member personally owns. Offboarding, Auto-Own and TransferBatch execution all move ownership from one person to another (`app/google/ownership.py::transfer_ownership`). That *is* the product as built: work scattered across employee accounts, the company reclaiming it.

**Shared Drives dissolve that problem rather than solving it.** A file created in a Shared Drive is owned by the organization from the moment of creation — nobody to transfer from, nothing to reclaim, nothing to strand at offboarding. So a Shared Drive is less a missing feature than a competing answer to the same question.

**Two things force the question now:**
1. *(2026-09-18: the contractor case is now answered by [[0009-contractor-work-created-as-the-org]] — files created as the org through Knohow. The paragraph below is kept as written.)* **The contractor / outside-account case has no other answer.** Google refuses ownership transfer between a consumer account and a Workspace, so an outside Gmail account cannot be transferred *from*. A Shared Drive is the only mechanism by which the company owns that work — see the ownership invariant in [[FEAT-workspace-onboarding-flow]] and [[Known-Issues]].
2. **Existing Shared Drive files are invisible.** Without `supportsAllDrives`/`includeItemsFromAllDrives`, the sweep never sees them. A company that already works in Shared Drives would get an oddly empty picture from Knowhow — and, worse, a confident one.

**Loose end:** `app/google/ownership.py`'s module docstring calls its contents "Shared Drive ownership-transfer primitives", but nothing in the file touches Shared Drives. Either intent that was never built, or loose wording. The docstring does not match the code.

## Decision
None yet. The options on the table:

- **A. Ignore Shared Drives** (status quo). Cheapest; leaves the contractor case unanswerable and Shared-Drive-native companies mis-served, with no signal that the picture is partial.
- **B. Read-only awareness.** Add `supportsAllDrives`/`includeItemsFromAllDrives` so Shared Drive files are visible and classifiable, while ownership features stay My-Drive-only. Fixes the blind spot without claiming new powers.
- **C. Shared Drive as the answer to company ownership.** Knowhow provisions/uses a Shared Drive so company work is org-owned at creation — including work by outside accounts. Largest change; overlaps (and may partly obsolete) Auto-Own.

## Alternatives considered
Deliberately not pre-judged here — see the options above. Note that B and C are not exclusive: B is a prerequisite for C, and B alone is coherent.

## Consequences
Unresolved until this is answered. Known implications either way:
- **Classification** ([[FEAT-drive-file-classification]]): a Shared Drive file is org-owned by construction, so the Company/Personal/External question largely answers itself there — the "Shared Drive exception" already noted in the formal rules needs this ADR to be precise.
- **Permissions model**: Shared Drive membership is its own access layer, distinct from per-file permissions — the org chart / visibility engine has no concept of it.
- **Offboarding**: a member leaving a Shared Drive strands nothing, so parts of the offboarding path become no-ops there. Behaviour must be stated, not left to fall out of the code.
- Choosing A should still be recorded as a decision, so this doesn't get re-litigated from scratch.

## Related
[[FEAT-workspace-onboarding-flow]] · [[FEAT-drive-file-classification]] · [[0006-observed-domain-tenant-identity]] · [[Known-Issues]]
