---
type: feature
status: shipped
tags: [area/frontend, landing, priority/high]
created: 2026-09-12
updated: 2026-09-17
related: ["[[FEAT-landing-deck-carousel]]", "[[Current-Context]]"]
---

# FEAT: Deck desktop Notes folder

## Status
`shipped` (2026-09-12) — UI shell; main feature window body still empty pending product animation. **2026-09-14:** mobile got a bottom-sheet dialog, superseded same day — see below. **2026-09-15 (current):** mobile shows the active card's note inline, always-visible, in a panel stacked below the Cover Flow stage — no tap needed, no dialog at all on mobile.

## Problem
Painted mats + a single empty mac window did not read clearly as a desktop. Needed a Finder-style affordance that peeks wallpaper and explains each feature.

## Solution
- Main feature window defaults to `{ x: 5.1, y: 8.9, w: 80.4, h: 79.8 }` (reference layout).
- **Notes** folder top-right `{ x: 86, y: 3 }`. Hover plate **4px** top / **10px** sides / **4.862px** bottom (+5% ×4 from 4px), radius **7.35px** (+5%). Card outer radius **10.5px** (+5%).
- Notes window bottom-right `{ x: 61.7, y: 66, w: 35.1, h: 28 }` — position measured from the user's reference screenshot (2026-09-12; right edge 96.8%, bottom 94%) — opens at the resize floor (`MIN_WINDOW_W_PCT` / `MIN_WINDOW_H_PCT`): width **35.1%** (39 −10%, 2026-09-12 per user), height **28%**. Floor applies to every inset window.
- Body copy = proposal **Why It’s Good** per feature; Org-Chart uses agreed Option A.

## Out of scope
- Animated “someone using the product” inside the main window
- Real Notes app chrome beyond title + copy

## UI/UX
Folder default `left: 86%` / `top: 3%`. Plate pad `4px 10px 4.862px`, radius `7.35px`. Card radius `10.5px`.

## Technical approach
`NotesFolder` + `InteractiveMacWindow` in `landing-hero.tsx`; styles in `globals.css` (`.t-deck-folder*`, `.t-deck-dot-x`, `.t-deck-notes-copy`). `DECK_CARDS[].note` holds copy. Window shell must **not** `stopPropagation` in the capture phase — that blocked title-bar / resize `pointerdown` (fixed 2026-09-12). **Side-slot swipe** uses `onClickCapture` on the card so wallpaper, window, and folder all step the carousel; centre slot never steps. Notes window **starts open** on every desktop card (2026-09-17, user: "by default the notes modal should be open" — `useState(true)` in `DeckWindow`); folder click **toggles** it closed/open (no close X on the Notes window — decorative traffic lights only). Folder + footer stubs share CTA press (`active:scale-95`, 150ms) (click sound removed 2026-09-16).

**2026-09-14 — mobile Notes as a bottom sheet (superseded 2026-09-15):** `NotesFolder` rendered both a desktop `InteractiveMacWindow` (`hidden md:contents`) and a mobile `NotesSheet` (fixed backdrop + `translateY` rise-in panel, portaled to `document.body` via `createPortal`, since `.t-deck-cover-item`'s framer-motion `transform` would otherwise become the containing block for a `position: fixed` descendant and clip it inside `.t-deck-card`'s `overflow: hidden`). Cascade trap: the sheet's own `.t-deck-notes-sheet { display: flex }` (this file, after Tailwind's `@import`) beat a `md:hidden` Tailwind class on the same element at equal specificity — fixed with an explicit `@media (min-width: 768px)` override rather than relying on the utility class. **General rule kept for future work:** a custom CSS rule and a Tailwind utility touching the same property on the same element are a latent bug regardless of which "should" win by convention.

**2026-09-15 — replaced with an always-visible inline panel:** per user direction (working from a reference screenshot of a differently-styled site, for proportions only), the demo workspace on mobile now sits smaller and inset (`min(72vw, 21rem)`, was `min(82vw, 26rem)` — visible gutters either side, like a framed screenshot rather than edge-to-edge) with the 3D coverflow peek on neighbouring cards kept (explicit user call — the reference had no peeking cards, but the user chose to keep the effect over matching that exactly). The Notes folder icon is now **desktop-only** (`.t-deck-cover-item .t-deck-folder { display: none }`); on mobile, `DeckCoverFlow` renders a plain content-flow panel (`.t-deck-cover-notes`) directly below the stage showing `DECK_CARDS[activeIndex]`'s title + note — no dialog, no tap, updates automatically as the user swipes or taps a side card. `NotesSheet` and its CSS were deleted (dead code once nothing rendered it). The arrow buttons (split Get Started circles) are unchanged — separate from this panel, still the primary explicit way to change feature.

## Open questions
- None

## Related
[[FEAT-landing-deck-carousel]] · [[Current-Context]]
