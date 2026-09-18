---
type: feature
status: in-progress
tags: [area/frontend]
created: 2026-09-17
updated: 2026-09-17
related: ["[[FEAT-landing-login-panel]]", "[[FEAT-landing-header-nav]]", "[[Current-Context]]"]
---

# FEAT: Landing Book a Demo sheet

## Status
`in-progress` — sheet + form built 2026-09-17; nothing is submitted anywhere yet.

## Problem
The desktop header's **Book a Demo** button (renamed from Talk to Sales 2026-09-17, [[FEAT-landing-header-nav]]) did nothing. User: "a replica of log in but the modal's content should be" a demo-request form (reference screenshot: "Get Started", First/Last name, Work email, Company website, Continue pill with an arrow circle).

## Solution
**Same sheet as Log In** ([[FEAT-landing-login-panel]]) — recess, veil, skyline + stars background, `--resize-ease` slide, video pause, Close pill, Edmonton logo, and the thin-line → grow modal (`LoginModal` + `.t-resize`). `LandingHero` now has `sheetOpen` / `sheetAtTop` (were `loginOpen` / `loginAtTop`) plus `sheetKind: "login" | "demo"`, set by the header button key and **kept after Close** so the content doesn't swap while the sheet slides down.

Modal content (`DemoForm` in `landing-hero.tsx`), decided with the user via the question tool:
- **Heading "Book a Demo"** (user's pick over the reference's "Get Started") — Söhne, same style as the Log In heading (the reference serif isn't in the project).
- **Fields:** First name + Last name side by side (`grid-cols-2 gap-x-2`), then Work email and Company website full width. Labels Satoshi `0.8rem`, `rgb(28 25 23 / 0.6)`, above each input. **No placeholders.** Inputs `h-10`, white, 1px `#d9d9de` border (focus `#1c1917`), radius `var(--login-button-radius)` (10px, the nested-radius rule — see [[Lessons-Learned]]), `autoComplete` given-name / family-name / email / url.
- **Continue (revised 2026-09-17, user: "this button doesn't match the header" → centre text, drop the arrow circle, not full width):** now literally the header pill — `cn(CTA_CLASS, satoshi.className)` in a `mt-3 flex justify-end` row (`CTA_CLASS` carries no font; the header gets Satoshi from its row). Sizes to its label, **right-aligned** under the fields (user, 2026-09-17: "move the button to the right"); computed styles verified identical to the header's Book a Demo pill. The first version (full-width, left label, white arrow circle) is gone, as is `ArrowRightIcon`.
- **Continue is solid `bg-black` (2026-09-17, user: "looks grey… want it darker like the reference"):** the header's `bg-black/80` over the `#fbfaf8` modal composites to ~#333; it only reads near-black over the dark sky (the Close pill the user pointed at). Override via `cn(CTA_CLASS, …, "bg-black")` (tailwind-merge drops `/80`). Header pills unchanged.
- **Autofill highlight light grey (2026-09-17, user):** `.t-demo-input:-webkit-autofill` (+ `:hover`, `:focus`) → inset `box-shadow 0 0 0 1000px #f3f2ef` (the mac windows' light well; Chrome ignores `background-color` on autofill) + `-webkit-text-fill-color`/`caret-color` `#1c1917`. Rule verified loaded; real autofill can't be triggered from Playwright.
- **"Reserved" countdown (2026-09-17/18, user reference: a "4:38 reserved" block; answers via question tool):** `ReservedCountdown` in the sheet's top row, **Book a Demo only**. Counts down from **5:00** (`DEMO_RESERVED_MS`), starting the **first time Book a Demo opens this visit** (`demoReservedAt` in `LandingHero`) and **keeps running across Close / reopen**; when it runs out it reads **"Hold Expired"** (2026-09-18, user) instead of "0:00 reserved" — same text style, no pop-in. **Revised 2026-09-18 (user: "move to the left side of the screen, also I said label, not including the pill"):** plain white text at the Close **label's** size/weight (Satoshi bold `1.13569rem`, no pill), **top-left** of the sheet (24px in, vertically centred with Close — row is `justify-between items-center`; Close has `ml-auto` so it stays right on Log In). `tabular-nums`, `role="timer"`.
  - **Digit pop-in (user-supplied Transitions.dev "Number pop-in" CSS, in `globals.css`):** each character is a `.t-digit` keyed `position-char`, so only digits that change remount and replay the pop; changed digits stagger left → right (`data-stagger` 1/2). The previous label is derived as one second earlier (`formatCountdown(secs + 1)`) — reading a ref during render is a lint error. Verified: 5:00 → 4:59 animates the three changed digits with stagger 0/1/2; reopened after 60s shows 3:58; reaches and holds 0:00; not rendered on Log In; no page errors.
- **Width 420px** (same as Log In).
- **Stepwise reveal (2026-09-17, user: "start with first name and last name then bounce grow to include work email, then … website"; trigger = Continue click, user's pick):** `step` 0 → 1 → 2 shows 2 → 3 → 4 fields (`DEMO_STEP_FIELD_COUNT`). Continue validates **only the fields shown**; all valid → next step, and the added field gets focus. At step 2 a valid Continue does nothing. The growth is `LoginModal`'s measured height + `.t-resize` (no extra animation) — the growing edge reveals the new field. Heights at 1470×956: **284 → 376 → 469px**. Typed values survive Close/reopen while Book a Demo stays the sheet's kind; opening Log In and coming back remounts the form at step 0.
- **Errors clear as soon as a field is valid** (typing that makes it valid, or a Continue that finds it valid), not only after the 3s hold — otherwise a just-fixed name stayed red when the email step appeared (found in testing 2026-09-17).

**Validation (user: "check required fields"; error state = user-supplied Transitions.dev "Error state shake" CSS, in `globals.css`):** `noValidate` form; on submit each field runs `checkValidity()` (all `required`, email `type="email"`, website text + `inputMode="url"`). Each invalid field gets `.is-error` on `.t-input-wrap` + `.t-input`, the shake restarts (`is-shaking` removed → reflow → re-added), border goes red, the message fades in; after 3000ms (`--revert-hold`) both fade back. Classes are toggled on the DOM, not via React state, so the shake can restart without a re-render. First invalid field gets focus; `aria-invalid` + `aria-describedby` wired. **A valid submit does nothing** — nothing is sent.
- **Message copy = the browser's own `validationMessage`** (e.g. "Please fill out this field.") — no invented copy. Error red `#EA4335` (the Google red already used in the G mark). Message space is reserved under each field (the snippet's `visibility` approach), so errors don't shift the layout — except a message long enough to wrap (see Open questions).

Verified in-browser 2026-09-17: empty Continue → both name fields shake/red, focus on First name; names filled → email grows in, focused; bad email → only email flagged; valid email → website grows in, focused; all valid → nothing flagged; Close → Log In still shows its own content; no page errors.

## Out of scope
- Sending the request anywhere (no backend endpoint, no email, no CRM) — not asked.
- Mobile trigger — there's no Book a Demo control on mobile (same as Log In).
- Success/confirmation state after a valid submit.

## Open questions
- **Long browser messages wrap:** Chrome's invalid-email text ("Please include an '@' in the email address. 'x' is missing an '@'.") takes two lines at 420px, so the modal grows ~20px (animated by `.t-resize`). Options: custom copy, single-line truncation, or accept it.
- Browser validation text differs per browser/locale.
- Where a valid request goes, and what the user sees afterwards.
- Company website: any format check (currently required only).

## Related
[[FEAT-landing-login-panel]] · [[FEAT-landing-header-nav]] · [[FEAT-workspace-onboarding-flow]]
