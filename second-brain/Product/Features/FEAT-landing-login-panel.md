---
type: feature
status: in-progress
tags: [area/frontend, auth]
created: 2026-09-16
updated: 2026-09-17
related: ["[[Current-Context]]", "[[Patterns-landing-mc-recess-deck]]", "[[FEAT-landing-header-nav]]", "[[FEAT-landing-deck-carousel]]"]
---

# FEAT: Landing Log In panel

## Status
`in-progress` — animation shipped 2026-09-16; centred modal added 2026-09-17 with the first sign-in screen (heading, subtext, Continue with Google — button inert).

## Problem
Clicking "Log In" did nothing. User asked for the [[Patterns-landing-mc-recess-deck]] recess, with a full-page slide-up (a bottom sheet the full height of the page, not a small one).

## Solution
Clicking **Log In** in the desktop header (`DESKTOP_HEADER_EXTRAS`, via `GetStartedCta`'s `onExtraClick`) sets `loginOpen`:
- Everything on the landing (video, header, subhead, open deck) sits in one wrapper that scales to `0.9`.
- A veil (`rgb(28 25 23 / 0.35)`, `z-[300]`) fades in over it.
- A full-width `h-dvh` panel (`z-[400]`) — background `public/hero/signinbg.png` (city skyline at dusk, `bg-cover bg-center`, white while it loads; added 2026-09-16) — corner radius `var(--deck-window-radius)` (10.5px, same as the feature cards) while it travels, eased to square once it reaches the top (`loginAtTop`, set on the panel's own `translate` `transitionend`; cleared on Close so it slides down rounded) — slides from `translate-y-full` to `0`.
- **Sky (2026-09-16, per user "add stars and shooting stars"):** `LoginSky` layer over the image — 90 seeded (hydration-safe) white stars in the top 52% where the image is dark blue, denser/brighter higher up, each twinkling on its own 2.5–6.5s loop; 3 shooting-star streaks (bright head, fading tail, ~25° down-right, ~360px run) on 7/11/13s loops, visible ~8% of each. CSS in `globals.css` (`.t-login-star`, `.t-login-shooting-star`); animations paused unless the panel is open (`data-active`); reduced motion → static stars, no shooting stars.
- Panel slide **992ms** (900ms +5% → 945ms, then +5% again → 992ms, 2026-09-16); recess + veil still `900ms`. All three, `cubic-bezier(0.16, 1, 0.3, 1)` (the pattern's ease). No `filter` / `backdrop-filter`.
- A "Close" button (top right) reverses it — same pill as the header CTAs (`CTA_CLASS`, Satoshi bold, `bg-black/80`, `active:scale-95`; 2026-09-16, was a small underlined text link).
- **Sign-in modal (2026-09-17, user: "a modal in the center but the text and what it's asking for are unknown"):** `LoginModal` centred in the panel (absolute `inset-0` flex centre, `z-10`; wrapper `pointer-events-none`, so Close stays clickable). **Empty** — no copy, fields or buttons until the user specifies them. Surface matches the mobile Notes panel (`.t-deck-cover-notes`, user's pick): `#fbfaf8`, 1px `rgb(0 0 0 / 0.08)` border, 14px radius, `0 8px 20px rgb(0 0 0 / 0.12)` shadow, padding `0.85rem 1.1rem 1rem` (on `.t-login-modal-body`). Width `min(420px, 100% - 32px)`; height follows content (user's pick: fixed width, content height) — empty it's 32px (padding + border).
  - **Smooth resize (user-supplied Transitions.dev "Card resize" CSS):** `.t-resize` + `--resize-dur: 300ms` / `--resize-ease: cubic-bezier(0.22, 1, 0.36, 1)` in `globals.css`, reduced motion → no transition. CSS can't tween `height: auto`, so `LoginModal` measures its body with a `ResizeObserver` and sets an explicit px height on the shell (`overflow: hidden`); `.t-resize` tweens that. Verified: injecting 240px of content eases 32 → 272px over ~300ms; removing it eases back.
- **Sign-in content (2026-09-17, from a user-supplied Canva screenshot, "Canva" removed; answers via question tool):**
  - **Closed = thin line:** `LoginModal open={loginAtTop}` — until the panel reaches the top the shell's height is its border only (2px), so it reads as a white line; then it grows to the measured content height with `.t-resize` (user picked their own curve, no overshoot). On Close `loginAtTop` clears, so it collapses back while the panel slides down. Content is always laid out — the growing edge reveals it (no fade).
  - **Copy:** h2 "Log in or sign up in seconds"; p "Use your Google account to continue with Knowhow (it's free)!" (user's pick; Google-only per [[FEAT-workspace-onboarding-flow]], no email path); button "Continue with Google" with the multicolour Google G (`GoogleG` SVG, 20px, 13px from the left edge, text centred).
  - **Type:** heading + subtext Söhne (only weight in tree is Dreiviertelfett — user chose heavy subtext over Satoshi Regular), `1.62rem`/1.15 tracking-tight and `0.95rem`/1.6, `#1c1917`; button Satoshi bold `1rem`.
  - **Sizes matched to the reference** scaled ~0.6× to the 420px modal: button `h-12` full width, 10px radius, 1px `#d9d9de` border, white, `active:scale-[0.98]`; `mt-4` gaps. Heading fits one line at 420px (wraps on narrow widths).
  - **More portrait (2026-09-17, user: "slightly more portrait" → picked taller, same width):** body padding `0.85rem 1.1rem 1rem` → `2.5rem 1.1rem`; heading→subtext `mt-4` → `mt-6`; subtext→button `mt-4` → `mt-8`. 420×190 → **420×264** at 1470×956.
  - **Nested radius (2026-09-17, user: follow craft.gustavofior.com/nested-border-radius → "round modal more"):** button keeps `--login-button-radius: 10px`; modal = button radius + side padding (`--login-modal-pad-x: 1.1rem`) + 1px border = **28.6px** (was 14px).
  - **Button does nothing yet** (user's pick) — no mock sign-in until asked; no real Google call from `src/` ([[0001-mocked-data-first-prototype]]).
  - Verified at 1470×956: 2px during the 992ms slide → 190px ~300ms after arrival.
- **Logo (2026-09-16):** "Proudly from Edmonton" (`public/hero/edmonton.png`, alt text set) at the panel's bottom left (`bottom-6 left-6`, `z-10`, `pointer-events-none`), `h-8` / `md:h-10`. The source had faint near-zero-alpha pixels across the whole canvas, so a plain `getbbox()` crop barely trimmed it — cropped to alpha > 8 instead (1557×399) so the artwork reaches the file edges and the 24px inset is the real inset.

## Out of scope
- What Continue with Google does, and every screen after it — not specified yet. The modal will host the sign-in + onboarding screens from [[FEAT-workspace-onboarding-flow]]; contents built only as the user specifies.
- Talk to Sales — still does nothing.

## Technical approach
`LandingHero` in `landing-hero.tsx`. Log In only appears after Get Started splits, so the deck is always at `controls` while the panel is open. The landing's click-outside-closes-the-deck handlers (`handleBackdropPointerDown` / `handleBackdropClick`) ignore everything while `loginOpen` — before that guard (fixed 2026-09-16), a click on the empty panel outside the card band's y-range reversed the deck behind the panel. See [[Known-Issues]].

## Open questions
- **Mobile:** there's no Log In control on mobile, so no trigger there.
- When closed, the panel is only translated off-screen — its Close button is still keyboard-focusable (no `inert` / `aria-hidden`).
- The pattern's optional video pause during the recess is not implemented.
- The scale wrapper (`transform`) makes the dev-only `fixed` "Edit grid" button position relative to the wrapper.

## Related
[[Patterns-landing-mc-recess-deck]] · [[FEAT-landing-header-nav]] · [[FEAT-landing-deck-carousel]]
