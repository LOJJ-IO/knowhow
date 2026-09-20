---
type: feature
status: in-progress
tags: [area/frontend, auth]
created: 2026-09-16
updated: 2026-09-20
related: ["[[Current-Context]]", "[[Patterns-landing-mc-recess-deck]]", "[[FEAT-landing-header-nav]]", "[[FEAT-landing-deck-carousel]]"]
---

# FEAT: Landing Log In panel

## Status
`in-progress` — animation shipped 2026-09-16; centred modal added 2026-09-17 with the first sign-in screen (heading, subtext, Continue with Google — button inert). **2026-09-18:** Continue with Google wired — full-page redirect to the backend's `/onboarding/signup` ([[0008-continue-with-google-via-backend]]). **Later 2026-09-18 — org setup in the panel (happy path):** on load the landing calls the backend's `/auth/me` (`credentials: "include"`); if `needs_org_setup`, the sheet opens with kind `"setup"` → `OrgSetupForm`: "Are you the owner / top of the organization?" (Yes / No → "Owner’s work email" + Continue) → "Are you a Google Workspace Super Admin?" (Yes / No / I don’t know) → `POST /organizations/{id}/org-chart`. **Copy is the spec's wording, a placeholder until the user designs these screens** (user chose "spec wording for now"). Visuals reuse the Continue with Google button (choices) and the demo form's input / error / Continue pill. After submit the modal is **empty — the done screen is waiting for the user's description.** **Result screens (2026-09-18, placeholder copy by user's choice):** after a Google round trip the backend's URL result (`?admin_proof=verified|not_verified|error`, `?signup=personal`, `?invite=wrong_account`) reopens the sheet as kind `"result"` → `SignInResultPanel`, then the param is cleared from the URL. Personal: "Does your company use Google Workspace?" → "Yes — use my work account" (account chooser) / "No — just me" (creates the personal org). Not verified: message + **Skip for now** only (one-action rule). Error: Try again. Wrong account: Use another account. Arriving with `?invite=<token>` opens Log In and Continue with Google carries the token. Backend errors shown via `backendError()` (FastAPI 422 `detail` is a list — it rendered as `[object Object]` before). Verified headless for every result. Verified headless (throwaway user, cleaned up): 200 on submit, `/auth/me` → approved + owner, sheet doesn't reopen on reload, no console errors.

## Problem
Clicking "Log In" did nothing. User asked for the [[Patterns-landing-mc-recess-deck]] recess, with a full-page slide-up (a bottom sheet the full height of the page, not a small one).

