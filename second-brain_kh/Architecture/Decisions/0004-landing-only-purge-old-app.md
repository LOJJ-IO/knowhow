---
type: decision
status: active
tags: [area/frontend, area/architecture]
created: 2026-09-10
updated: 2026-09-10
related: ["[[Current-Context]]", "[[0002-remove-prisma-for-vercel]]", "[[0003-cookie-only-sessions-demo-roster]]", "[[Architecture-Overview]]"]
---

# ADR-0004: Landing-only purge of the old app UI

## Status
`active`

## Context
The user is rebuilding the frontend from scratch, screen by screen. Residual old product UI (Sage-derived navy/cool-gray design system, `(app)/*` product routes, auth chrome, cookie sessions, stubbed queries/workspace) kept leaking into new work — e.g. the CTA next panel used `bg-background` and read as brand-blue. Explicit ask: remove all traces of the old app.

## Decision
Ship a **landing-only** tree: `/` → `LandingHero` only. Delete `(app)/`, `(auth)/`, `components/{ui,shell,dashboard,team,settings,theme}`, unused brand `draggable`, and lib auth/data stubs (`session`, `auth`, `demo-users`, `password`, `queries`, `workspace`, `theme`). Trim `globals.css` to landing canvas `#F9F8F6` / foreground `#1c1917` plus shimmer + panel-slide utilities. No dark-mode theme provider. Rejected `.design/knowhow-canvas` removed.

## Alternatives considered
- **Blank-placeholder routes** (`/login`, `/dashboard` empty) — rejected; still carried old layout/tokens and confused agents into treating them as live surface.
- **Keep session redirect to `/dashboard`** — rejected; dashboard gone; redirect was old-app coupling.
- **Only change `--background` color** — rejected; user asked for full purge, not a token tweak.

## Consequences
- `npm run build` serves only `/` (+ `_not-found`).
- Auth, org-chart, docs, onboarding UI are recoverable from git history only until rebuilt on request.
- [[0003-cookie-only-sessions-demo-roster]] is superseded for the current tree (no session code); its reasoning remains valid if auth returns.
- Agents must not restore Sage `ui/` / navy oklch palette without an explicit ask.

## Related
Supersedes in-tree presence of [[0003-cookie-only-sessions-demo-roster]]. See [[Current-Context]].
