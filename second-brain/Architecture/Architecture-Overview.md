---
type: architecture
status: active
tags: [area/frontend, area/backend]
created: 2026-08-31
updated: 2026-09-18
related: ["[[0001-mocked-data-first-prototype]]", "[[0002-remove-prisma-for-vercel]]", "[[0003-cookie-only-sessions-demo-roster]]", "[[0004-landing-only-purge-old-app]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[Product-Vision]]", "[[Current-Context]]"]
---

# Architecture Overview

The living map of how Knowhow fits together. Update this whenever a decision changes the shape of the system, and write an ADR alongside it.

## System diagram

```
Next.js App Router (TypeScript) — frontend (landing only on main today)
         |
         v
Landing only (`/` → LandingHero) — see [[0004-landing-only-purge-old-app]]
         |
         v
Data / auth / Google seams — not in the live `src/` tree; restore from git + ADRs when rebuilt
         |
         v
Durable DB TBD for the Next.js app (do not put SQLite back on Vercel serverless)

-------------------------------------------------------------------
NOT MERGED INTO main YET — see [[0004-fastapi-backend-for-auth-and-identity]]

FastAPI backend (Python 3.12, /backend) — auth, identity, org chart,
sharing/ownership engine, DeepSearch. Real Google OAuth/Drive/Admin-SDK
integration, SQLAlchemy 2.x + Alembic, Railway + Postgres (undeployed).
Branch: backend/auth-foundation (org-engine already merged into it —
this is the one branch to merge into main).
```

**As of this writing, the Next.js app on `main` still has no separate backend service** — that invariant (below) is accurate for `main` today. Prisma + SQLite were removed earlier ([[0002-remove-prisma-for-vercel]]). The 2026-09-10 purge removed the stubbed product UI and session layer from the live tree ([[0004-landing-only-purge-old-app]]). A complete FastAPI backend exists on branch `backend/auth-foundation` and is ready to merge into `main` on request; once merged, see [[0004-fastapi-backend-for-auth-and-identity]] and the "Backend integration contract" section below.

## Components

- **`src/app/page.tsx`** — renders `<LandingHero />` only (no session redirect).
- **`src/app/terms/page.tsx`, `src/app/privacy/page.tsx`** — static legal pages (2026-09-17) built on `src/components/legal/legal-page.tsx` — [[FEAT-legal-pages]].
- **`src/components/brand/`** — `landing-hero`, `logo-mark` (hex mark + Söhne), `logo-lockup` (Kn⬡how™ by LOJJ.io), `fonts.ts` (Satoshi, LOJJ face). (`guidelines-overlay` removed 2026-09-18.)
- **`src/lib/`** — `utils.ts`, `use-hydrated.ts` only.
- **`src/app/globals.css`** — landing canvas `#F9F8F6` / `#1c1917`, `.t-shimmer`, handoff + deck chrome (desktop linear-spread / mobile Cover Flow). No navy/oklch design-system palette, no dark theme, no sidebar tokens.

## Backend integration contract (pending merge — see [[0004-fastapi-backend-for-auth-and-identity]])

For whoever wires the Next.js frontend up to `/backend` once `backend/auth-foundation` is merged into `main`. Not deployed anywhere yet (no Railway project provisioned) — this describes the contract for calling it locally (`uvicorn app.main:app`, see `backend/.env.example`) until a real URL exists.

- **Base URL**: `NEXT_PUBLIC_BACKEND_API_URL` (added 2026-09-18 for Continue with Google — [[0008-continue-with-google-via-backend]]; `.env` / `.env.example`) (client-readable; the OAuth flows below are full-page browser redirects, not server-to-server calls, so the browser needs to know this URL directly). Point it at `http://localhost:8000` locally; a real value lands once Railway deploy happens (out of scope for now).
- **Auth is cookie-based and lives on the backend's own origin, separate from the Next.js app's own session** (see [[0003-cookie-only-sessions-demo-roster]] — the two are not unified, per ADR-0004's open consequence). Flow:
  1. *(2026-09-18: all Google flows return to the one `GOOGLE_OAUTH_REDIRECT_URI` = `/auth/callback`, which dispatches on the state's purpose — the button uses `/onboarding/signup` for both new and existing members.)* Full-page redirect (not `fetch`) the browser to `${NEXT_PUBLIC_BACKEND_API_URL}/auth/login` (existing member) or `/onboarding/signup` (bootstraps a brand-new organization + first member) — both are Google OAuth entry points.
  2. The backend sets two httpOnly cookies scoped to *its own* domain: `knohow_access_token` (short-lived, ~1h) and `knohow_refresh_token` (long-lived, ~30d) — `secure`+`SameSite=None` outside local dev. It then redirects the browser back to `FRONTEND_ORIGIN` (a backend env var the backend must have set correctly for this hop to land back on the frontend).
  3. Every subsequent call from frontend code to the backend **must** pass `credentials: "include"` on `fetch` (or the equivalent in whatever HTTP client) — the backend's CORS is `allow_credentials=True` with `allow_origins=[FRONTEND_ORIGIN]` (one exact origin, not a wildcard), so this is how the cross-origin cookie actually rides along. Forgetting `credentials: "include"` is the most likely integration mistake here — calls will silently 401.
  4. When a call 401s (access token expired), `POST ${NEXT_PUBLIC_BACKEND_API_URL}/auth/refresh` (also `credentials: "include"`) mints a new access-token cookie from the refresh cookie, then retry.
- **Endpoint groups** (41 routes as of 2026-09-09 — treat `backend/app/main.py`'s router includes and `backend/app/api/routes/` as the authoritative, evolving list rather than duplicating every path here): `/health`; `/auth/*` (login, callback, refresh, logout, me, personal-oauth consent); `/organizations/{org_id}/delegation/*`, `/organizations/{org_id}/offboard`, `/organizations/{org_id}/audit/verify` (auth-foundation module); `/onboarding/*`, `/org-chart/{org_id}`, `/organizations/{org_id}/teams|memberships`, `/files`, `/search`, `/files/{file_id}/suggested-share/*`, `/reassignments/*`, `/transfer-batches/*`, `/offboard`, `/webhooks/drive-changes` (org-engine module).
- **Every response is a complete resource representation with stable field names** (UUIDs as strings, enums as their `.value`) — endpoints were deliberately built generic/composable rather than screen-shaped, so a frontend view can usually be composed from existing fields rather than needing a new endpoint.
- **Errors**: typed exceptions map to HTTP status via a shared handler (`403` cross-org, `404` not found/not provisioned, `409` conflicting state like unapproved delegation or already-consumed token, `400` validation) — response body is always `{"detail": ..., "error_type": ...}` for the typed cases.

## Design language

Landing is being designed by the user screen-by-screen. Do not reintroduce the old Sage-derived `ui/` primitives or cool-navy oklch tokens. Google mark colors remain literal hex in `logo-mark.tsx` / landing subhead (`#4285F4` / `#34A853` / `#FBBC05` / `#EA4335`).

## Non-negotiables (see [/CLAUDE.md](../../CLAUDE.md) for the full list)

1. Next.js app is the single chokepoint on `main` — no separate backend service in the live tree. **Superseded on merge of `backend/auth-foundation` per [[0004-fastapi-backend-for-auth-and-identity]].**
2. Google Workspace integration is mocked in `src/` until an ADR records that GCP domain-wide delegation is provisioned. **Still true for `src/`; narrowed, not lifted, by the FastAPI ADR.**
3. Every data-access function takes `organizationId` as a required argument when a data layer returns.
4. Secrets from env only · independent of Sage_v1 · no Prisma/SQLite on Vercel · implement only what is asked.
