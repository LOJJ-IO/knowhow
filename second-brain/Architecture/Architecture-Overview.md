---
type: architecture
status: active
tags: [area/frontend, area/backend]
created: 2026-08-31
updated: 2026-09-05
related: ["[[0001-mocked-data-first-prototype]]", "[[0002-remove-prisma-for-vercel]]", "[[0003-cookie-only-sessions-demo-roster]]", "[[Product-Vision]]"]
---

# Architecture Overview

The living map of how Knowhow fits together. Update this whenever a decision changes the shape of the system, and write an ADR alongside it.

## System diagram

```
Next.js App Router (TypeScript) — single app, owns everything
         |
         v
Data layer stubbed (no ORM) — see [[0002-remove-prisma-for-vercel]]
         |
         v
Durable DB TBD (do not put SQLite back on Vercel serverless)
```

No separate backend service. Server Components read; Server Actions (`"use server"`) mutate. Prisma + SQLite were removed 2026-09-05 so the landing page can deploy on Vercel.

## Components

- **`src/app/(auth)/`** — signup UI still present; login page blank on purpose. Cookie sessions in `src/lib/session.ts` store full `SessionUser` JSON; demo roster in `src/lib/demo-users.ts` — see [[0003-cookie-only-sessions-demo-roster]].
- **`src/app/(app)/`** — dashboard, org chart, team people, activity, settings (UI present; DB-backed behavior stubbed).
- **`src/lib/workspace.ts`** — onboarding/offboarding/doc-creation seam (stubbed; still the place real Google Admin SDK calls will land later — [[0001-mocked-data-first-prototype]]).
- **`src/lib/queries.ts`** — read API surface, still scoped by `organizationId`; returns empty / throws until a store returns.
- Former Prisma schema/seed lived under `prisma/` — deleted with the ORM; recover from git history when wiring a new database.

## Design language

Ported from Sage's frontend on request: grayscale oklch tokens (light/dark), `0.625rem` base radius scale, pill-shaped gradient buttons, `border-foreground/20` input chrome. Hand-rolled `Button`/`Input`/`Badge`/`Switch`/`Card` in `src/components/ui/`. Landing page additionally uses self-hosted Söhne / Satoshi / LOGO fonts — see [[Current-Context]].

## Non-negotiables (see [/CLAUDE.md](../../CLAUDE.md) for the full list)

1. Next.js app is the single chokepoint — no separate backend service.
2. Google Workspace integration is mocked until an ADR records that GCP domain-wide delegation is provisioned.
3. Every data-access function takes `organizationId` as a required argument.
4. Secrets from env only.
