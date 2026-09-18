---
type: feature
status: in-progress
tags: [area/frontend, auth]
created: 2026-09-16
updated: 2026-09-16
related: ["[[Current-Context]]", "[[Patterns-landing-mc-recess-deck]]", "[[FEAT-landing-header-nav]]", "[[FEAT-landing-deck-carousel]]"]
---

# FEAT: Landing Log In panel

## Status
`in-progress` — animation shipped 2026-09-16; panel content not yet specified.

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
- **Logo (2026-09-16):** "Proudly from Edmonton" (`public/hero/edmonton.png`, alt text set) at the panel's bottom left (`bottom-6 left-6`, `z-10`, `pointer-events-none`), `h-8` / `md:h-10`. The source had faint near-zero-alpha pixels across the whole canvas, so a plain `getbbox()` crop barely trimmed it — cropped to alpha > 8 instead (1557×399) so the artwork reaches the file edges and the 24px inset is the real inset.

## Out of scope
- Panel content — still empty. **Decided 2026-09-17:** it will host the sign-in + onboarding screens from [[FEAT-workspace-onboarding-flow]]; contents built only as the user specifies.
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
