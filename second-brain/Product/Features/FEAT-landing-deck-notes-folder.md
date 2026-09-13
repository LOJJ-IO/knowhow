---
type: feature
status: shipped
tags: [area/frontend, landing, priority/high]
created: 2026-09-12
updated: 2026-09-12
related: ["[[FEAT-landing-deck-carousel]]", "[[Current-Context]]"]
---

# FEAT: Deck desktop Notes folder

## Status
`shipped` (2026-09-12) — UI shell; main feature window body still empty pending product animation.

## Problem
Painted mats + a single empty mac window did not read clearly as a desktop. Needed a Finder-style affordance that peeks wallpaper and explains each feature.

## Solution
- Main feature window defaults to `{ x: 5.1, y: 8.9, w: 80.4, h: 79.8 }` (reference layout).
- **Notes** folder top-right `{ x: 86, y: 3 }`. Hover plate **4px** top / **10px** sides / **4.862px** bottom (+5% ×4 from 4px), radius **7.35px** (+5%). Card outer radius **10.5px** (+5%).
- Notes window bottom-right `{ x: 57.7, y: 63.5, w: 39, h: 28 }`. Resize floor (`MIN_WINDOW_W_PCT` / `MIN_WINDOW_H_PCT`): width **35.1%** (39 −10%, 2026-09-12 per user), height **28%**. Applies to every inset window; Notes still opens at 39% wide.
- Body copy = proposal **Why It’s Good** per feature; Org-Chart uses agreed Option A.

## Out of scope
- Animated “someone using the product” inside the main window
- Real Notes app chrome beyond title + copy

## UI/UX
Folder default `left: 86%` / `top: 3%`. Plate pad `4px 10px 4.862px`, radius `7.35px`. Card radius `10.5px`.

## Technical approach
`NotesFolder` + `InteractiveMacWindow` in `landing-hero.tsx`; styles in `globals.css` (`.t-deck-folder*`, `.t-deck-dot-x`, `.t-deck-notes-copy`). `DECK_CARDS[].note` holds copy. Window shell must **not** `stopPropagation` in the capture phase — that blocked title-bar / resize `pointerdown` (fixed 2026-09-12). **Side-slot swipe** uses `onClickCapture` on the card so wallpaper, window, and folder all step the carousel; centre slot never steps. Folder click **toggles** Notes open/closed (no close X on the Notes window — decorative traffic lights only). Folder + footer stubs share CTA press (`active:scale-95`, 150ms) + click sound.

## Open questions
- None

## Related
[[FEAT-landing-deck-carousel]] · [[Current-Context]]
