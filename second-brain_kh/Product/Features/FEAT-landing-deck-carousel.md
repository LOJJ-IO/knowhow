---
type: feature
status: in-progress
tags: [area/frontend, landing, motion]
created: 2026-09-10
updated: 2026-09-17
related: ["[[Current-Context]]", "[[Lessons-Learned]]", "[[Known-Issues]]", "[[FEAT-landing-deck-notes-folder]]"]
---

# FEAT: Landing deck carousel (split-CTA arrows)

## Status
`in-progress` — desktop shipped 2026-09-10; mobile Cover Flow reworked 2026-09-14 (landscape cards, swipe, own nav bar removed) — see below. The reported CTA-split "twitch" is fixed (2026-09-14), not yet re-verified on the phone that showed it. **2026-09-15:** mobile arrows fixed to step one card at a time (were jumping to the first/last card — leftover `focusDeckSide` from before the nav-bar-removal made them the only navigation); titlebar + traffic dots on mobile cards made slimmer/smaller per user request.

## Problem
After Get Started, the CTA divides into ← → circles over a painted-mat deck. Circles were inert (and unclickable — see [[Known-Issues]]); desktop now drives a looping carousel.

## Solution
**Desktop.** ~~Originally ← sent the cards left~~ — **inverted per user 2026-09-11: ← brings the left card to the centre** (cards travel right): the right card moves away, *then* the centre card takes the right slot, *then* the left card takes the centre, *then* the card beyond the left fills the left slot; → mirrors. Same cascade/physics as specified originally, just mirrored. Clicking the card in the left/right slot does exactly what that arrow does (a pointer that moves >6px — a window drag — never counts); the centre card isn't a control. The deck is a **seven-card feature ring** (2026-09-12) — Unified Workspace / Auto-Own / Auto-Share / Oversight / DeepSearch / Org-Chart & Permissions / Instant Offboard — with three visible slots (−1/0/+1) and the rest parked further off-stage. Mats cycle green / blue / red / yellow. First three rise/spread; park seats use `--deck-park-slot` until seating. Each mac title bar shows that card's feature name (centred, light-mode muted stone on `#d1cfcc`). **Notes folder** (2026-09-12): narrower main window + Finder-style **Notes** icon on the wallpaper; click opens a smaller Notes window with Why-It’s-Good copy — [[FEAT-landing-deck-notes-folder]].

Motion (all on-screen moves share one spring, stiffness 120 / damping 20, ζ≈0.91, ~0.6s to rest, 0.07% overshoot):

| t after click | card | move |
|---|---|---|
| 0ms | leading side card | thrown off the leading edge |
| 70ms | centre | → leading side slot (drops `--deck-side-drop`) |
| 140ms | trailing side card | → centre (rises) |
| ≥340ms | next ring card | slides into the trailing slot from off-stage — last beat |

Each click also plays the existing Get Started click sound (mobile circles too).

