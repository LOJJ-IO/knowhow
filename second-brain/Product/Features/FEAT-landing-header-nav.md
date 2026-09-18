---
type: feature
status: in-progress
tags: [area/frontend, priority/high]
created: 2026-09-11
updated: 2026-09-17
related: ["[[Current-Context]]", "[[0004-landing-only-purge-old-app]]", "[[FEAT-landing-deck-carousel]]"]
---

# FEAT: Landing header actions

## Status
`in-progress`

## Problem
Desktop landing header needed Log in and Book a Demo alongside Get Started.

## Solution
**Copy (2026-09-17, user):** middle button renamed **Talk to Sales → Book a Demo** (`DESKTOP_HEADER_EXTRAS`, key `demo`); goo handoff unchanged, verified in-browser.

Desktop top bar (md+): **Logo** on the left; **Log in → Book a Demo → Get Started** grouped on the right (tight `gap-2`). Shared `CTA_CLASS` (scaled −20% then **+10%**: `h-[47.896px]`, `min-w-[134.112px]`; **`font-bold`**). Sliding Home/Features/Contact tabs were tried then **removed** (2026-09-11). Copy: **Book a Demo** replaced earlier **Book a demo** (2026-09-12).

## Out of scope
- Mobile header actions (logo + bottom Get Started only until asked)
- Real auth / sales destinations for Log in and Book a Demo
- Primary nav tabs (removed)

## UI/UX
- Log in + Book a Demo + Get Started: same black-pill chrome/size. Click sounds removed 2026-09-16.
- Desktop only for Log in / Book a Demo

## Technical approach
- Buttons in `src/components/brand/landing-hero.tsx` using shared `CTA_CLASS`

## Open questions
- Log in / Book a Demo wire-up (routes, modals, calendars)?
- Mobile treatment for Log in / Book a Demo?

## Related
[[Current-Context]] · [[FEAT-landing-deck-carousel]]
