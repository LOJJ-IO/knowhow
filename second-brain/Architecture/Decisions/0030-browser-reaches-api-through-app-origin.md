---
type: decision
status: active
tags: [area/backend, area/frontend, auth, deploy]
created: 2026-10-01
updated: 2026-10-01
related: ["[[0022-landing-and-app-on-separate-origins]]", "[[0008-continue-with-google-via-backend]]", "[[Current-Context]]", "[[Known-Issues]]"]
---

# ADR-0030: Browsers reach the API through the app's own origin (`/api`)

## Status
`active` (2026-10-01). Fixes "sign-in bounces back to the get-started page" on Railway.

## Context
On Railway the frontend (`frontend-production-aa28.up.railway.app`) and backend (`backend-production-13933.up.railway.app`) are **different sites** (`up.railway.app` is on the Public Suffix List). The backend set its session cookies on its own host (`SameSite=None; Secure`), so every app request was a third-party cookie request. Safari, Firefox, Brave and private/incognito windows drop those cookies, so `/auth/me` came back 401 and the app sent the person to `/`. Chrome with default settings happened to work, which hid the bug.

Custom domains (`app.` + `api.` on knohow.app) would also fix it, but need DNS work outside the code, and two subdomains still put cookies on a different host from the page.

## Decision
The browser only ever talks to the frontend's origin:
- Next.js rewrites `/api/:path*` to the backend (`BACKEND_PROXY_TARGET`, `next.config.ts`). Railway frontend: `NEXT_PUBLIC_BACKEND_API_URL=/api`.
- Set-Cookie headers pass back through the proxy with no `Domain`, so they belong to the frontend's host: first-party in every browser.
- Google still calls back on the **registered** `GOOGLE_OAUTH_REDIRECT_URI` (the backend host). When `PUBLIC_API_BASE` is set (Railway backend: `https://frontend-production-aa28.up.railway.app/api`), `/auth/callback` immediately 302s to `${PUBLIC_API_BASE}/auth/callback?…&via=app`, so the real callback runs first-party and can read this browser's device/pending cookies. The code exchange uses the registered URI server-side, so **no GCP change was needed**.
- Backend redirects that were relative (`/auth/admin-proof/start`, `/onboarding/signup`) go through `api_path()` so they stay under `/api`.
- Server-side fetches can't use a relative base: `fetchJoinPreview` prefers `BACKEND_PROXY_TARGET`.
- Locally nothing changes: both vars unset, the browser calls `localhost:8000` (same-site with `localhost:3000`).

## Alternatives considered
- **Custom domains first** — still the right end state for production branding; deferred, not required for cookies any more.
- **A one-time handoff token after the callback** — more moving parts, and every top-level navigation to the backend host would still need it.
- **`Partitioned` (CHIPS) cookies** — Chrome-only semantics; doesn't help Safari.

## Consequences
- Sign-in works in every browser on Railway. Verified 2026-10-01 with Chromium's third-party-cookie blocking on (`--test-third-party-cookie-phaseout`): `/demo` → Home and every screen loaded, no bounce.
- Every API call costs one extra hop through the Next server. Fine at this scale.
- Watch out in Git Bash: setting `NEXT_PUBLIC_BACKEND_API_URL=/api` via the Railway CLI is mangled to `C:/Program Files/Git/api` unless `MSYS_NO_PATHCONV=1` (see [[Lessons-Learned]]).
- Test: `test_callback_hops_onto_the_frontend_origin_when_proxied` (`tests/test_auth_callback.py`).
