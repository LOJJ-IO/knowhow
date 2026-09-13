---
type: known-issues
status: active
tags: []
created: 2026-08-31
updated: 2026-09-12
related: ["[[Lessons-Learned]]", "[[Current-Context]]", "[[0004-landing-only-purge-old-app]]"]
---

# Known Issues

## Format
```
- **[area]** short description — workaround if any. (since YYYY-MM-DD)
```

## Open
- **[dev env]** Local `next build` fails type-check on `.next/dev/types/validator.ts` referencing the purged `(app)` / `(auth)` routes. Cause: the `next dev` server (running since before the 2026-09-10 purge commit) keeps a stale route list and regenerates that file on every change; `tsconfig.json` includes `.next/dev/types/**`. Workaround: restart `next dev`. Vercel is unaffected (clean checkout has no `.next/dev`). App code type-checks clean with that dir excluded. (since 2026-09-10)
- **[dev / landing]** Browser: `Router action dispatched before initialization` during Fast Refresh / soft-nav while App Router isn’t ready. Stub `#about` / `#privacy` footer links now `preventDefault` so they don’t soft-nav. Persistent after every HMR compile → restart `next dev` (same stale-dev cluster as validator issue above). (since 2026-09-12)
- **[a11y / landing]** Hero text (`#1c1917`) sits on a looping background video with no dim overlay (explicit product choice, 2026-09-09). Contrast can fail WCAG 2.2 AA on darker video frames even when it passes on light ones. Tracked until a contrast strategy is chosen. (since 2026-09-09)
- **[deploy / data]** No durable database in tree (Prisma/SQLite removed earlier). Auth/data/product routes were purged 2026-09-10 ([[0004-landing-only-purge-old-app]]). Next store needs a durable host — see [[0002-remove-prisma-for-vercel]]. (since 2026-09-05, updated 2026-09-10)
- **[google-integration]** No Google API client in tree. When workspace seams return, keep them mocked until GCP + domain-wide delegation is provisioned — [[0001-mocked-data-first-prototype]]. (since 2026-08-31, updated 2026-09-10)

## Recently resolved
- **[landing / desktop]** Regression from the 2026-09-11 height-fit scale: parked deck cards (idle, before Get Started; and after closing) are positioned 110vh down *in deck coordinates*, so scaling the deck to 0.7 left them 2px below the viewport at 688px tall (shadows showing) and 21px *into view* at 640px. Fixed with `--deck-sunk = 110vh / --deck-fit` (base transform, `t-deck-rise` keyframe, and the JS close) inside an `@supports` for trig functions, so it's 110vh on screen at any scale; unsupported browsers keep the unscaled deck. (resolved 2026-09-11)
- **[landing / desktop]** In a normal Chrome window (toolbar eats ~70–120px of height) the open deck ran into the subhead and the logo — 1px gap at 1470×832, overlapping at 1440×780, touching in the user's 1219×688 window — while Safari full-screen looked fine. Cause: cards are sized from viewport *width* only, so height never shrank the deck. Fixed in `globals.css`: `.t-deck--desktop` scales uniformly with `min(1, max(0.7, 100vh / 956px))` around the centre card. Full-screen ≥956px unchanged; Chrome-sized windows now keep 36–47px below and 40–53px above. (resolved 2026-09-11)
- **[landing]** The split-CTA ← → circles were unclickable on both viewports from the moment the deck opened: `.t-deck` is a full-screen `z-20` layer and `[data-open=true]` gave it `pointer-events: auto`, above the `z-10` landing UI. Visually invisible (the stage is transparent). Fixed in `globals.css`: the open deck only takes clicks on `.t-deck-card` and `.t-deck-cover-nav`. Caught by Playwright's actionability check ("…intercepts pointer events"), not by eye. (resolved 2026-09-10) — [[FEAT-landing-deck-carousel]]
- **[frontend]** Old product app (auth routes, `(app)/*`, Sage `ui/`/shell/dashboard/team/settings, navy oklch tokens, cookie sessions, stubbed queries/workspace) removed from the live tree per explicit purge — [[0004-landing-only-purge-old-app]]. (resolved 2026-09-10)
- **[frontend]** `/login` and `/dashboard` blank-placeholder regime ended — those routes no longer exist. (resolved 2026-09-10; was open since 2026-09-04)
- **[frontend]** `TeamDocumentsBoard`'s owner list (used for both the filter dropdown and React list keys) had duplicate entries when a team's leader was also present in `team.members` (their `teamId` gets set when promoted, so they show up in both `team.leader` and `team.members`) — caused a "two children with the same key" React warning on the owner dashboard. Fixed by filtering `activeTeam.members` to exclude `activeTeam.leaderId` before building the owners list in `src/app/(app)/dashboard/page.tsx`. Caught via a Playwright-driven click-through, not by inspection. (resolved 2026-08-31)
- **[backend]** `onboardPerson` let a duplicate email hit Prisma's unique constraint and throw an unhandled `PrismaClientKnownRequestError`, surfacing as a raw 500 with no user-facing feedback. Fixed: check for an existing user by email first and throw a plain `Error` with a friendly message; `addPerson` (the Server Action) now catches and returns `{ error: string }` instead of letting Next's default production error-message redaction hide it. `PeopleManager` renders that error distinctly from a success summary. (resolved 2026-08-31)
- **[frontend]** `PeopleManager` used one shared `useTransition`/`isPending` for both Add and Remove actions — removing someone made the unrelated "Add Person" button show "Adding…". Fixed with two separate transitions (`isAdding`, `isRemoving` + `removingId` to scope the "Removing…" label to the specific row). (resolved 2026-08-31)
