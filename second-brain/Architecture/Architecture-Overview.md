---
type: architecture
status: active
tags: [area/frontend, area/backend]
created: 2026-08-31
updated: 2026-08-31
related: ["[[0001-mocked-data-first-prototype]]", "[[Product-Vision]]"]
---

# Architecture Overview

The living map of how Knowhow fits together. Update this whenever a decision changes the shape of the system, and write an ADR alongside it.

## System diagram

```
Next.js 15 App Router (TypeScript) — single app, owns everything
         |
         v
Prisma ORM (driver adapter: @prisma/adapter-better-sqlite3)
         |
         v
SQLite (prisma/dev.db) — org/team/user/document/activity data
```

No separate backend service. Server Components read data directly; Server Actions (`"use server"`) perform every mutation. This mirrors Sage's "one chokepoint" philosophy even though the stack is unrelated — see the invariants in [/CLAUDE.md](../../CLAUDE.md).

## Components

- **`src/app/(auth)/`** — login/signup, mock cookie-session auth (`src/lib/session.ts`, `src/lib/password.ts` — Node `crypto.scrypt`, no external auth library).
- **`src/app/(app)/`** — everything behind a session: dashboard (role-branched: owner/leader team-doc view vs. personal "Welcome back" view), org chart builder, per-team people management, activity feed, settings.
- **`src/lib/workspace.ts`** — `onboardPerson` / `offboardPerson`, the onboarding/offboarding engine. This is the seam that gets swapped for real Google Admin SDK calls later (see [[0001-mocked-data-first-prototype]]).
- **`src/lib/queries.ts`** — all read queries, each scoped by `organizationId`.
- **`prisma/schema.prisma`** — `Organization`, `User` (role: OWNER/TEAM_LEADER/MEMBER, status: ACTIVE/OFFBOARDED), `Team`, `Document` (`sharedWithOwner`/`sharedWithLeader` flags — the visual proof of the core problem/solution), `SharingPolicy`, `ActivityEvent`, `Session`.
- **`prisma/seed.ts`** — demo org "Acme Collective," 3 teams, mixed shared/unshared documents. Log in as any `@acme.test` address, password `knowhow-demo` (see seed script output).

## Design language

Ported from Sage's frontend on request: grayscale oklch tokens (light/dark), `0.625rem` base radius scale, pill-shaped gradient buttons, `border-foreground/20` input chrome, Arial/system sans (no custom font load). Hand-rolled equivalents of Sage's `Button`/`Input`/`Badge`/`Switch`/`Card` live in `src/components/ui/` — built with plain HTML elements + `class-variance-authority` instead of Sage's `@base-ui/react` primitives, to avoid pulling in a dependency this app doesn't otherwise need. Same visual language, independent implementation.

## Non-negotiables (see [/CLAUDE.md](../../CLAUDE.md) for the full list)

1. Next.js app is the single chokepoint — no separate backend service.
2. Google Workspace integration is mocked until an ADR records that GCP domain-wide delegation is provisioned.
3. Every data-access function takes `organizationId` as a required argument.
4. Secrets from env only.
