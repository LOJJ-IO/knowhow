---
type: architecture
status: active
tags: [area/frontend, area/backend]
created: 2026-08-31
updated: 2026-09-09
related: ["[[0001-mocked-data-first-prototype]]", "[[0002-remove-prisma-for-vercel]]", "[[0003-cookie-only-sessions-demo-roster]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[Product-Vision]]", "[[Current-Context]]"]
---

# Architecture Overview

The living map of how Knowhow fits together. Update this whenever a decision changes the shape of the system, and write an ADR alongside it.

## System diagram

```
Next.js App Router (TypeScript) — frontend, owns UI + its own mocked data layer
         |
         v
Data layer stubbed (no ORM) — see [[0002-remove-prisma-for-vercel]]
         |
         v
Durable DB TBD (do not put SQLite back on Vercel serverless)

-------------------------------------------------------------------
NOT MERGED INTO main YET — see [[0004-fastapi-backend-for-auth-and-identity]]

FastAPI backend (Python 3.12, /backend) — auth, identity, org chart,
sharing/ownership engine, DeepSearch. Real Google OAuth/Drive/Admin-SDK
integration, SQLAlchemy 2.x + Alembic, Railway + Postgres (undeployed).
Branch: backend/auth-foundation (org-engine already merged into it —
this is the one branch to merge into main).
```

**As of this writing, the Next.js app on `main` still has no separate backend service** — that invariant (below) is accurate for `main` today. A complete, separate FastAPI backend exists on branch `backend/auth-foundation` and is ready to merge into `main` on request; once merged, invariants 1 and 2 below are superseded for real (not mocked) Google Workspace operations — see [[0004-fastapi-backend-for-auth-and-identity]] for the full reasoning, and the "Backend integration contract" section below for the base URL, auth-cookie shape, and endpoint list frontend code will need once that lands.

## Components

- **`src/app/(auth)/`** — signup UI still present; login page blank on purpose. Cookie sessions in `src/lib/session.ts` store full `SessionUser` JSON; demo roster in `src/lib/demo-users.ts` — see [[0003-cookie-only-sessions-demo-roster]].
- **`src/app/(app)/`** — dashboard, org chart, team people, activity, settings (UI present; DB-backed behavior stubbed).
- **`src/lib/workspace.ts`** — onboarding/offboarding/doc-creation seam (stubbed; still the place real Google Admin SDK calls will land later — [[0001-mocked-data-first-prototype]]).
- **`src/lib/queries.ts`** — read API surface, still scoped by `organizationId`; returns empty / throws until a store returns.
- Former Prisma schema/seed lived under `prisma/` — deleted with the ORM; recover from git history when wiring a new database.

## Backend integration contract (pending merge — see [[0004-fastapi-backend-for-auth-and-identity]])

For whoever wires the Next.js frontend up to `/backend` once `backend/auth-foundation` is merged into `main`. Not deployed anywhere yet (no Railway project provisioned) — this describes the contract for calling it locally (`uvicorn app.main:app`, see `backend/.env.example`) until a real URL exists.

- **Base URL**: no frontend env var for this exists yet — introduce `NEXT_PUBLIC_BACKEND_API_URL` (client-readable; the OAuth flows below are full-page browser redirects, not server-to-server calls, so the browser needs to know this URL directly). Point it at `http://localhost:8000` locally; a real value lands once Railway deploy happens (out of scope for now).
- **Auth is cookie-based and lives on the backend's own origin, separate from the Next.js app's own session** (see [[0003-cookie-only-sessions-demo-roster]] — the two are not unified, per ADR-0004's open consequence). Flow:
  1. Full-page redirect (not `fetch`) the browser to `${NEXT_PUBLIC_BACKEND_API_URL}/auth/login` (existing member) or `/onboarding/signup` (bootstraps a brand-new organization + first member) — both are Google OAuth entry points.
  2. The backend sets two httpOnly cookies scoped to *its own* domain: `knohow_access_token` (short-lived, ~1h) and `knohow_refresh_token` (long-lived, ~30d) — `secure`+`SameSite=None` outside local dev. It then redirects the browser back to `FRONTEND_ORIGIN` (a backend env var the backend must have set correctly for this hop to land back on the frontend).
  3. Every subsequent call from frontend code to the backend **must** pass `credentials: "include"` on `fetch` (or the equivalent in whatever HTTP client) — the backend's CORS is `allow_credentials=True` with `allow_origins=[FRONTEND_ORIGIN]` (one exact origin, not a wildcard), so this is how the cross-origin cookie actually rides along. Forgetting `credentials: "include"` is the most likely integration mistake here — calls will silently 401.
  4. When a call 401s (access token expired), `POST ${NEXT_PUBLIC_BACKEND_API_URL}/auth/refresh` (also `credentials: "include"`) mints a new access-token cookie from the refresh cookie, then retry.
- **Endpoint groups** (41 routes as of 2026-09-09 — treat `backend/app/main.py`'s router includes and `backend/app/api/routes/` as the authoritative, evolving list rather than duplicating every path here): `/health`; `/auth/*` (login, callback, refresh, logout, me, personal-oauth consent); `/organizations/{org_id}/delegation/*`, `/organizations/{org_id}/offboard`, `/organizations/{org_id}/audit/verify` (auth-foundation module); `/onboarding/*`, `/org-chart/{org_id}`, `/organizations/{org_id}/teams|memberships`, `/files`, `/search`, `/files/{file_id}/suggested-share/*`, `/reassignments/*`, `/transfer-batches/*`, `/offboard`, `/webhooks/drive-changes` (org-engine module).
- **Every response is a complete resource representation with stable field names** (UUIDs as strings, enums as their `.value`) — endpoints were deliberately built generic/composable rather than screen-shaped, so a frontend view can usually be composed from existing fields rather than needing a new endpoint.
- **Errors**: typed exceptions map to HTTP status via a shared handler (`403` cross-org, `404` not found/not provisioned, `409` conflicting state like unapproved delegation or already-consumed token, `400` validation) — response body is always `{"detail": ..., "error_type": ...}` for the typed cases.

## Design language

Ported from Sage's frontend on request: grayscale oklch tokens (light/dark), `0.625rem` base radius scale, pill-shaped gradient buttons, `border-foreground/20` input chrome. Hand-rolled `Button`/`Input`/`Badge`/`Switch`/`Card` in `src/components/ui/`. Landing page additionally uses self-hosted Söhne / Satoshi / LOGO fonts — see [[Current-Context]].

## Non-negotiables (see [/CLAUDE.md](../../CLAUDE.md) for the full list)

1. Next.js app is the single chokepoint — no separate backend service. **True for `main` today; superseded on merge of `backend/auth-foundation` per [[0004-fastapi-backend-for-auth-and-identity]] — that ADR records the decision, not yet the merge.**
2. Google Workspace integration is mocked until an ADR records that GCP domain-wide delegation is provisioned. **Still true for `src/lib/` specifically — narrowed, not lifted, by ADR-0004; the mocked seam here is untouched.**
3. Every data-access function takes `organizationId` as a required argument.
4. Secrets from env only.
