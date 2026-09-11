---
type: feature
status: in-progress
tags: [area/frontend, landing, motion]
created: 2026-09-10
updated: 2026-09-11
related: ["[[Current-Context]]", "[[Lessons-Learned]]", "[[Known-Issues]]"]
---

# FEAT: Landing deck carousel (split-CTA arrows)

## Status
`in-progress` — desktop shipped 2026-09-10; mobile behaviour awaiting user decision.

## Problem
After Get Started, the CTA divides into ← → circles over a painted-mat deck. Circles were inert (and unclickable — see [[Known-Issues]]); desktop now drives a looping carousel.

## Solution
**Desktop**, user-specified choreography for ← (→ mirrors it): the left card moves away, *then* the centre card takes the left slot, *then* the right card takes the centre, *then* the card beyond the right fills the right slot. The deck is a **four-card ring** — green / blue / red / yellow — with three visible slots (−1/0/+1) and one parked at +2. Yellow starts off-stage and enters on the first ← (mirrored for →).

Motion (all on-screen moves share one spring, stiffness 120 / damping 20, ζ≈0.91, ~0.6s to rest, 0.07% overshoot):

| t after click | card | move |
|---|---|---|
| 0ms | leading side card | thrown off the leading edge |
| 70ms | centre | → leading side slot (drops `--deck-side-drop`) |
| 140ms | trailing side card | → centre (rises) |
| ≥340ms | next ring card | slides into the trailing slot from off-stage — last beat |

Each click also plays the existing Get Started click sound (mobile circles too).

### Closing (2026-09-11, user-specified)
Clicking outside the card band or the logo cluster reverses the Get Started animation. Implemented as the entrance played backwards with time-reversed curves: CTA pieces (arrows + Log in / Book a demo) flow back into the pill while the visible cards fold under the centre card (1331ms) → the pill holds while the deck sinks and logo/subhead un-shrink (700ms) → arrows fade (280ms) → Get Started label returns (220ms). Keep zones: any `button`/`a`, the header CTA row (`[data-cta-row]`), the logo lockup, and the vertical band spanned by the visible cards (+ Features label / Cover Flow bar). A pointer that moves >6px between down and up (a drag) never closes. After closing, the ring resets so the next open replays the standard entrance (green / blue / red). Centre card keeps the top layer throughout the fold (z bias). Spinner is not replayed (it's a loading beat).

### Header extras (2026-09-11, user-specified)
Desktop "Log in" and "Book a demo" stay hidden (layout slot reserved, `visibility: hidden`) until the split; liquid copies start as the whole pill and stream into the measured slots, labels fade in on arrival, then the real buttons take over with zero offset. Group `filterPadding` is raised to 400px while they travel (goo is only drawn near the group box).

### "Features" label (2026-09-11, user-specified)
Above the middle card, desktop only. Same rendered size as "Take Control of your" when open (`DESKTOP_SUBHEAD_FONT_SIZE × --logo-shrink`), Söhne, `tracking-tight`, `#1c1917`; anchored to the centre card's top edge in deck coordinates and counter-scaled by `--deck-fit`. Gap above the card: 0.5em (not specified by the user — adjustable).

## Out of scope
- Mobile: circles still call the pre-existing `focusDeckSide` (Cover Flow index 0 / last) — open question below.
- Card content; side-slot scaling.

## UI/UX
Desktop side slots are the **same size** as the centre (pushed out ±`--deck-side-x`, dropped 5vh), so the centre card does not literally shrink when it moves aside — it recedes behind the viewport edge. If a visible shrink is wanted, that's a side-slot scale decision for the user.

## Technical approach
`DesktopDeck` in `landing-hero.tsx`. The CSS entrance (`t-deck-rise` / `t-deck-spread-*`) is untouched for green/blue/red; yellow parks at slot +2 via CSS until seating. When the CTA reaches `controls` the deck is *seated*: the CSS animation is dropped and each card's transform is written from a framer-motion `motionValue` in **slot units** (`mod(i − offset, N) − 1`, so N=4 yields −1/0/+1/+2) via `deckTransform()`, which reproduces the entrance's final keyframes exactly at whole slots (zero movement at handoff, verified). Layering = distance from centre. Rotation state is a ring offset; the leading card wraps via an off-screen `jump()`. Interruptible: in-flight cards retarget immediately with their velocity. Details and the traps hit along the way: [[Lessons-Learned]] (2026-09-10 deck entries).

Verified in Playwright at 1440 and 1024 wide (three-card build): ←, →, ←←← at 110ms, ← then → at 150ms — every layer swap at 0px overlap, zero on-screen teleports, exact landing in slots, no page errors. Re-verify after the yellow fourth card if choreography drifts.

## Open questions
- **Mobile "Features" label** — not added (request was made while looking at desktop).
- **Keyboard close** — click-outside has no keyboard equivalent (e.g. Escape); not requested.
- **Mobile:** should the circles drive the Cover Flow with the same semantics (← sends cards left = shows the next card)? That's the opposite direction of the Cover Flow's own ‹ button, and the Cover Flow doesn't loop — so it's a real choice: loop Cover Flow + same semantics, keep the current focus behaviour, or hide the Cover Flow's own arrows.
- **aria-labels:** circles are labelled "Show left card" / "Show right card" (user-set), accurate for the mobile focus behaviour but not for desktop, where ← brings the *right* card to centre.

## Related
[[Current-Context]] · [[Known-Issues]] · [[Lessons-Learned]]
