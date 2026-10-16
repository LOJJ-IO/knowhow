---
type: adr
status: accepted
tags: [area/backend, area/deploy]
created: 2026-09-05
updated: 2026-09-05
related: ["[[0001-mocked-data-first-prototype]]", "[[Architecture-Overview]]", "[[Known-Issues]]"]
---

# ADR 0002 — Remove Prisma/SQLite for Vercel deploy

## Context
The first Vercel production build failed: `src/generated/prisma` is gitignored, so a clean clone had no `@/generated/prisma/client`. Even with `prisma generate` in the build, SQLite + `better-sqlite3` is not a durable fit for Vercel serverless (read-only filesystem). The user asked to remove Prisma because it was not accepting / not workable on that deploy path.

## Decision
Remove Prisma, `@prisma/client`, `@prisma/adapter-better-sqlite3`, the `prisma/` schema/migrations/seed tree, and `src/lib/db.ts` from the running app. Session/auth/queries/workspace become no-DB stubs (session always null; mutations throw or no-op) so the landing page and static routes build and deploy. Reintroduce a durable database (likely Postgres) later under a new ADR — do not put SQLite back on Vercel.

## Consequences
- Login/signup/org-chart/team mutations do not persist data.
- Demo seed / `knowhow-demo` password path is gone until a DB returns.
- `npm run build` no longer depends on Prisma generate or native sqlite binaries.
