---
type: decision
status: active
tags: [area/backend, area/security]
created: 2026-09-09
updated: 2026-09-09
related: ["[[0001-mocked-data-first-prototype]]", "[[0002-remove-prisma-for-vercel]]", "[[Current-Context]]"]
---

# ADR-0004: Split into Next.js frontend + separate FastAPI/Railway backend for auth, identity, and real Google Workspace integration

## Status
`active`

## Context
[[0001-mocked-data-first-prototype]] established two invariants that this ADR now partially revises: (1) the Next.js app is the single chokepoint, no separate backend service, and (2) nothing calls a real Google API until an ADR records that a GCP project + domain-wide delegation has actually been provisioned. Both were correct for the first build pass, but the user has now explicitly directed the next phase of work: a real auth/identity/security foundation — Google OAuth login, Workspace domain-wide delegation, per-user OAuth fallback for personal-Gmail members, encrypted token storage, a tamper-evident audit log, and a Google API retry/backoff layer — built as a standalone FastAPI (Python 3.12) service on Railway with a Railway-managed Postgres instance, under a new top-level `/backend` directory, on branch `backend/auth-foundation`.

This is a real architectural reversal, not a minor addition, so it's recorded here explicitly rather than just started quietly — per the working rule in this repo's CLAUDE.md that locked invariants get an ADR when overridden, not a silent departure. Confirmed with the user directly before any code was written (see [[Current-Context]]).

The security-critical pieces this phase needs — domain-wide delegation with per-org impersonation scoping, Fernet-encrypted refresh tokens, a SHA-256 hash-chained append-only audit log, Alembic-migrated relational schema — are more naturally built in a typed, migration-first stack with mature Google API tooling (`google-auth`, `google-api-python-client`) than bolted onto the Next.js app, which per [[0002-remove-prisma-for-vercel]] deliberately has no ORM and no local database right now.

## Decision
Knohow becomes a two-service product:

1. **The existing Next.js app** (repo root) is unchanged in its own invariants — Server Components/Actions, no ORM, Google Workspace data in `src/lib/` continues to be simulated exactly as [[0001-mocked-data-first-prototype]] describes. That mocking decision still stands for the Next.js app specifically.
2. **A new, independent FastAPI service** under `/backend` — SQLAlchemy 2.x + Alembic (every schema change is a migration, no autogenerate-and-forget), deployed on Railway (Dockerfile-based) against a Railway-managed Postgres instance. This is a fully separate codebase and runtime from the Next.js app; it does not share `package.json`, `tsconfig.json`, or any dependency graph with it. [[0002-remove-prisma-for-vercel]]'s "no ORM on Vercel" constraint is about the Next.js app's own deployability and is not violated by this — it's a different service with its own database, not Prisma re-added to the Next.js app.

This backend is being built in two stages, each importing forward rather than duplicating: `backend/auth-foundation` (this ADR — identity/security only: login, delegation, personal OAuth, the unified Drive client accessor, the retry wrapper, the audit chain, and the offboarding primitive) and a following `backend/org-engine` branch (org chart, sharing/ownership engine, DeepSearch) that imports from this module.

Real Google API calls are no longer universally mocked. This backend calls the real Drive API once an organization's `DelegationGrant.status` is `approved` (domain members) or a member has a stored `OAuthCredential` (personal-account members) — gated per-organization and per-member by those explicit states, not by a blanket "everything is mocked" rule. [[0001-mocked-data-first-prototype]]'s scope is narrowed accordingly: it still fully applies to the Next.js app's `src/lib/`, and no longer applies to `/backend`.

OAuth scope note: the login/identity flow uses minimal `openid`/`userinfo.email`/`userinfo.profile` scopes. Domain-wide delegation and the personal-account consent flow both request the full `https://www.googleapis.com/auth/drive` scope (a Google restricted scope, requiring OAuth verification review) rather than the narrower `drive.file`/`drive.metadata` — see `backend/app/google/scopes.py` and `backend/docs/gcp-setup.md` for why the narrower scopes are structurally insufficient (Knohow must manage files it never created or opened, not just its own).

## Alternatives considered
- **Keep everything inside Next.js (Server Actions calling Google APIs directly)** — rejected: would mean re-adding an ORM to the Next.js app against [[0002-remove-prisma-for-vercel]], and mixing unrelated concerns (UI rendering vs. security-critical Google API/credential plumbing) into one deploy target and one dependency graph.
- **Continue mocking Google Workspace integration indefinitely** — rejected: this phase's entire purpose is to replace that mocked seam with a real one for the identity/security surface; no further delay was requested.
- **Node/TypeScript backend instead of Python/FastAPI** — not evaluated in depth; the user specified FastAPI/Python 3.12 directly.

## Consequences
- Two deployable services now exist in one repo (Next.js at root, FastAPI under `/backend`) — separate CI, secrets, and on-call surface for each.
- Real production Google credentials now exist for the first time: a service-account key with domain-wide delegation, an OAuth client secret, a Fernet key, a JWT signing key. All are env-only per this repo's "secrets from env only" rule — see `backend/.env.example` and `backend/docs/gcp-setup.md`.
- Google's OAuth verification review (required for the restricted `drive` scope) is now on the critical path and must be submitted as soon as the consent screen exists, independent of engineering progress — it runs on Google's timeline.
- How session state is shared between the Next.js app's own cookie-session auth ([[0003-cookie-only-sessions-demo-roster]]) and this backend's JWT-based sessions is an open integration question, not resolved here — the two auth systems are independent for now (CORS is configured against `FRONTEND_ORIGIN` so the frontend *can* call this backend, but nothing wires them together yet).
- `/backend`'s own data model (Organization, OrgMember, DelegationGrant, OAuthCredential, AuditLogEntry, UnresolvedOwnership) has no `FileIndex` or `TransferBatch` — those belong to the forthcoming org-engine module. The offboarding primitive built in this phase (`revoke_and_offboard`) is therefore scoped to files the departing member owns (discovered via a live Drive query), not a full org-wide sweep of everything shared with them — that requires the org-engine module's cross-member indexing.

## Related
- [[0001-mocked-data-first-prototype]] — scope narrowed to the Next.js app only, not superseded.
- [[0002-remove-prisma-for-vercel]] — unaffected; this ADR's ORM lives in a separate Python service, not the Next.js app.
- [[Current-Context]] — tracks the live status of `backend/auth-foundation` and the planned `backend/org-engine` follow-up.
