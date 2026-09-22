---
type: decision
status: active
tags: [area/frontend, area/design]
created: 2026-09-21
updated: 2026-09-21
related: ["[[FEAT-core-app-screens]]", "[[0016-app-reads-the-backend-not-fixtures]]", "[[Lessons-Learned]]"]
---

# ADR-0017: Settings is a dialog, and the app has one dialog system with named kinds

## Status
`active`

## Context
Settings started as a route (`/settings`) alongside the feature screens. The user asked for it to
enter as a dialog, taking inspiration from Sage_v1, and to record the **types** of dialog that system
distinguishes (2026-09-21).

## Decision
**Settings opens as a dialog, not a screen.** It is something you adjust and come back from, so it must
not cost you your place. The `/settings` route is deleted; the sidebar's Settings row is a button.

**One dialog system**, `src/components/app/dialog.tsx`, with the distinctions Sage_v1 got right:

| Axis | Values | Meaning |
| --- | --- | --- |
| Shell | header · scrolling body · footer | Content never decides its own chrome, so two dialogs can't disagree about padding. |
| `size` | `sm` (max-w-md) · `lg` (max-w-2xl) · `xl` (max-w-5xl) | A scale, not free widths: `sm` for a decision, `lg` for a form, `xl` for something with its own layout inside. |
| `kind` | `form` · `confirm` | `form` — the person is editing, the footer holds the action. `confirm` — the person is deciding, the footer holds the answer, and the destructive answer looks destructive. |
| Entrance | backdrop fades; popup scales from 95%; 150ms | Driven by Base UI's `data-[starting-style]` / `data-[ending-style]`, not a timer, so an interrupted open can't strand the animation. |
| Exit | always available; `onSafeExit` | Closing never destroys work silently; the caller can ask first. |

Composed pieces: `AppDialog` (the shell), `DialogSection` (one group of rows — two sections read as two
subjects, six sections are two dialogs), `DialogButton` (filled = the answer, outline = the way out,
destructive = destructive), `ConfirmDialog` (a decision, kept separate from the form dialog: a confirm
that grows fields is a form wearing a confirm's clothes).

Built on Base UI, already a dependency for the tooltip. No Sage code, tokens or dependencies crossed
over — invariant 5 holds; what was borrowed is the taxonomy.

## Consequences
- Anything settings-shaped from now on is a dialog with a `size` and a `kind`, not a new route.
- **Only settings that exist are shown.** The org's name and the auto-accept rule have endpoints and are
  wired; the join link is displayed read-only because onboarding created it and the app has nowhere yet
  to reissue it.
- Both writes are **owner-only in the backend** (`_require_owner`), so a non-owner sees the controls as
  read-only rather than getting a 403 on save.
- `Help` stays a route: it is a place you go to read, not a thing you adjust.
