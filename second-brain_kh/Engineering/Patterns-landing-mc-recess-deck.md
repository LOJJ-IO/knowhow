---
type: pattern
status: archived
tags: [area/frontend, pattern/motion]
created: 2026-09-10
updated: 2026-09-10
related: ["[[Current-Context]]", "[[Lessons-Learned]]"]
---

# Pattern — Landing Mission Control recess + lagged hex deck

Archived 2026-09-10 when the post-spinner handoff changed. Keep as a reusable motion reference; not the live `/` behavior.

## Beat (as last tuned)

1. Get Started → sound + spinner **400ms**.
2. Freeze spinner icon (stop `animate-spin`), pause video, swap to poster for perf.
3. Synced open (~900ms):
   - **Hero** (`.t-hero-melt`): `scale(0.9)` only — no `filter` on the video tree.
   - **Veil** (`.t-hero-veil`): plain dim fade (`rgb(28 25 23 / 0.35)`), **no** `backdrop-filter`.
   - **Deck** (`.t-deck`): three empty cards in hex colors — left `#34A853`, center `#4285F4`, right `#EA4335`.
4. Center card leads from below with transform transition.
5. Side cards lag **~420ms**, then **one** ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`) into the same vertical baseline (no low-step “correction” — that read as a janky self-fix).

## Why it felt good

- Recessing the first screen (scale + dim) while new content entered felt Mission Control–like.
- Avoiding `filter: blur()` / `backdrop-filter` on the live hero kept the glide smooth.
- Side lag without a second vertical “fix” phase avoided the enter-then-snap feel.

## Key CSS knobs (were in `globals.css`)

- `--hero-melt-scale`, `--panel-open-dur`, `--hero-ease`
- `--deck-card-h`, `--deck-center-w`, `--deck-side-w`, `--deck-side-x`, `--deck-podium-y`
- `--deck-side-delay`, `--deck-side-dur`

## Recover

Search git history around 2026-09-10 for `.t-hero-melt` / `.t-deck` / `.t-hero-veil` before the “bg fade + logo shrink + middle band” rewrite.