## Solution
Clicking **Log In** in the desktop header (`DESKTOP_HEADER_EXTRAS`, via `GetStartedCta`'s `onExtraClick`) sets `loginOpen`:
- Everything on the landing (video, header, subhead, open deck) sits in one wrapper that scales to `0.9`.
- A veil (`rgb(28 25 23 / 0.35)`, `z-[300]`) fades in over it.
- A full-width `h-dvh` panel (`z-[400]`) — background `public/hero/signinbg.png` (city skyline at dusk, `bg-cover bg-center`, white while it loads; added 2026-09-16) — corner radius `var(--deck-window-radius)` (10.5px, same as the feature cards) while it travels, eased to square once it reaches the top (`loginAtTop`, set on the panel's own `translate` `transitionend`; cleared on Close so it slides down rounded) — slides from `translate-y-full` to `0`.
- **Sky (2026-09-16, per user "add stars and shooting stars"):** `LoginSky` layer over the image — 90 seeded (hydration-safe) white stars in the top 52% where the image is dark blue, denser/brighter higher up, each twinkling on its own 2.5–6.5s loop; 3 shooting-star streaks (bright head, fading tail, ~25° down-right, ~360px run) on 7/11/13s loops, visible ~8% of each. CSS in `globals.css` (`.t-login-star`, `.t-login-shooting-star`); animations paused unless the panel is open (`data-active`); reduced motion → static stars, no shooting stars.
- Panel slide **992ms** (900ms +5% → 945ms, then +5% again → 992ms, 2026-09-16); recess + veil still `900ms`. **Easing (2026-09-17, user: "same bounce the modal uses, it feels a bit choppy"):** the panel now uses `var(--resize-ease)` = `cubic-bezier(0.22, 1, 0.36, 1)` (the modal's `.t-resize` curve); recess + veil keep the pattern's `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Hero video pauses while the sheet is open (2026-09-17, user's pick "Pause on Log In"):** `useEffect` on `loginOpen` → `videoRef.pause()` / `play()` on Close. The choppiness was mostly the video decoding under the recess scale: during the slide, headless (CPU) Chromium fell from 60 to ~25fps; hiding the video → ~48. With GPU enabled the slide runs at 60fps. No `filter` / `backdrop-filter`.
- A "Close" button (top right) reverses it — same pill as the header CTAs (`CTA_CLASS`, Satoshi bold, `bg-black/80`, `active:scale-95`; 2026-09-16, was a small underlined text link).
- **Sign-in modal (2026-09-17, user: "a modal in the center but the text and what it's asking for are unknown"):** `LoginModal` centred in the panel (absolute `inset-0` flex centre, `z-10`; wrapper `pointer-events-none`, so Close stays clickable). **Empty** — no copy, fields or buttons until the user specifies them. Surface matches the mobile Notes panel (`.t-deck-cover-notes`, user's pick): `#fbfaf8`, 1px `rgb(0 0 0 / 0.08)` border, 14px radius, `0 8px 20px rgb(0 0 0 / 0.12)` shadow, padding `0.85rem 1.1rem 1rem` (on `.t-login-modal-body`). Width `min(420px, 100% - 32px)`; height follows content (user's pick: fixed width, content height) — empty it's 32px (padding + border).
  - **Smooth resize (user-supplied Transitions.dev "Card resize" CSS):** `.t-resize` + `--resize-dur: 300ms` / `--resize-ease: cubic-bezier(0.22, 1, 0.36, 1)` in `globals.css`, reduced motion → no transition. CSS can't tween `height: auto`, so `LoginModal` measures its body with a `ResizeObserver` and sets an explicit px height on the shell (`overflow: hidden`); `.t-resize` tweens that. Verified: injecting 240px of content eases 32 → 272px over ~300ms; removing it eases back.
- **Sign-in content (2026-09-17, from a user-supplied Canva screenshot, "Canva" removed; answers via question tool):**
  - **Closed = thin line:** `LoginModal open={loginAtTop}` — until the panel reaches the top the shell's height is its border only (2px), so it reads as a white line; then it grows to the measured content height with `.t-resize` (user picked their own curve, no overshoot). On Close `loginAtTop` clears, so it collapses back while the panel slides down. Content is always laid out — the growing edge reveals it (no fade).
  - **Copy:** h2 "Log in or sign up in seconds"; p "Use your Google account to continue with Knohow." ("(it's free)!" removed 2026-09-17; Google-only per [[FEAT-workspace-onboarding-flow]], no email path); button "Continue with Google" with the multicolour Google G (`GoogleG` SVG, 20px, 13px from the left edge, text centred).
  - **Type:** heading + subtext Söhne (only weight in tree is Dreiviertelfett — user chose heavy subtext over Satoshi Regular), `1.62rem`/1.15 tracking-tight and `0.95rem`/1.6, `#1c1917`; button Satoshi bold `1rem`.
  - **Sizes matched to the reference** scaled ~0.6× to the 420px modal: button `h-12` full width, 10px radius, 1px `#d9d9de` border, white, `active:scale-[0.98]`; `mt-4` gaps. Heading fits one line at 420px (wraps on narrow widths).
  - **More portrait (2026-09-17, user: "slightly more portrait" → picked taller, same width):** body padding `0.85rem 1.1rem 1rem` → `2.5rem 1.1rem`; heading→subtext `mt-4` → `mt-6`; subtext→button `mt-4` → `mt-8`. 420×190 → **420×264** at 1470×956.
  - **Nested radius (2026-09-17, user: follow craft.gustavofior.com/nested-border-radius → "round modal more"):** button keeps `--login-button-radius: 10px`; modal = button radius + side padding (`--login-modal-pad-x: 1.1rem`) + 1px border = **28.6px** (was 14px).
  - **Terms line (2026-09-17, from a Canva reference):** under the button, `mt-6`, Satoshi `0.8rem`/1.6, `#1c1917`: "By continuing, you agree to Knohow's **Terms of Use**. Read our **Privacy Policy**." — links are `FooterStubLink` in bold (user: "like footer links"), inert until real routes. The reference's "Signing up for a business" row was **not** added — the user decided contractors enter via deep links / email links instead ([[FEAT-workspace-onboarding-flow]]).
  - **Button does nothing yet** (user's pick) — no mock sign-in until asked; no real Google call from `src/` ([[0001-mocked-data-first-prototype]]).
  - Verified at 1470×956: 2px during the 992ms slide → 190px ~300ms after arrival.
- **Logo (2026-09-16):** "Proudly from Edmonton" (`public/hero/edmonton.png`, alt text set) at the panel's bottom left (`bottom-6 left-6`, `z-10`, `pointer-events-none`), `h-8` / `md:h-10`. The source had faint near-zero-alpha pixels across the whole canvas, so a plain `getbbox()` crop barely trimmed it — cropped to alpha > 8 instead (1557×399) so the artwork reaches the file edges and the 24px inset is the real inset.

## Out of scope
- ~~What Continue with Google does~~ — redirects to `${NEXT_PUBLIC_BACKEND_API_URL}/onboarding/signup` (2026-09-18, [[0008-continue-with-google-via-backend]]); the backend sends the browser back to `/`. Every screen after it — not specified yet. The modal will host the sign-in + onboarding screens from [[FEAT-workspace-onboarding-flow]]; contents built only as the user specifies.
- Book a Demo — now opens the **same sheet** with a demo-request form: [[FEAT-landing-book-a-demo]] (2026-09-17). State renamed `loginOpen`/`loginAtTop` → `sheetOpen`/`sheetAtTop` + `sheetKind`.

## Technical approach
`LandingHero` in `landing-hero.tsx`. Log In only appears after Get Started splits, so the deck is always at `controls` while the panel is open. The landing's click-outside-closes-the-deck handlers (`handleBackdropPointerDown` / `handleBackdropClick`) ignore everything while `loginOpen` — before that guard (fixed 2026-09-16), a click on the empty panel outside the card band's y-range reversed the deck behind the panel. See [[Known-Issues]].

## Open questions
- **Mobile:** there's no Log In control on mobile, so no trigger there.
- When closed, the panel is only translated off-screen — its Close button is still keyboard-focusable (no `inert` / `aria-hidden`).

## Related
[[Patterns-landing-mc-recess-deck]] · [[FEAT-landing-header-nav]] · [[FEAT-landing-deck-carousel]]

## Account picker — "Which account today?" (2026-09-20)
Clicking **Log In** shows the accounts this browser has signed in with, instead of the plain
"Log in or sign up in seconds" screen; that screen stays as the fallback for a browser with none
(fresh, incognito, cookies cleared). User's reference was Canva's picker; the device-not-person
scoping and the `login_hint` behaviour are [[0011-device-remembered-accounts]].

- **Row = one person, not one account** (revised 2026-09-20 same day, [[0012-identity-linking-one-person-many-accounts]]).
  The name appears once; what used to be the email line is now **black chips** beside it — `Org`
  and `Personal`, each showing `(n)` from two up. Grouping is by linked identity only, never by
  name. Avatar is an initial circle (Google gives us no profile picture; tint is a deterministic
  hash, **placeholder palette**).
- **Hover a chip** → compact black tooltip listing the addresses behind it: one for `Org`, all of
  them for `Personal`. Same string on `aria-label`, and the chip is focusable, so it doesn't
  depend on hover.
- **Click a person** → signs in as them, passing their most recently used account as Google's
  `login_hint`. **There is no account picking** (user: *"account picking doesn't exist"*) — Google
  still decides who signs in.
- The earlier per-account row with the org named only on divergence was replaced by this; that
  rule is gone.
- Below: OR divider, **Continue with another account** (ordinary sign-in, keeps any `?invite=`
  token), the Terms/Privacy line, and **Remove accounts** → `DELETE /auth/remembered-accounts`,
  after which the picker gives way to the plain Log In screen.
- **Sizing:** accounts are fetched on mount, not when the sheet opens, so `LoginModal` measures
  once — the same trap the Cal embed hit ([[FEAT-landing-book-a-demo]]).
- **All copy is placeholder** pending the user's design.
- Verified in a real browser (Playwright, seeded DB + device cookie) at 1470×956.

### Tooltip primitive (2026-09-20)
`src/components/brand/tooltip.tsx` — compact black chip (12px semibold white on `bg-black`,
`px-2.5 py-1.5`, `rounded-md`, caret), portaled to `document.body`, instant open (`delay={0}`,
user's choice). Provider is scoped to the picker, not the root layout, which is a Server Component.
**Positioner must be `z-[500]`** to clear the sheet's `z-[400]` — see [[Lessons-Learned]], the
portal alone doesn't do it. Written fresh for this repo, not ported from Sage_v1 (invariant 5;
the user was asked). New dependency: `@base-ui/react`, at the user's request.