### Closing (2026-09-11, user-specified)
Clicking outside the card band or the logo cluster reverses the Get Started animation. Implemented as the entrance played backwards with time-reversed curves: CTA pieces (arrows + Log in / Book a Demo) flow back into the pill while the visible cards fold under the centre card (1331ms) → the pill holds while the deck sinks and logo/subhead un-shrink (700ms) → arrows fade (280ms) → Get Started label returns (220ms). Keep zones: any `button`/`a`, the header CTA row (`[data-cta-row]`), the logo lockup, and the vertical band spanned by the visible cards (+ Features label / Cover Flow bar). A pointer that moves >6px between down and up (a drag) never closes. After closing, the ring resets so the next open replays the standard entrance (first three features). Centre card keeps the top layer throughout the fold (z bias). Spinner is not replayed (it's a loading beat).

### Header extras (2026-09-11, user-specified)
Desktop "Log in" and "Book a Demo" stay hidden (layout slot reserved, `visibility: hidden`) until the split; liquid copies start as the whole pill and stream into the measured slots, labels fade in on arrival, then the real buttons take over with zero offset. Group `filterPadding` is raised to 400px while they travel (goo is only drawn near the group box).

### "Features" label (2026-09-11, user-specified)
Above the middle card, desktop only. Same rendered size as "Take Control of your" when open (`DESKTOP_SUBHEAD_FONT_SIZE × --logo-shrink`), Söhne, `tracking-tight`, `#1c1917`; anchored to the centre card's top edge in deck coordinates and counter-scaled by `--deck-fit`. Gap above the card: 0.5em (not specified by the user — adjustable).

### Press feedback (2026-09-11)
The arrow circles press in exactly like the other header buttons (`active:scale-95`, 150ms, Tailwind's default curve). Their split position moved from `transform` to the `translate` property: CSS composes `translate` → `scale` → `transform`, so a `scale` press on a `transform`-positioned element pulls it toward its untransformed box (the ← circle slid ~2.4px). Chevrons live in a separate layer, so they follow their circle's `:active` via `group-has-[[data-step=…]:active]/cta:scale-95`. Verified: ×0.950, centre moves 0.00px, same as Log in.

## Out of scope
- Card content; side-slot scaling.

## Mobile (2026-09-14 → 2026-09-15, user-specified)
- **Landscape cards, not portrait.** `.t-deck-cover-item` is `aspect-ratio: 16/9` (was `9/19.5`), same style as desktop's mac windows, just smaller and inset with visible gutters (`width: min(72vw, 21rem)`; was `82vw/26rem` right after the portrait→landscape switch, resized 2026-09-15 to match a user-supplied reference screenshot's proportions) — replaces the old phone-shaped Cover Flow card. 3D coverflow peek on the neighbouring cards kept (explicit user call, even though the reference had none).
- **Content scales with the card.** `.t-deck-cover-item` is a CSS container (`container-type: inline-size`); titlebar height, traffic-dot size, and title font-size are `cqw`-based inside it, so they shrink with the (much shorter, 16:9 vs 9:19.5) card instead of keeping desktop's fixed px/rem sizes. **2026-09-15:** titlebar/dots sized down further per user request (`--deck-titlebar-h: 6.5cqw`, `--deck-dot: 1.7cqw`; were `10cqw`/`2.6cqw`).
- **Own nav bar removed.** `DeckCoverFlow` no longer renders `.t-deck-cover-nav` (the dark pill with its own ‹ › + dot row) — the split Get Started ← → circles (`stepMobileDeck`) are the only explicit navigation now, plus swipe. Dead CSS removed; `isDeckKeepZone`'s click-outside selector no longer references it.
- **Arrow stepping (bug, fixed 2026-09-15).** Once the nav bar was removed, `stepMobileDeck` was still calling the *original* `focusDeckSide`, a leftover from when the arrows only had to jump Cover Flow to the very first/last card (its own ‹ › handled single-step, back when both existed). With no other control left, that made ← / → jump straight to the ends instead of moving one card — not caught earlier because nothing had exercised arrow-only navigation end-to-end. Fixed: `stepMobileDeck` now moves `activeIndex` ±1 clamped to `[0, DECK_CARDS.length - 1]`, mirroring the swipe/tap-select logic already in `DeckCoverFlow`; `focusDeckSide` deleted.
- **Swipe.** `DeckCoverFlow`'s stage tracks a pointer gesture and steps `activeIndex` ±1 past a 40px, more-horizontal-than-vertical threshold (short/vertical drags still tap-select whichever card the pointer landed on, via `data-cover-index`). **Trap:** this has to be `onPointerDownCapture`/`onPointerUpCapture`, not the bubble-phase `onPointerDown`/`onPointerUp` — `InteractiveMacWindow`'s shell calls `e.stopPropagation()` on its own `onPointerDown` (so a tap inside the window isn't misread elsewhere), and since a window fills ~80% of the card, a bubble listener on the stage almost never saw the down event. Same reason `DesktopDeck`'s own `onCardStep` already uses capture — verified with a native `addEventListener` on the stage next to the React handler: the native listener fired, the React bubble handler never did, until switched to capture. A down that starts on a titlebar, the Notes folder, or a resize handle is explicitly excluded from starting a swipe (`closest(".t-deck-titlebar, .t-deck-folder, .t-deck-resize")`) so window-drag and folder-tap don't fight it.
- **Windows are move-only.** `.t-deck-resize` is `display: none` under `max-width: 767px` (CSS-only — no React prop threading needed since `InteractiveMacWindow` is shared with desktop). Title-bar drag is untouched.
- **Notes shows inline, automatically** — no dialog, no tap — in a panel below the stage; see [[FEAT-landing-deck-notes-folder]] (superseded a same-week bottom-sheet iteration).

## UI/UX
Desktop side slots are the **same size** as the centre (pushed out ±`--deck-side-x`, dropped 5vh), so the centre card does not literally shrink when it moves aside — it recedes behind the viewport edge. If a visible shrink is wanted, that's a side-slot scale decision for the user.

## Technical approach
`DesktopDeck` in `landing-hero.tsx`. The CSS entrance (`t-deck-rise` / `t-deck-spread-*`) is untouched for the first three cards; remaining cards park via `.t-deck-card--park` + `--deck-park-slot` until seating. When the CTA reaches `controls` the deck is *seated*: the CSS animation is dropped and each card's transform is written from a framer-motion `motionValue` in **slot units** (`mod(i − offset, N) − 1`, N=7) via `deckTransform()`, which reproduces the entrance's final keyframes exactly at whole slots (zero movement at handoff, verified). Layering = distance from centre. Rotation state is a ring offset; the leading card wraps via an off-screen `jump()`. Interruptible: in-flight cards retarget immediately with their velocity. Details and the traps hit along the way: [[Lessons-Learned]] (2026-09-10 deck entries).

Verified in Playwright at 1440 and 1024 wide (three-card build): ←, →, ←←← at 110ms, ← then → at 150ms — every layer swap at 0px overlap, zero on-screen teleports, exact landing in slots, no page errors. Re-verify after the seven-card feature ring if choreography drifts.

## Open questions
- **Mobile "Features" label** — not added (request was made while looking at desktop).
- **Keyboard close** — click-outside has no keyboard equivalent (e.g. Escape); not requested.
- ~~**CTA-split "twitch"**~~ — resolved 2026-09-14, full root-cause writeup in [[Known-Issues]]. Short version: the split daughters centred via a live `translate: calc(-50% + Npx)`, which resolves against the element's own currently-animating `width` every frame — fragile under a forced reflow, confirmed real-phone-only (e.g. Safari's address bar collapsing mid-gesture), never reproducible in headless Chromium since nothing there forces that reflow. Fixed by pinning the un-spread width as a fixed px custom property and writing both `translate` endpoints as literal px instead of `%`.
- ~~**Mobile nav semantics**~~ — resolved 2026-09-14 per user: removed the Cover Flow's own nav bar entirely; the split CTA arrows are the only navigation (see Mobile section above).
- ~~**aria-labels** mismatch on desktop~~ — resolved by the 2026-09-11 inversion: "Show left card" / "Show right card" are now accurate on both viewports.

## Related
[[Current-Context]] · [[Known-Issues]] · [[Lessons-Learned]]
