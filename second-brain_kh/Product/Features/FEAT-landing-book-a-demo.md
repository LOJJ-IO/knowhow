---
type: feature
status: in-progress
tags: [area/frontend, area/backend]
created: 2026-09-17
updated: 2026-09-20
related: ["[[FEAT-landing-login-panel]]", "[[FEAT-landing-header-nav]]", "[[Current-Context]]"]
---

# FEAT: Landing Book a Demo sheet

## Status
`in-progress` — sheet + form + segment + **team-size step** + Cal embed built; **abandoned-demo Resend recovery built 2026-09-20** (`demo_leads`, idle job, resume deep link).

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

### Segment step (2026-09-19)
After the website field validates, the fields are **replaced** by a segment screen in the same modal (`.t-resize` tweens the height change) — one job per screen, per the user's one-action-per-screen rule. Decided with the user via the question tool:
- **Heading "Who's this for?"** (user's pick over "Your organization" / "What kind of team are you?" / keeping "Book a Demo"). Same Söhne H2 as the other steps. No muted section label above the cards.
- **Four cards, stacked** (`DEMO_SEGMENTS`, 2026-09-19): Agencies · Startups · Nonprofits · **Other**, each an outline icon + bold title + muted blurb. **The reference's card chrome was not copied** — the cards are the setup steps' choice button (`SETUP_CHOICE_CLASS`) grown to hold the extra content: white, 1px `#d9d9de`, `var(--login-button-radius)`, `active:scale-[0.98]` (user: "using the way we've been designing these cards").
- **Icons** (user's pick, outline, `strokeWidth={1.75}`, `currentColor`, inline SVG — no icon package added): **briefcase / rocket / heart**, plus a **pencil** on Other (it writes, matching the box it opens).
- **Copy is placeholder** — titles and blurbs ("Keep client IP under your control." / "Own your files from day one." / "Never lose work when people leave.") stand in until the user writes them, like the onboarding result screens.
- **Selection: one choice, skippable** (user). Picking a card **darkens its hairline** to `#1c1917` — no fill, no checkmark. `aria-pressed` on each card. Continue is always enabled and never shakes here; no "Other" option.
- **"Other" opens a text box** (2026-09-19, user): picking it grows a single `t-demo-input` in **below the cards** (user's pick over replacing them or expanding inside the card), which takes focus. Cards stay visible; the modal's `.t-resize` tweens the growth, same as a field step. `aria-label` only, no visible label or placeholder — no invented copy. **The Other card itself does not darken** (2026-09-19, user: "when other is selected just the text box should be highlighted") — the highlight is on the box, via `.t-demo-input.is-picked` → `#1c1917` in `globals.css` (a class, not `:focus-visible`, so it stays dark after focus moves away; Tailwind utilities can't beat the existing `.t-demo-input` border rule). The text is local state, sent nowhere.
- **The button reads "Skip" until a card is picked, then "Continue"** (2026-09-19, user: "the button should skip instead of continue"; Skip→Continue swap chosen over one fixed label or two pills). Same black `CTA_CLASS` pill, right-aligned, in both states.
- **Skip / Continue opens the team-size step** (2026-09-20) — see below. The segment pick and the Other text are still local state, sent nowhere.

### Team size step (2026-09-20)
After industry, Skip / Continue replaces the segment cards with a size picker (same modal, `.t-resize`). User affirmed the hotel-reference chip pattern with Knohow copy:
- **Heading "How many people on your team?"** (Söhne H2, same as the other demo steps).
- **Six chips:** `1` · `2–5` · `6–20` · `21–50` · `51–100` · `100+` — white, `border-[#d9d9de]`, picked hairline `#1c1917`, `var(--login-button-radius)`, in a **3×2 grid** (420px modal; reference was one row on a wider layout).
- **Skippable** like segment — button reads **Skip** until a chip is picked, then **Continue**.
- **Continue / Skip → Cal booking screen.** Size pick is local state, sent nowhere yet.
- Counts as a pre-Cal step in the flow; abandoned recovery arms from email onward (including Cal) — see below.

### Booking screen — Cal.com embed (2026-09-20)
Skip / Continue replaces the segment cards with the user's **Cal.com booking embed** (`DemoBookingStep`). User: "embed this after continue in that same bounce… it might need to be an area bounce", then supplied the Cal snippet.
- **`@calcom/embed-react` ^1.5.3 added** (npm). `getCalApi({ namespace: "15min" })` → `cal("ui", { hideEventTypeDetails: false, layout: "month_view" })`, then `<Cal namespace="15min" calLink="knohow-demo/15min" config={{ layout: "month_view", useSlotsViewOnSmallScreen: "true" }} />` — namespace, link and config exactly as the user's snippet.
- **Inline, not the snippet's popup button** (assumption — the snippet Cal hands out is the `data-cal-link` button variant, but this screen *is* the embed; a button would be a third click). Swap to the popup if the user wants it.
- **The "area bounce" is free:** `LoginModal` measures its body with a `ResizeObserver` and writes an explicit px height, so `.t-resize` tweens the modal to whatever height Cal settles at — the area grows, the embed itself isn't animated.
- **The Knohow mark holds the slot** (`public/knohow-mark.png`, added 2026-09-20 — 1024×1169, transparent, mark zoomed out 60% and centred, rasterized from `icon.svg` with `sharp`) until `getCalApi` resolves, so the area is never empty.
- **No modal surface on this screen, and it widens** (2026-09-20, user: "the embed doesn't need a white overlay behind it and i think its okay to make the width wider"): `.t-login-modal:has(.t-demo-booking)` in `globals.css` → `background: transparent`, `border-color: transparent`, `box-shadow: none`, body `padding: 0`, `width: min(920px, 100% - 32px)` (from 420px). Cal's embed brings its own white card, so the modal's `#fbfaf8` plate was doubling up. The border is kept **transparent rather than removed** so `LoginModal`'s measured height (content + border delta) still adds up; `.t-resize` already tweens `width` as well as `height`, so the widening rides the same bounce. Keyed off a `t-demo-booking` class via `:has()` — no prop drilling through `DemoForm` → `DemoSegmentStep`.
- **Two fixes 2026-09-20** (user: "the corner radiuses don't align with our previous iterations and it bounces twice"):
  - **Radius** — the modal's outer corner is `button radius + padding + 1px` (≈28.6px), which only makes sense *around* 1.1rem of padding. With padding dropped to 0 the embed sat in an oversized corner, so the booking step takes the plain `var(--login-button-radius)` (10px) and the slot inside matches it. Nested-radius rule, see [[Lessons-Learned]].
  - **Double bounce** — the slot's child was auto-height, so the modal tweened twice: once to the placeholder's height, again to Cal's height on load. `.t-demo-booking` is now a **fixed 640px slot** (`position: relative`, `overflow: hidden`); Cal fills it at `height: 100%` and the mark is centred *inside* it (w-40) instead of sizing it. One growth, on entry.
- **Three fixes 2026-09-20, all verified in-browser** (user: "center the modal like it was before… the site feels noticeably slower", "disable scrolling on the city backdrop"):
  - **Centring** — the modal box was already dead centre (0,0 offset, measured); what looked off was Cal's iframe, which is its white card (458px) plus an ~80px attribution band. `translate: 0 40px` on the booking modal (half the band) puts the *card* on the viewport's centre line, where every earlier step's modal sat. `translate` joined `.t-resize`'s transition list so the shift rides the same tween.
  - **Slot height 640 → 538px** — what Cal actually reports for `month_view` at this width, so the embed fills the slot with no dead space.
  - **Speed** — `@calcom/embed-react` was statically imported into `landing-hero.tsx`, so Cal sat in the landing page's eager chunk and `cal.com/embed/embed.js` was fetched on **every** visit. `DemoBookingStep` now lives in `src/components/brand/demo-booking-step.tsx` and loads via `next/dynamic` (`ssr: false`), with the shared `DemoBookingSlot` (`demo-booking-slot.tsx`) as its `loading` state so the fixed slot — and the single growth — survive the lazy load. **Verified: 0 Cal requests on landing load** (was the full embed script), Cal code now in its own chunk.
  - **Page scroll locked while the sheet is open** — `body.style.overflow = "hidden"` (restored on close) + `overscroll-none` on the sheet, so a wheel over the city backdrop, or a scroll chained out of Cal's iframe, no longer moves the landing underneath. Verified: wheel over the backdrop leaves `scrollY` at 0.
  - **Still off-system:** Cal's card uses an **8px** radius inside its iframe vs the project's 10px; it can't be restyled from outside the iframe.
- No heading or copy on this screen — none has been written.
- The "M:SS reserved" countdown keeps running across this step (it lives in the sheet, not the form).

**Validation (user: "check required fields"; error state = user-supplied Transitions.dev "Error state shake" CSS, in `globals.css`):** `noValidate` form; on submit each field runs `checkValidity()` (all `required`, email `type="email"`, website text + `inputMode="url"`). Each invalid field gets `.is-error` on `.t-input-wrap` + `.t-input`, the shake restarts (`is-shaking` removed → reflow → re-added), border goes red, the message fades in; after 3000ms (`--revert-hold`) both fade back. Classes are toggled on the DOM, not via React state, so the shake can restart without a re-render. First invalid field gets focus; `aria-invalid` + `aria-describedby` wired. **A valid submit does nothing** — nothing is sent.
- **Message copy = the browser's own `validationMessage`** (e.g. "Please fill out this field.") — no invented copy. Error red `#EA4335` (the Google red already used in the G mark). Message space is reserved under each field (the snippet's `visibility` approach), so errors don't shift the layout — except a message long enough to wrap (see Open questions).

Verified in-browser 2026-09-17: empty Continue → both name fields shake/red, focus on First name; names filled → email grows in, focused; bad email → only email flagged; valid email → website grows in, focused; all valid → nothing flagged; Close → Log In still shows its own content; no page errors.

## Out of scope
- Mobile trigger — there's no Book a Demo control on mobile (same as Log In).
- Success/confirmation state after a valid submit (Cal owns the confirmation once a slot is booked).
- Multi-email drip sequences (one shot only — see abandoned recovery below).
- Marketing / promotional email — abandoned recovery is **transactional only**.

## Abandoned demo recovery — Resend (built 2026-09-20)
If someone starts Book a Demo and goes idle, send **one** Resend email after **20 minutes** of inactivity asking them to continue. **Copy locked** (see Final body copy below). **Resend domain verified** 2026-09-20.

**Rules (user):**
- **Clock arm:** first valid work email on Continue past the email field (website step appears) — `POST /demo-leads`. Before that, nothing can be emailed.
- **Inactivity:** no typing/clicks **inside the demo sheet** for `DEMO_RECOVERY_IDLE_SECONDS` (default 1200). Pointer/key activity on the sheet calls `POST …/touch` (throttled 15s). Landing clicks outside the sheet do not reset.
- **Which steps:** any step after email — including **Cal** until booked.
- **One shot** — `recovery_sent_at` set after send; no follow-up.
- **Cancel** via `POST …/cancel`: **reopen** Book a Demo, **cta** (`GET /demo-leads/resume/{token}`), or **booked** (Cal `bookingSuccessful`).
- **Resume:** `/?demo_resume=<token>` opens Book a Demo prefilled at the saved step.
- **From:** `noreply@knohow.app`. Job: scheduler every 1 min → `send_due_recovery_emails`.
- **Code:** `backend/app/models/demo_lead.py`, `app/demo/service.py`, `app/demo/resend.py`, `app/api/routes/demo.py`, migration `0012_demo_leads`; frontend `src/lib/demo-lead.ts` + `DemoForm` sync.

### Email template (reference → Knohow mapping)

Lance reference the user wants to mirror (hotel onboarding abandon):

> Hey Ronald,  
> Great to meet you - I'm Caleb, one of the co-founders of Lance. It looks like you started telling us about your hotel but got pulled away. No worries; it happens all the time.  
> You can pick up right where you left off here:  
> **Continue getting started**  
> It takes about two minutes, and you'll have the option to book time on my calendar at the end if that would be helpful. I would love to chat!  
> Cheers,  
> Caleb Chan · Chief Executive Officer · Lance  
> Email · LinkedIn

**Locked structure for Knohow:**
1. Greeting with **first name**
2. Short intro: **Isaac**, co-founder (Marketing & Sales), Knohow
3. Soft line: you started telling us about **your organisation** but got pulled away — no guilt
4. Single CTA deep link — label: **Pick up where you left off**
5. ~two minutes + mention they can book time on the calendar at the end
6. Personal sign-off: Isaac · Co-founder, Marketing & Sales · Knohow · iekwaru@gmail.com · LinkedIn

**Copy decisions (user 2026-09-20):**
- **Subject:** `Pick up where you left off?`
- **CTA label:** `Pick up where you left off`
- **Signer:** Isaac — Co-founder, Marketing & Sales
- **Sign-off email:** `iekwaru@gmail.com`
- **Sign-off LinkedIn:** https://www.linkedin.com/in/isaac-ekwaru-284249217/
- **About phrase (fixed):** `your organisation` — not varied by company/segment in the body (user 2026-09-20; earlier “mention when we have it” superseded for this line)
- **Draft approved shape** — final body below

### Final body copy (locked 2026-09-20)

**Subject:** Pick up where you left off?

Hey {firstName},

Great to meet you — I'm Isaac, co-founder of Knohow (Marketing & Sales). It looks like you started telling us about your organisation but got pulled away. No worries; it happens all the time.

You can pick up right where you left off here:

**Pick up where you left off** ← deep link

It takes about two minutes, and you'll have the option to book time on my calendar at the end if that would be helpful. I would love to chat!

Cheers,  
Isaac  
Co-founder, Marketing & Sales  
Knohow  
Email · iekwaru@gmail.com  
LinkedIn · https://www.linkedin.com/in/isaac-ekwaru-284249217/

Only merge field in the body: `{firstName}`. Envelope From remains `noreply@knohow.app`.

**Still open for this slice:**
- Whether clicks **inside the Cal iframe** reset the sheet idle timer (cross-origin; parent only hears sheet chrome events today).
- Cal webhook as a belt-and-suspenders booked signal (embed `bookingSuccessful` is wired).

## Open questions
- **Long browser messages wrap:** Chrome's invalid-email text ("Please include an '@' in the email address. 'x' is missing an '@'.") takes two lines at 420px, so the modal grows ~20px (animated by `.t-resize`). Options: custom copy, single-line truncation, or accept it.
- Browser validation text differs per browser/locale.
- Company website: any format check (currently required only).
- Segment card copy (titles + blurbs, including Other's "Tell us below.") — placeholder until the user writes it.
- Whether the picked segment **and the Other text** are stored on the backend lead (needed for personalized email + resume) — leaning yes once abandoned recovery ships.
- **Embed size:** 920 × 538 on the booking step (`useSlotsViewOnSmallScreen` still set); 538 is Cal's own `month_view` height at that width, measured at 1470×956. If Cal's height differs at other widths/layouts the slot won't follow — it's fixed on purpose (see the double-bounce fix).
- ~~Booking screen not yet opened in a browser~~ — verified 2026-09-20 at 1470×956 (Playwright): single growth 530 → 540px, modal 920×540 centred, card centred, no page errors. Other viewports still unverified; **mobile is untested** and there's no mobile Book a Demo trigger anyway.
- ~~Where a valid request goes~~ — partial leads → backend; recovery → Resend; booking still Cal (see abandoned recovery).

## Related
[[FEAT-landing-login-panel]] · [[FEAT-landing-header-nav]] · [[FEAT-workspace-onboarding-flow]]
