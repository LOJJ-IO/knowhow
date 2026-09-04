---
type: context
status: active
tags: [priority/high, area/frontend, area/backend]
created: 2026-08-31
updated: 2026-09-02
related: ["[[0001-mocked-data-first-prototype]]", "[[FEAT-org-chart-builder]]", "[[FEAT-doc-visibility-dashboard]]", "[[FEAT-doc-creation-auto-share]]", "[[FEAT-onboarding-offboarding-automation]]", "[[Known-Issues]]"]
---

# Current Context

## Active priority
Demo prep for an upcoming pitch meeting (possibly with "Jeane" — user unsure who'll attend). 2026-09-02 pass delivered the two things the user asked for: (1) restyle to match the pitch-deck inspo (navy sidebar, Google Workspace colors, light-gray canvas — replacing the grayscale Sage-derived look), and (2) the live demo flow: in-app doc creation with a share-with choice, auto-share + Drive auto-filing visible in a receipt, a folder-routing "file chart" panel on the owner dashboard, and org-wide doc search. See [[FEAT-doc-creation-auto-share]]. All flows verified via an 11-check Playwright click-through (all passing).

## What's true right now (2026-09-02)
- Demo flow works end-to-end as owner (`owner@acme.test`), leader (`sarah.chen@acme.test`), and member (`mike.ross@acme.test`): login → org chart → owner dashboard (search, create-with-audience, auto-filing panel, per-team boards) → member dashboard (create → auto-share receipt → My Recent Work) → leader/owner see the doc arrive → activity feed logs it.
- New schema field `Document.sharedWithEveryone` (owner broadcasts); visibility rules centralized in `visibilityWhere()` in `src/lib/queries.ts`.
- `dev.db` has minor click-through residue — see the demo-data entry in [[Known-Issues]] for the pristine-reset command.
- Most of the 2026-09-02 work was committed mid-session by something outside this Claude session (commits `88b1130`, `3d61b6a` — likely the user's IDE); the sidebar sign-out contrast fix and these vault updates are still uncommitted.

## What was true from the first build pass (2026-08-31)
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
1. Commit the tail of the 2026-09-02 demo-prep work (sidebar sign-out fix + vault updates) when the user says so; most of it was already committed mid-session (see above).
2. No GitHub remote — ask before creating one if the user wants it pushed.
3. Real Google OAuth + Admin SDK domain-wide delegation is still fully mocked — needs a GCP project + Workspace admin consent that only the user can provision (see [[0001-mocked-data-first-prototype]]).
4. "View as" has no permission check — demo-only, flagged in [[Known-Issues]], must not ship past prototype as-is.
5. SQLite is a prototyping choice — migrating to a real Postgres instance is an open follow-up decision, not yet made.
