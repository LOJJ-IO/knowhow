---
type: engineering
status: active
tags: [area/frontend, priority/high]
created: 2026-09-26
updated: 2026-09-27
related: ["[[Proposal-Ready-Plan]]", "[[Current-Context]]", "[[0020-button-taxonomy]]", "[[0017-dialogs-over-settings-screens]]", "[[0015-seeded-generative-identity-system]]", "[[Lessons-Learned]]"]
---

# UI consistency rules (for Phase E screens, starting with folders)

Every rule below restates a decision already made in [[Current-Context]] or an ADR. If a rule and the user's design disagree, the user's design wins and the rule gets edited here, not worked around.

## Before writing any screen
1. **Reuse before writing.** Check `src/components/app/` first: `Button`, `AppDialog`/`FormDialog`/`ConfirmDialog`, `EmptyState`/`EmptyScreen`, `AppPage`, `Panel`, `AppIcon`, `Tooltip`, `PersonAvatar`. A new primitive needs a stated reason.
2. **No new dependencies.** User rule for this work. `cn()` (`clsx` + `tailwind-merge`) and `framer-motion` already exist.
3. **Implement only what the user designed.** Layout, copy and colour come from the user. A pasted component is the design; where it is used, and what goes on it, is asked, not guessed (invariant 7).
4. **Pasted components are retargeted, not pasted.** Swap `motion/react` for `framer-motion`, drop unused variants, fix ids and a11y (see Folders below), and record what changed in [[Current-Context]] as the bell did.

## Tokens and type
5. **Colour from tokens only.** `--app-ground`, `--app-muted`, `--app-active`, `--app-border`, `--app-dim`, ink `#1c1917`, secondary text `#44403c`. A hard-coded hex needs a reason. Component-internal palettes (like the folder themes) must be reduced to the tokens we use, not shipped as three themes we never pick.
6. **Shapes.** Windows and panels `rounded-[32px]`; dialogs `28px`; menu rows `12px`. Do not introduce a new radius.
6a. **Setup card inset.** Everything below the body copy on a sign-in / setup card (white choice buttons, fields, copy fields, `SetupError`) sits in by `mx-[2.5%]` so edges line up (user 2026-09-27: error margins didn't match the white buttons). Don't nest an inset thing inside another inset container. **Every card screen (2026-09-27, user: "all the screens"):** headings, body copy and card-level text (Terms line, "Getting ready…", boot error) sit in by `px-[5%]`, 5% **both** sides so the text block is centred in the card while staying left-aligned (user 2026-09-27; was `pl-[5%]`, which left the right side at 0) (`SetupHeading` / `SetupBody` do it; Log In, expired link and the account picker now match, the Remove-accounts heading row insets back arrow + title together (`px-[5%]`), the Remove account link uses `ml-[5%]`). Controls and control-level lines sit in by `mx-[2.5%]`: choice buttons, fields (invite-owner and connect-workspace email fields added), copy fields, the teams count stepper, account lists, `SetupError`, the personal-account error line, and `SetupAction` (Continue's right edge now lines up with the white buttons). Nothing on a card screen runs closer than 2.5% to either edge. Failure screens carry `ResultMark kind="cross"`: Google didn't confirm, couldn't check with Google, account belongs to someone else, wasn't the invited account, and the expired join link.
6b. **Errors are formatted, not dumped.** A multi-part error uses `SetupError`'s bold `title` (what went wrong), `items` bullets (the specifics, in human words, never raw URLs/scope strings/exception text) and `children` (what to do next). Raw backend/Google error text goes to logs, not the screen (user 2026-09-27).
7. **Type** is `satoshi` (portaled content must set it explicitly). Sentence case. **No em dashes in user-facing copy.** The product is spelled **Knohow**.
8. **Icons** resolve through `AppIcon` (Material subset, codicons, lucide). Resting stroke `NAV_STROKE` 1.75.

## Behaviour
9. **Buttons** use the taxonomy in [[0020-button-taxonomy]]; press feedback is `active:translate-y-px`, never `scale` (it swallows clicks).
10. **Layers:** menus 450, dialogs 500, tooltips 600, set on the positioner.
11. **Motion:** springs for physical things, the `.app-modal` curve for overlays. Everything respects `prefers-reduced-motion` (drop the motion, keep the state change).
12. **Every screen has four states:** loading, empty (`EmptyState`, one action), error, limited (unapproved members, see `LIMITED_ACCESS_MESSAGE`). Errors go through `backendError`; never render a raw API string.
13. **Interaction must not depend on hover.** Touch and keyboard reach every state. Nothing closes on `mouseleave` alone.
13a. **Anything copyable uses `CopyField`** (`src/components/ui/copy-field.tsx`, user 2026-09-27: "this is how any copy looks on the app"). Read-only 40px field (or 3-row textarea with `multiline`), copy icon inside on the right, black tooltip below the icon, "Copy" → "Copied" (stays open on click), icon → check for 1.5s, `execCommand` fallback and a "Couldn't copy" tooltip when both fail. Optional small label above (`showLabel`). No black Copy buttons, no separate copy rows.

## Data
14. **Real data only.** Screens read the backend ([[0016-app-reads-the-backend-not-fixtures]]). Mocks only if the user explicitly allows them for a scaffold, and they are removed before the slice counts as done.
15. **Nothing under `src/` calls Google** (invariant 2). Every data call is scoped by `organizationId`.
16. **Files shown are indexed, confirmed files only** ([[FEAT-drive-file-classification]]). A folder never lists an unconfirmed or personal file.

## Folders (the pasted component)
- **Unique SVG ids.** It hard-codes `filter0_i_171_13` and `filter0_i_card_{1..3}`. With more than one folder on a page the filters collide. Use `useId()` per instance.
- **Hover is not the only way in.** It opens on click and closes on `mouseleave`; add focus/keyboard (button semantics, `aria-expanded`) and stop mouseleave closing an open folder on touch.
- **Themes.** Keep only the ones the design uses; the app is quiet neutral, so `white`/`black` first, `blue` only if a screen calls for it.
- **Size.** It is fixed 321x270 at `md`; a grid needs `sm`, and the three preview cards must show the real first three files, not placeholder lines.
- **Where it lives:** `src/components/app/folder.tsx`, no logic in it (props in, no fetching). Screens own the data.
