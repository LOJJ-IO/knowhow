---
type: feature
status: in-progress
tags: [area/frontend, priority/high]
created: 2026-09-11
updated: 2026-09-12
related: ["[[Current-Context]]", "[[0004-landing-only-purge-old-app]]", "[[FEAT-landing-deck-carousel]]"]
---

# FEAT: Landing header actions

## Status
`in-progress`

## Problem
Desktop landing header needed Log in and Talk to sales alongside Get Started.

## Solution
Desktop top bar (md+): **Logo** on the left; **Log in → Talk to sales → Get Started** grouped on the right (tight `gap-2`). Shared `CTA_CLASS` (scaled −20% then **+10%**: `h-[47.896px]`, `min-w-[134.112px]`). Sliding Home/Features/Contact tabs were tried then **removed** (2026-09-11). Copy: **Talk to sales** replaced earlier **Book a demo** (2026-09-12).

## Out of scope
- Mobile header actions (logo + bottom Get Started only until asked)
- Real auth / sales destinations for Log in and Talk to sales
- Primary nav tabs (removed)

## UI/UX
- Log in + Talk to sales + Get Started: same black-pill chrome/size
- Desktop only for Log in / Talk to sales

## Technical approach
- Buttons in `src/components/brand/landing-hero.tsx` using shared `CTA_CLASS`

## Open questions
- Log in / Talk to sales wire-up (routes, modals, calendars)?
- Mobile treatment for Log in / Talk to sales?

## Related
[[Current-Context]] · [[FEAT-landing-deck-carousel]]
