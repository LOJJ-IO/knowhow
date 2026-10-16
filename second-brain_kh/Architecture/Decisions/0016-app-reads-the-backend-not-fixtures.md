---
type: decision
status: active
tags: [area/frontend, area/backend]
created: 2026-09-21
updated: 2026-09-21
related: ["[[FEAT-core-app-screens]]", "[[0008-continue-with-google-via-backend]]", "[[0001-mocked-data-first-prototype]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[0015-seeded-generative-identity-system]]", "[[Current-Context]]"]
---

# ADR-0016: The signed-in app reads the FastAPI backend, and the session is fetched in the browser

## Status
`active`

## Context
The app shell shipped against a fixture (`MOCK_ORGANIZATION_ID`) because nothing linked the frontend to
`backend/` yet. The user asked for it to be real (2026-09-21): "link the app to the db so it's not
mocked anymore."

The constraint that shaped the answer: **the session cookies live on the backend's origin**
(`localhost:8000`), not on the Next.js origin. A Server Component in `src/app` cannot see them, so it
cannot read who is signed in.

## Decision
1. **The app's data comes from the backend, over the browser's credentialed fetch.** `GET /auth/me` for
   the session and org, `GET /org-chart/{org_id}` for teams.
2. **The session is fetched once, client-side, at the top of the `(app)` route group**
   (`AppSessionProvider`) and handed down by context. No screen re-fetches the chrome it sits inside.
3. **No session means no app.** The provider sends them to `/`, which owns signing in. Complementary to
   the landing's redirect *into* the app, so the two cannot loop.
4. **Every read still takes `organizationId` as a required argument** (CLAUDE.md invariant 3). This is
   not just convention: the backend enforces it with `require_same_org`.
5. **Invariant 2 is unchanged.** Nothing in `src/` calls a Google API. Google is reached only *through*
   the backend, exactly as [[0008-continue-with-google-via-backend]] set out, and the Drive/activity
   seams in `src/` remain unbuilt rather than mocked-and-wired.

## Consequences
**Good.** The app shows the real organization, the real viewer and the real teams. The mock is gone from
this path, and `src/lib/organization. ts`'s functions are the real seam.

**Costs and limits.**
- **The app does not server-render its content.** The first paint inside `(app)` is a quiet placeholder
  until `/auth/me` answers. That is a direct consequence of cross-origin cookies, not a preference. If
  SSR matters later, the options are a Next.js proxy route that forwards cookies, or moving the backend
  behind the same origin.
- **The backend must be running** for the app to render anything. With it down, `fetchMe()` returns
  null and the app bounces to the landing — the same path as signed-out.
- `/auth/me` gained no fields; `display_name` was simply missing from the frontend's `Me` type and is
  now declared. The viewer's name falls back to their email when Google gave no name — never an
  invented display name.

## Implementation
- `src/components/app/session.tsx` — `AppSessionProvider`, `useSession()`.
- `src/lib/organization.ts` — `chromeFromMe()`, `fetchOrgTeams(organizationId)`. The mock fixture and
  `MOCK_ORGANIZATION_ID` are deleted.
- `src/components/app/screens/org-chart-screen.tsx` — first screen on real data: the org's teams, each
  with its generated icon ([[0015-seeded-generative-identity-system]]), with loading, empty and error
  states.
- The other six screens are still empty states: there is no data behind them yet.
