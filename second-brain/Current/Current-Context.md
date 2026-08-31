---
type: context
status: active
tags: [priority/high, area/frontend, area/backend]
created: 2026-08-31
updated: 2026-08-31
related: ["[[0001-mocked-data-first-prototype]]", "[[FEAT-org-chart-builder]]", "[[FEAT-doc-visibility-dashboard]]", "[[FEAT-onboarding-offboarding-automation]]", "[[Known-Issues]]"]
---

# Current Context

## Active priority
First build pass complete: a clickable, believable mocked-data prototype of Knowhow — sign up, build an org chart, see the doc-visibility problem/solution on both the owner and personal dashboards, and onboard/offboard people with real (if simulated) automation and an audit trail.

## What's true right now (2026-08-31)
- Repo: `/Users/user/knowhow` (local only — no GitHub remote yet, ask before creating one). Not related to Sage_v1 except as the conversation it spun out of — see [[0001-mocked-data-first-prototype]].
- Stack: Next.js 15 App Router (TypeScript, Tailwind v4), Prisma 7.10.0 + `@prisma/adapter-better-sqlite3` (SQLite), custom cookie-session mock auth. See [[Architecture-Overview]].
- Design language ported from Sage's frontend (grayscale oklch tokens, pill buttons, same radius scale) per explicit user request — hand-rolled `ui/` primitives, not a shared dependency.
- All core routes shipped and verified via a real click-through (Playwright, since `chromium-cli` wasn't available in this environment): `/login`, `/signup`, `/org-chart`, `/dashboard` (role-branched), `/team/[teamId]/people`, `/activity`, `/settings`.
- Onboarding/offboarding engine (`src/lib/workspace.ts`) is real: adding/removing a person actually mutates the DB (sharing policy application, document reassignment, access-revoke simulation) and writes to `ActivityEvent` — only the actual Google API calls are mocked. See [[FEAT-onboarding-offboarding-automation]].
- `npm run build`, `npx tsc --noEmit`, and `npm run lint` are all clean.
- Demo login: any `@acme.test` address (see `prisma/seed.ts` for the roster — owner is `owner@acme.test`), password `knowhow-demo`.
- Two real bugs found and fixed during the click-through pass (duplicate React key on the owner dashboard; unhandled duplicate-email 500 during onboarding) plus one UX bug (shared pending-state label) — see [[Known-Issues]] and [[Lessons-Learned]] for details.
- second-brain vault seeded for this repo, mirroring Sage's structure/conventions (see [[README]]).

## Still open
1. Not committed to git yet — need to review `git status`/`git diff` and make the first commit.
2. No GitHub remote — ask before creating one if the user wants it pushed.
3. Real Google OAuth + Admin SDK domain-wide delegation is still fully mocked — needs a GCP project + Workspace admin consent that only the user can provision (see [[0001-mocked-data-first-prototype]]).
4. "View as" has no permission check — demo-only, flagged in [[Known-Issues]], must not ship past prototype as-is.
5. SQLite is a prototyping choice — migrating to a real Postgres instance is an open follow-up decision, not yet made.
