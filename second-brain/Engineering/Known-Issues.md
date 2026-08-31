---
type: known-issues
status: active
tags: []
created: 2026-08-31
updated: 2026-08-31
related: ["[[Lessons-Learned]]"]
---

# Known Issues

## Format
```
- **[area]** short description — workaround if any. (since YYYY-MM-DD)
```

## Open
- **[product]** Offboarding is one-way — an offboarded `User` has no "reinstate" path in the UI (the data model supports flipping `status` back to `ACTIVE`, but nothing calls it). (since 2026-08-31)
- **[auth]** "View as" (`src/app/(auth)/actions.ts`) starts a real session for any user in the org with no password check — explicitly a demo-only convenience so the org chart owner can preview a teammate's dashboard. Must not ship past this prototype phase without a real permission check (e.g. owner/leader only, and only for users in their own scope). (since 2026-08-31)
- **[google-integration]** Nothing under `src/lib/` calls a real Google API yet — "Create New Work" tiles link to real, universal Google create-new URLs (`docs.google.com/document/create` etc.), but everything else (access grants, sharing, app list) is simulated. See [[0001-mocked-data-first-prototype]]. (since 2026-08-31)

## Recently resolved
- **[frontend]** `TeamDocumentsBoard`'s owner list (used for both the filter dropdown and React list keys) had duplicate entries when a team's leader was also present in `team.members` (their `teamId` gets set when promoted, so they show up in both `team.leader` and `team.members`) — caused a "two children with the same key" React warning on the owner dashboard. Fixed by filtering `activeTeam.members` to exclude `activeTeam.leaderId` before building the owners list in `src/app/(app)/dashboard/page.tsx`. Caught via a Playwright-driven click-through, not by inspection. (resolved 2026-08-31)
- **[backend]** `onboardPerson` let a duplicate email hit Prisma's unique constraint and throw an unhandled `PrismaClientKnownRequestError`, surfacing as a raw 500 with no user-facing feedback. Fixed: check for an existing user by email first and throw a plain `Error` with a friendly message; `addPerson` (the Server Action) now catches and returns `{ error: string }` instead of letting Next's default production error-message redaction hide it. `PeopleManager` renders that error distinctly from a success summary. (resolved 2026-08-31)
- **[frontend]** `PeopleManager` used one shared `useTransition`/`isPending` for both Add and Remove actions — removing someone made the unrelated "Add Person" button show "Adding…". Fixed with two separate transitions (`isAdding`, `isRemoving` + `removingId` to scope the "Removing…" label to the specific row). (resolved 2026-08-31)
