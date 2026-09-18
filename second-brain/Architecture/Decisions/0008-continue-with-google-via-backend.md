---
type: decision
status: active
tags: [area/frontend, area/backend, auth, google]
created: 2026-09-18
updated: 2026-09-18
related: ["[[0001-mocked-data-first-prototype]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[FEAT-landing-login-panel]]", "[[FEAT-workspace-onboarding-flow]]", "[[Architecture-Overview]]"]
---

# ADR-0008: Continue with Google is real sign-in, handed to the FastAPI backend

## Status
`active` — user decision 2026-09-18 ("Real, via backend", over a mocked sign-in).

## Context
The Log In modal's **Continue with Google** was inert. [[FEAT-workspace-onboarding-flow]] (2026-09-16/17) had planned a *mocked* frontend. By 2026-09-18 a GCP project **`knohow-staging`** exists with a Web OAuth client (Google accepts its client ID + `http://localhost:8000/auth/callback` — probed, no `redirect_uri_mismatch`) and a delegation service account (`knohow-delegation@knohow-staging…`), all referenced from `backend/.env`. Whether domain-wide delegation is authorized in any Workspace Admin console is **not** verified.

## Decision
The button does a full-page redirect to `${NEXT_PUBLIC_BACKEND_API_URL}/onboarding/signup` (Google OAuth, login scopes only: `openid`, email, profile). The backend owns the whole OAuth exchange and sets its session cookies, then redirects to `FRONTEND_ORIGIN`. `/onboarding/signup` is the single entry: it logs in an existing member and bootstraps an org for an unknown one.

**Scope of the change to [[0001-mocked-data-first-prototype]] / CLAUDE.md invariant 2:** `src/` still makes **no** Google API calls — it only navigates the browser to the backend. Workspace *data* seams in `src/` stay mocked; this ADR records OAuth sign-in only, not delegation.

## Alternatives considered
- **Mocked sign-in in the panel** — the spec's plan; rejected by the user now that a real OAuth client exists.
- **Two buttons / two entry points (`/auth/login` vs `/onboarding/signup`)** — rejected: the spec asks nothing before auth, and `complete_signup` already treats a known email as a login.
- **Per-flow redirect URIs** — needs extra URIs registered in the GCP console; instead `/auth/callback` dispatches on the signed state's `purpose` (`peek_state_purpose`).

## Consequences
- Signup now reaches the backend's **pre-spec** logic: `complete_signup` bootstraps a new org for *any* unknown verified email, with no `hd` check, no observed-domain dedupe, no domainless org (gaps listed in [[FEAT-workspace-onboarding-flow]] → Technical approach). Fine for local dev; not for real users (also blocked by the privacy launch blocker in [[Known-Issues]]).
- After the redirect back, the landing shows nothing different — no signed-in state or onboarding screens exist yet (user designs them).
- Local run needs Postgres at `DATABASE_URL` + `alembic upgrade head` — set up 2026-09-18 — Homebrew Postgres on 5432 (see [[Current-Context]]).
- Personal-OAuth (Drive consent) shares the same redirect URI and is still broken — see [[Known-Issues]].

## Related
[[0001-mocked-data-first-prototype]] · [[0004-fastapi-backend-for-auth-and-identity]] · [[FEAT-landing-login-panel]] · [[FEAT-workspace-onboarding-flow]]
