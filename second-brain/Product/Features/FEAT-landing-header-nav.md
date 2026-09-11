---
type: feature
status: in-progress
tags: [area/frontend, priority/high]
created: 2026-09-11
updated: 2026-09-11
related: ["[[Current-Context]]", "[[0004-landing-only-purge-old-app]]", "[[FEAT-landing-deck-carousel]]"]
---

# FEAT: Landing header actions

## Status
`in-progress`

## Problem
Desktop landing header needed Log in and Book a demo alongside Get Started.

## Solution
Desktop top bar (md+): **Logo** on the left; **Log in → Book a demo → Get Started** grouped on the right (tight `gap-2`). Shared `CTA_CLASS` (scaled −20% from the original Get Started lock: `h-[43.542px]`, `min-w-[121.92px]`). Sliding Home/Features/Contact tabs were tried then **removed** (2026-09-11).

## Out of scope
- Mobile header actions (logo + bottom Get Started only until asked)
- Real auth / booking destinations for Log in and Book a demo
- Primary nav tabs (removed)

## UI/UX
- Log in + Book a demo + Get Started: same black-pill chrome/size
- Desktop only for Log in / Book a demo

## Technical approach
- Buttons in `src/components/brand/landing-hero.tsx` using shared `CTA_CLASS`

## Open questions
- Log in / Book a demo wire-up (routes, modals, calendars)?
- Mobile treatment for Log in / Book a demo?

## Related
[[Current-Context]] · [[FEAT-landing-deck-carousel]]
