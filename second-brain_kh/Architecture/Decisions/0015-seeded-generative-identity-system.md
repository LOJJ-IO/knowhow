---
type: decision
status: active
tags: [area/frontend, area/design]
created: 2026-09-21
updated: 2026-09-21
related: ["[[FEAT-core-app-screens]]", "[[FEAT-workspace-onboarding-flow]]", "[[0016-app-reads-the-backend-not-fixtures]]", "[[Lessons-Learned]]"]
---

# ADR-0015: Team and person identities are seeded SVG, generated in the app

## Status
`active`

## Context
Teams and people need visual identity in the app and in onboarding. Three options were on the table:

1. **An image model per team** — call a generation model when a team is created, store the result.
2. **Initials on a tinted circle** — what the Log In account picker does today (`AVATAR_TINTS`,
   marked PLACEHOLDER).
3. **A deterministic generative renderer** — hash the name to a seed, derive geometry from it, emit SVG.

The user's brief (2026-09-21) worked through a careful image-model prompt and then landed on the third
option for the product itself, keeping the prompt as a way to explore the visual language. The reasoning
that decided it: the risk with a generation model is not cost, it is **consistency** — every icon has to
look like it came from the same design system, and a model asked for "a cool team icon" returns clip-art.

## Decision
Identities are **generated in the frontend from a seeded, constrained grammar**, not by an image model
and not from initials.

- **Teams** get an abstract geometric composition: a circular container, 2–4 shapes from a fixed
  vocabulary (disc, semicircle, quarter, capsule, block, wedge, ring, arc, wave, zigzag), one dominant
  plus supporting shapes, angles from a fixed set, positions from a 3×3 grid with seeded drift.
- **People** get a gradient field instead — soft, layered radial light sources under one blur. People
  are deliberately calmer than teams: a wall of geometric compositions with faces mixed into it reads
  as noise.
- **The team's name is only ever a seed.** Nothing reads it, matches on it or means anything by it. No
  letters, initials, metaphors or industry imagery: "Engineering", "Marketing" and "Finance" draw from
  exactly the same vocabulary.
- **Colors come from one ordered palette of 12** and are chosen by *relationship* — an anchor plus
  either neighbours on the hue wheel (analogous) or the far side (complementary). Never an arbitrary
  handful.
- **Determinism is the point.** `identitySeed()` lowercases and collapses whitespace, so "Engineering"
  is the same icon forever, on the server and in the browser. No `Math.random`, no `Date`.

The distinction this encodes: **random is slop, constrained randomness is generative design.**

## Consequences
**Good.** No API cost or latency per team; perfect circles and clean edges; crisp at any size; no AI
artifacts; the same team shows the same identity in onboarding and in the app, with nothing stored.

**Costs and limits.**
- The grammar is a **versioned decision**: adding a shape to the vocabulary or reordering `PALETTE`
  changes every existing icon, because icons are derived rather than stored. If identities ever need to
  be stable across a grammar change, the seed (or the resolved composition) has to be persisted.
- A **rename changes a team's icon**, since the name is the seed. Seeding from the team's `id` instead
  would survive renames but lose the "identity appears as you type it" behaviour in setup. Not decided.
- Contrast is handled by rule (lighten on dark grounds, deepen on light ones) rather than measured per
  pair, so a seed can still land on a quiet combination.

## Alternatives considered
- **Image model per team.** Rejected for consistency, cost and latency, and because generated raster
  can't stay crisp at 32px. Kept as an exploration tool for the language, per the user's own framing.
- **Initials on a tint.** Rejected: semantic, and it fails the "no letters" rule the user set.

## Implementation
- `src/lib/identity/seed.ts` — xmur3 hash, mulberry32 PRNG, `identitySeed()`.
- `src/lib/identity/palette.ts` — the 12 colors, `harmony()`, `shade`/`tint`/`isDark`.
- `src/lib/identity/composition.ts` — the grammar: `teamComposition()`, `personGradient()`. Pure.
- `src/components/identity/team-icon.tsx`, `person-avatar.tsx` — dumb renderers. The circle is a CSS
  clip on the wrapper, so team icons need no generated SVG ids and shapes can be bitten off by the
  boundary, which is part of the language.

**Where it shows:** the setup teams-naming step (icon appears per slot as the name is typed), the
"Which teams are you in?" pills, the app sidebar's person avatar, and the `/org-chart` team cards.

Verified by prerendering a throwaway route and reading the emitted SVG: no `NaN`, 2–3 shapes per icon,
every composition has at least one filled shape (a post-pass promotes the dominant shape if a seed
picked stroked forms for all of them), and each name renders identically at 32px and 64px.
