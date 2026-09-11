---
type: known-issues
status: active
tags: []
created: 2026-08-31
updated: 2026-09-10
related: ["[[Lessons-Learned]]", "[[Current-Context]]", "[[0004-landing-only-purge-old-app]]"]
---

# Known Issues

## Format
```
- **[area]** short description — workaround if any. (since YYYY-MM-DD)
```

## Open
- **[a11y / landing]** Hero text (`#1c1917`) sits on a looping background video with no dim overlay (explicit product choice, 2026-09-09). Contrast can fail WCAG 2.2 AA on darker video frames even when it passes on light ones. Tracked until a contrast strategy is chosen. (since 2026-09-09)
- **[deploy / data]** No durable database in tree (Prisma/SQLite removed earlier). Auth/data/product routes were purged 2026-09-10 ([[0004-landing-only-purge-old-app]]). Next store needs a durable host — see [[0002-remove-prisma-for-vercel]]. (since 2026-09-05, updated 2026-09-10)
- **[google-integration]** No Google API client in tree. When workspace seams return, keep them mocked until GCP + domain-wide delegation is provisioned — [[0001-mocked-data-first-prototype]]. (since 2026-08-31, updated 2026-09-10)

## Recently resolved
- **[frontend]** Old product app (auth routes, `(app)/*`, Sage `ui/`/shell/dashboard/team/settings, navy oklch tokens, cookie sessions, stubbed queries/workspace) removed from the live tree per explicit purge — [[0004-landing-only-purge-old-app]]. (resolved 2026-09-10)
- **[frontend]** `/login` and `/dashboard` blank-placeholder regime ended — those routes no longer exist. (resolved 2026-09-10; was open since 2026-09-04)
- **[frontend]** `TeamDocumentsBoard`'s owner list (used for both the filter dropdown and React list keys) had duplicate entries when a team's leader was also present in `team.members` (their `teamId` gets set when promoted, so they show up in both `team.leader` and `team.members`) — caused a "two children with the same key" React warning on the owner dashboard. Fixed by filtering `activeTeam.members` to exclude `activeTeam.leaderId` before building the owners list in `src/app/(app)/dashboard/page.tsx`. Caught via a Playwright-driven click-through, not by inspection. (resolved 2026-08-31)
- **[backend]** `onboardPerson` let a duplicate email hit Prisma's unique constraint and throw an unhandled `PrismaClientKnownRequestError`, surfacing as a raw 500 with no user-facing feedback. Fixed: check for an existing user by email first and throw a plain `Error` with a friendly message; `addPerson` (the Server Action) now catches and returns `{ error: string }` instead of letting Next's default production error-message redaction hide it. `PeopleManager` renders that error distinctly from a success summary. (resolved 2026-08-31)
- **[frontend]** `PeopleManager` used one shared `useTransition`/`isPending` for both Add and Remove actions — removing someone made the unrelated "Add Person" button show "Adding…". Fixed with two separate transitions (`isAdding`, `isRemoving` + `removingId` to scope the "Removing…" label to the specific row). (resolved 2026-08-31)
