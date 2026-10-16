---
type: decision
status: active
tags: [area/backend, area/frontend, sales, sandbox]
created: 2026-10-01
updated: 2026-10-01
related: ["[[0030-browser-reaches-api-through-app-origin]]", "[[0029-workspace-files-are-company-by-default]]", "[[Current-Context]]"]
---

# ADR-0031: A sales sandbox org ("Acme") behind `/demo`

## Status
`active` (user request 2026-10-01: "a specific route on the railway deployment … a mock account with seeded data … simulate an acme org in full swing … don't explain anything, just treat it like a hard coded normal account").

## Context
Sales calls need the whole product populated: teams, people, files, folders, pending work, history. Real Google Workspace data can't be used, and a real sign-in shows an empty org.

## Decision
- **`/demo`** (frontend page) → `GET /sandbox/enter` → signs the browser in as Acme's owner (Alex Morgan, `alex@acme.com`) and lands on `/home`. No banner, nothing labelled "demo". `/demo?fresh=1` rebuilds it (at most once a minute). Not added to the browser's account picker.
- **One fixed org** (`SANDBOX_ORG_ID`, `backend/app/sandbox/__init__.py`), built from fixtures (`sandbox/data.py`) by `sandbox/seed.py`: 6 teams, 25 people plus a former employee and 2 joiners, 60 company files in team and custom folders, 6 files for the librarian, 3 proposals, 3 suggested shares, a planned and an executed ownership move, 2 files stuck on a contractor's Gmail, a past offboarding, and backdated audit history (hash chain valid). It reseeds when older than 12 hours, so "recent" stays recent.
- **Never touches Google.** `get_drive_client_for_user` returns `SandboxDrive` (`sandbox/drive.py`, in-memory Drive v3 subset: files list/get/create/copy/update, permissions, about, changes) for sandbox members. It serves `FileIndex` rows plus the fixture-only files. `recheck_delegation` and the reconciliation sweep skip the org. New files link to `docs.new`/`sheets.new`/`slides.new`.
- **Fenced off from real people.** The org row is domainless (observed/verified domain NULL; the display domain `acme.com` is only used where code needs one, e.g. the librarian). Its join links are refused at sign-in and in previews; its invite tokens resolve to nothing. Nothing in the app emails members.

## Alternatives considered
- **Mock data in `src/`** — rejected: invariant 2 / ADR-0016 (the app reads the backend), and it would diverge from real behaviour.
- **A real Google Workspace test tenant** — real data hygiene, cost, and the salesperson's Google session getting involved.

## Consequences
- Every screen and action works in the sandbox exactly as it does for a real org (same endpoints and engines), which also makes it the best end-to-end test fixture (`tests/test_sandbox.py`).
- The sandbox is shared: two people demoing at once see each other's changes until it reseeds. `?fresh=1` resets it.
- Anyone with the URL can open it. It contains only fixture data.
