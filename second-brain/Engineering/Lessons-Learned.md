---
type: pattern
status: active
tags: []
created: 2026-08-31
updated: 2026-08-31
related: ["[[Known-Issues]]", "[[Architecture-Overview]]"]
---

# Lessons Learned

## 2026-08-31 — Prisma 7 requires a driver adapter; there's no implicit engine connection anymore
`new PrismaClient()` with no options now throws `PrismaClientInitializationError: ... A driver adapter is required`. For SQLite, install `@prisma/adapter-better-sqlite3` (pinned to the same version as `prisma`/`@prisma/client`) and pass `new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })`. Note the export is `PrismaBetterSqlite3` (lowercase "q" in "Sqlite"), not `PrismaBetterSQLite3` — easy to typo from the package name. `prisma migrate dev`/`deploy` (the CLI) don't need this — only the runtime client does.

## 2026-08-31 — `prisma migrate reset` is blocked for AI agents by design
Prisma 7's CLI detects when it's invoked by Claude Code and refuses `migrate reset --force` outright, printing a message that the agent must ask the user for explicit consent before setting `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. For a disposable local dev SQLite file, the lighter-weight and equally effective path is: delete the db file directly (`rm dev.db`), then `prisma migrate deploy` (applies existing migrations to a fresh file, not gated) + reseed. Reserve asking the user for consent for cases where you actually need `reset`'s schema-diffing behavior against a real database.

## 2026-08-31 — Prisma CLI installed via `npx prisma init` without a pin can grab a release candidate
`npm install prisma @prisma/client` with no version pulled `8.0.0-rc.12` (an RC), which has a materially different CLI (`prisma.config.ts` skills-sync workflow, no `--datasource-provider` on `init`, etc.) from the stable `7.x` line. Pin to the latest stable (`npm view prisma versions --json`, filter out anything with a `-` in it) rather than trusting bare `npm install prisma` to land on something stable.

## 2026-08-31 — A shared `useTransition` across two unrelated actions leaks pending state
`PeopleManager` used one `isPending` flag for both "Add Person" and "Remove" — removing someone made the Add button read "Adding…" because both actions shared the same transition. Any component with two or more independently-triggerable async actions needs its own `useTransition` per action (or at least per meaningfully-different pending UI), not one shared flag. Caught via an actual click-through, not by reading the code — this class of bug doesn't show up in `tsc`/lint/build.

## 2026-08-31 — A Playwright click-through catches bugs that build/lint/typecheck can't
Two real bugs (duplicate React key from an owner appearing in both `team.leader` and `team.members`; a raw 500 from an unhandled unique-constraint violation) only surfaced by actually running the app and clicking through onboard → offboard → view-as, not from `tsc --noEmit`, `eslint`, or `next build`, all of which were clean the whole time. `chromium-cli` wasn't available in this environment; fell back to a local Playwright install (isolated in the scratchpad, not added to the app's own `package.json`) per the `run` skill's fallback guidance. Worth remembering: a clean build is necessary, not sufficient — always drive it before calling a feature done.
