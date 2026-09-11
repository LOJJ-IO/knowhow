---
type: context
status: active
tags: [priority/high, area/frontend, area/backend]
created: 2026-08-31
updated: 2026-09-11
related: ["[[FEAT-landing-deck-carousel]]", "[[FEAT-landing-header-nav]]", "[[0004-landing-only-purge-old-app]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[Patterns-landing-mc-recess-deck]]", "[[Known-Issues]]", "[[Architecture-Overview]]"]
---

# Current Context

## 🔔 Backend is built and ready to merge into `main` (2026-09-09)
A complete FastAPI backend — auth/identity (Google OAuth login, domain-wide delegation, personal-OAuth fallback, encrypted token storage, tamper-evident audit log, Google API retry/backoff) plus org chart, sharing/ownership engine (TransferBatch dry-run/execute/reverse), activity detection, and DeepSearch — is built, tested, and consolidated onto branch `backend/auth-foundation`. Full reasoning and integration contract in [[0004-fastapi-backend-for-auth-and-identity]] and the "Backend integration contract" section of [[Architecture-Overview]].

**Not merged into `main` yet — only on the user's explicit request.** Per [`CLAUDE.md`](../../CLAUDE.md)'s standing reminder, every response in this repo should note the backend is ready to merge until that happens. Deployment (Railway, managed Postgres, GCP) is out of scope until then.

## Active priority
The user is rebuilding the frontend from scratch, screen by screen — **not** a Claude-driven redesign. **Implement only what is explicitly asked; never invent copy, layout, or visual decisions; ask rather than fill gaps.** Update second-brain after every change.

## What's true right now (2026-09-11) — landing only
- **Old app purged** ([[0004-landing-only-purge-old-app]]). Live route: `/` → `<LandingHero />`.
- Canvas: `--background: #F9F8F6`, `--foreground: #1c1917`.
- **Desktop header** ([[FEAT-landing-header-nav]]): logo left; Log in + Book a demo + Get Started right (shared `CTA_CLASS`, −20% from prior size, tight group). Sliding tabs removed. Mobile header still logo-only (+ bottom Get Started).
- **Get Started handoff:** six-phase CTA — `idle → spinner (400ms) → blank (220ms) → arrows (280ms) → splitting → controls`. Pill pinches into two **~43.5px** circles via `liquid-gooey` on the deck rise/spread schedule. At `controls`, goo unmounts and **real** left/right circles (chevrons) drive the deck, each with the Get Started click sound (module-level `playClickSound`, one shared `AudioContext`). **Desktop:** looping **four-card** carousel (green / blue / red / yellow) with the user's cascade — ← : left card thrown off, centre → left slot, right → centre, next ring card slides in on the right last; → mirrors ([[FEAT-landing-deck-carousel]]). **Mobile:** still `focusDeckSide` (Cover Flow index 0 / last) — awaiting user decision. The open deck only takes clicks on its cards + Cover Flow bar (`globals.css`); before that fix the full-screen deck layer swallowed every click on the arrows. **`data-open` flips with the split.**
  - **2026-09-11:** desktop **Log in / Book a demo** (user copy) are hidden until the split, then goo out of the pill into their row slots on the same schedule as the arrows and hand over to the real buttons (Δ 0px). **Click outside** the card band / logo lockup / any control plays the whole handoff **backwards** (pieces flow back + side cards fold under the centre card → deck sinks + logo/subhead grow back → arrows fade → Get Started); spinner not replayed; a drag released outside doesn't count. **"Features"** label (subhead's face/tracking/colour/open-state size, verified identical rendered px) sits just above the middle card, desktop only. See [[FEAT-landing-deck-carousel]].
- **Deck:** four painted mats — `green.png`, `blue.png`, `red.png`, `yellow.png` — outer radius **10px**; inset mac windows (**14px**, light well `#f3f2ef`, titlebar `#d1cfcc`) — **draggable** / **resizable**. Favicon = hex mark (`src/app/icon.svg`). Desktop seats three (±side + centre); yellow starts parked at slot +2.
- **Desktop:** 16:9 rise + linear-spread. Deck scales with window height below 956px (`--deck-fit`, floor 0.7) so Chrome-height windows keep room above/below — see [[Known-Issues]] (resolved 2026-09-11). **Mobile:** phone aspect (`9 / 19.5`) Cover Flow (framer-motion).
- Subhead / logo / CTA size+position tweaks live in `landing-hero.tsx` + `globals.css` (see recent Lessons-Learned). Hero video grain `.t-hero-grain`; guidelines grid always on. Grid edit via `NEXT_PUBLIC_EDITING_MODE_ENABLED`.
- `LogoMark` hex: `#4285F4` / `#34A853` / `#FBBC05` / `#EA4335`.

## Open questions / next
1. **Mobile arrow semantics + aria-labels (awaiting user)** — see [[FEAT-landing-deck-carousel]] open questions. Also: tune middle-band geometry; card content; swipe later.
2. **Header action destinations** — Log in / Book a demo wire-up; mobile treatment — [[FEAT-landing-header-nav]].
3. Auth / data / Google seams return only when explicitly asked (or when `backend/auth-foundation` is merged).
4. Hero video contrast strategy ([[Known-Issues]]).
5. GitHub remote `LOJJ-IO/knowhow`; Vercel from `main`.
6. `backend/auth-foundation` merge into `main` — user go-ahead only.
7. **Restart `next dev`** — it predates the purge commit and keeps regenerating a stale `.next/dev/types/validator.ts` that fails local `next build` ([[Known-Issues]]).

## Archive
Pre-purge product history and long logo/editor chronology live in git + older vault revisions.
