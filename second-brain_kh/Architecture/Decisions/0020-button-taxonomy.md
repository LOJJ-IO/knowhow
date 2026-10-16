---
type: decision
status: active
tags: [area/frontend, area/design]
created: 2026-09-22
updated: 2026-09-22
related: ["[[0017-dialogs-over-settings-screens]]", "[[FEAT-core-app-screens]]", "[[Lessons-Learned]]"]
---

# ADR-0020: Buttons have a taxonomy, the same shape as the dialog one

## Status
`active`

## Context
Every app control had grown its own class string: the topbar's New, the notifications and sidebar-toggle
discs, the dialog footers' `DialogButton`, the team card's caret. Four spellings of "a button", each
with its own height, rounding and press feedback, and nothing saying which one a new screen should
reach for.

The dialog system had already solved this by borrowing Sage_v1's taxonomy
([[0017-dialogs-over-settings-screens]]): two axes, named values, one shell. The user asked for the same
treatment for buttons (2026-09-22).

## What Sage_v1 does
`frontend/src/components/ui/button.tsx` — one `Button` on Base UI, styled by `cva` on two axes:

| Axis | Values |
| --- | --- |
| `variant` | `default` · `outline` · `secondary` · `ghost` · `destructive` · `link` |
| `size` | `default` · `xs` · `sm` · `lg` · `icon` · `icon-xs` · `icon-sm` · `icon-lg` |

The `icon-*` half is the same scale with equal sides, for a button whose content is a glyph. Defaults
are `variant: "default"`, `size: "default"`.

## Decision
**Knohow takes those axes, those value names and those meanings, and renders them on its own design.**

| `variant` | When |
| --- | --- |
| `default` | The one thing this surface is for. A surface with two has not decided what it is for. |
| `outline` | The way out, standing beside a `default`. |
| `secondary` | A standing control that isn't the point of the screen (the topbar's discs). |
| `ghost` | Chrome that only appears under the pointer (a close, a caret). |
| `destructive` | Takes something away. |
| `link` | Prose that acts. |

`size` is Knohow's scale, not Sage's: `default` is `h-10`, because that is what this app's controls
already were, with `xs` 28 · `sm` 32 · `lg` 48 and the `icon-*` mirror. Shape is `rounded-full`
throughout and the press is the landing's `active:scale-95`, so a control feels the same either side of
sign-in.

**`cva` was not added.** Two `Record<Variant, string>` maps and `cn` do the same job without a
dependency — the project has no other `cva` user.

**Dialogs finish their composition at the same time**: `FormDialog` now exists beside `ConfirmDialog`,
both compositions of `AppDialog`, so a form's footer isn't assembled by hand at each call site.
`DialogButton` is kept as an alias of `Button` so footers still read as footers.

## Consequences
- A new control picks a `variant` and a `size`; it does not write a class string.
- What crossed over from Sage is the **taxonomy** — axis names, value names, meanings. No code, token or
  dependency did, so invariant 5 holds. Sage renders the same words very differently (gradient primary,
  tinted destructive, 32px default row); ours are flat, fully rounded and a size larger.
- The landing keeps its own CTA styles. This is the app's system; the landing is a separate surface and
  the frontend rebuild is user-driven (invariant 7).
