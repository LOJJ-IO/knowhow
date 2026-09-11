---
type: context
status: active
tags: [priority/high, area/frontend, area/backend]
created: 2026-08-31
updated: 2026-09-10
related: ["[[0004-landing-only-purge-old-app]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[Patterns-landing-mc-recess-deck]]", "[[Known-Issues]]", "[[Architecture-Overview]]"]
---

# Current Context

## 🔔 Backend is built and ready to merge into `main` (2026-09-09)
A complete FastAPI backend — auth/identity (Google OAuth login, domain-wide delegation, personal-OAuth fallback, encrypted token storage, tamper-evident audit log, Google API retry/backoff) plus org chart, sharing/ownership engine (TransferBatch dry-run/execute/reverse), activity detection, and DeepSearch — is built, tested, and consolidated onto branch `backend/auth-foundation`. Full reasoning and integration contract in [[0004-fastapi-backend-for-auth-and-identity]] and the "Backend integration contract" section of [[Architecture-Overview]].

**Not merged into `main` yet — only on the user's explicit request.** Per [`CLAUDE.md`](../../CLAUDE.md)'s standing reminder, every response in this repo should note the backend is ready to merge until that happens. Deployment (Railway, managed Postgres, GCP) is out of scope until then.

## Active priority
The user is rebuilding the frontend from scratch, screen by screen — **not** a Claude-driven redesign. **Implement only what is explicitly asked; never invent copy, layout, or visual decisions; ask rather than fill gaps.** Update second-brain after every change.

## What's true right now (2026-09-10) — landing only
- **Old app purged** ([[0004-landing-only-purge-old-app]]). Live route: `/` → `<LandingHero />`.
- Canvas: `--background: #F9F8F6`, `--foreground: #1c1917`.
- **Get Started handoff:** six-phase CTA — `idle → spinner (400ms) → blank (220ms) → arrows (280ms) → splitting → controls`. Pill pinches into two **54px** circles via `liquid-gooey` on the deck rise/spread schedule. At `controls`, goo unmounts and **real** left/right circles (chevrons) call `focusDeckSide` — bring matching deck card forward (`deckIndex` 0/2, `data-focus` z-index) and sync mobile Cover Flow. **`data-open` flips with the split.**
- **Deck:** three painted mats — left `green.png`, center `blue.png`, right `red.png` — outer radius **10px**; inset mac windows (**14px**, light well `#f3f2ef`, titlebar `#d1cfcc`) — **draggable** / **resizable**. Favicon = hex mark (`src/app/icon.svg`). `yellow.png` ready in `public/deck/`.
- **Desktop:** 16:9 rise + linear-spread. **Mobile:** phone aspect (`9 / 19.5`) Cover Flow (framer-motion).
- Subhead / logo / CTA size+position tweaks live in `landing-hero.tsx` + `globals.css` (see recent Lessons-Learned). Hero video grain `.t-hero-grain`; guidelines grid always on. Grid edit via `NEXT_PUBLIC_EDITING_MODE_ENABLED`.
- `LogoMark` hex: `#4285F4` / `#34A853` / `#FBBC05` / `#EA4335`.

## Open questions / next
1. Tune middle-band geometry; card content; swipe later.
2. Auth / data / Google seams return only when explicitly asked (or when `backend/auth-foundation` is merged).
3. Hero video contrast strategy ([[Known-Issues]]).
4. GitHub remote `LOJJ-IO/knowhow`; Vercel from `main`.
5. `backend/auth-foundation` merge into `main` — user go-ahead only.

## Archive
Pre-purge product history and long logo/editor chronology live in git + older vault revisions.
