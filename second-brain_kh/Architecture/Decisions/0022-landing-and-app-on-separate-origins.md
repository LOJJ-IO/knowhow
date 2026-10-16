---
type: decision
status: active
tags: [area/frontend, area/backend, area/auth]
created: 2026-09-26
updated: 2026-09-26
related: ["[[0008-continue-with-google-via-backend]]", "[[0021-founder-not-owner-leads-self-claim]]", "[[Architecture-Overview]]"]
---

# ADR-0022: Landing and app live on separate origins

## Status
`active`

## Context
Sign-in, founder setup, the join wizard and Google's round-trip results all rendered as a sheet sliding up over the landing at `/`, and every backend redirect came back to that one origin. The user asked for the landing and the app to have different URLs (2026-09-26), chose a subdomain split, and chose that sign-in and onboarding move with the app. Nothing should look different.

## Decision
One Next.js deployment serves two origins: the **landing on `https://knohow.app`** (`/`, `/terms`, `/privacy`, Book a Demo) and **the app on `https://app.knohow.app`** (sign-in, onboarding, join and invite links, Google results, `/home` and the rest). `src/proxy.ts` routes by host: app paths and returning-from-Google query strings on the landing redirect to the app origin; the app origin's `/` rewrites to `/entry` (`AppEntry`, the same sky sheet, already at the top). Log In on the landing still slides the sheet up, then hands off to the app origin when it reaches the top.

Backend: `FRONTEND_ORIGIN` is the **app** origin (all redirects, join and invite links); new `SITE_ORIGIN` is the landing (CORS + the Book a Demo recovery link). Frontend: `NEXT_PUBLIC_APP_ORIGIN` / `NEXT_PUBLIC_SITE_ORIGIN` (`src/lib/origins.ts`).

**Locally both are unset**: one origin (`localhost:3000`) serves both, the app's front door at `/entry`. A local split cannot work: the app must stay on `localhost` to be same-site with the backend's cookies (Google's callback is `localhost:8000`), and Next's dev server rewrites any redirect to a `localhost` host onto the visitor's own host.

## Alternatives considered
- **Same domain, own paths (`/login`, `/setup`)**: offered, not chosen.
- **Sign-in on the landing, only the app on the subdomain**: offered, not chosen.
- **Local split on `site.localhost` / `127.0.0.1`**: tried; Next dev treats loopback names as one host and the app can't leave `localhost` without losing the backend's cookies.

## Consequences
- The landing no longer knows about sessions beyond "signed in? go to the app".
- Production needs both domains pointed at the Vercel project and the four env vars set; the backend needs both origins.
- The split's host routing is only exercised in production (verified 2026-09-26 by calling `proxy()` with production hostnames).

## Related
[[Architecture-Overview]] (backend contract), `src/proxy.ts`, `src/lib/origins.ts`, `src/components/login/app-entry.tsx`, `src/components/login/sign-in-sheet.tsx`.
