---
type: adr
status: accepted
tags: [area/backend, area/auth]
created: 2026-09-05
updated: 2026-09-05
related: ["[[0002-remove-prisma-for-vercel]]", "[[Architecture-Overview]]", "[[Known-Issues]]"]
---

# ADR 0003 — Cookie-only sessions with in-memory demo roster

## Context
[[0002-remove-prisma-for-vercel]] stubbed `getSessionUser()` to always return `null` and made `logIn`/`signUp` return hard errors. That left a catch-22: every authenticated route calls `requireUser()` → redirect `/login`, and login itself could not create a session. No durable DB is available yet on Vercel.

## Decision
Store the full `SessionUser` JSON in the `knowhow_session` httpOnly cookie (no server-side session table). Authenticate against a hardcoded Acme demo roster in `src/lib/demo-users.ts` (password `knowhow-demo`). Signup creates an ephemeral owner session from the form fields (cookie-only; not persisted across devices or after cookie expiry).

## Alternatives considered
- **Keep auth fully broken until Postgres** — rejected: blocks all authenticated UI/actions during the frontend rebuild.
- **Re-add Prisma/SQLite** — rejected by [[0002-remove-prisma-for-vercel]].

## Consequences
- Auth paths work again without a database.
- Demo roster IDs are stable for `viewAs`; signup users are not in that roster.
- Cookie is not HMAC-signed (prototype); forging is possible if someone can set the cookie — replace with signed/encrypted sessions when a real auth store lands.
- Data-layer stubs (`queries.ts`, `workspace.ts`) remain empty/throwing; fixing auth does not restore org-chart/doc data.

## Related
- Code: `src/lib/session.ts`, `src/lib/demo-users.ts`, `src/app/(auth)/actions.ts`
