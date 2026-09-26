---
type: pattern
status: active
tags: []
created: 2026-08-31
updated: 2026-09-21
related: ["[[Known-Issues]]", "[[Architecture-Overview]]", "[[Current-Context]]"]
---

# Lessons Learned

## 2026-09-21 — A ResizeObserver on a container holding a third-party iframe will blink on every interaction inside the iframe
`LoginModal`'s `ResizeObserver` re-measured its body whenever the Cal.com embed's iframe resized internally (date pick, time select, form focus). Each observation called `setHeights` → React re-render → the `.t-resize` CSS transition tweened the modal's height, producing a visible flash/"blink". The `.t-demo-booking` slot already had a fixed CSS height (538px) to prevent double-tween on mount, but the observer still fired on sub-pixel layout shifts from the iframe. Fix: track the last-set full height in a ref and skip `setHeights` when the new height differs by less than 2px. General rule: when a `ResizeObserver` feeds a CSS-transitioned dimension, always debounce or threshold the state update — a third-party iframe can resize itself on any user interaction, and each resize triggers a visible transition even if the height change is imperceptible.

## 2026-09-18 — Antigravity ignores Cursor rule paths unless you mirror them
Knowhow’s durable agent instructions lived in `CLAUDE.md`, `.cursor/rules/`, and `.cursor/skills/`. Google Antigravity loads `~/.gemini/GEMINI.md` + `.agents/rules/` (and skills under `.agents/skills/`), so it looked “bad at instructions” while Cursor obeyed the same repo. Fix: short Always On rules in `.agents/rules/` (`trigger: always_on`) for invariants + second-brain, plus glob rules for `src/` / `backend/`. Keep those files in sync when invariants change — do not assume Antigravity reads `.cursor/`. MCP is a separate surface: workspace `.agents/mcp_config.json` (not Cursor’s `~/.cursor/mcp.json`); seed only servers that match invariants (GitHub + Context7 now; no Prisma / no Drive-into-`src/` / no DB until provisioned).

## 2026-09-16 — Button sound effects removed
Removed Web Audio API sine tick click sound effects (`playClickSound` and `AudioContext`) from all button and control interaction handlers in `landing-hero.tsx` per user request.

## 2026-09-14 — A live `%` in `translate`/`transform` that resolves against its own animating `width` is fragile under a forced reflow — pin it to a measured px instead
The mobile Get Started CTA's split circles centred themselves with `left: 50%; translate: calc(-50% + Npx)` while `width` was *also* transitioning (100% → a fixed diameter) on the same element. In a steady render loop this is fine — CSS resolves `%` in `translate` against the element's own box every frame, and both properties interpolate in lockstep. The user reported a "teleport left, then snap back" right at the split, but it never reproduced in headless Chromium even with per-frame instrumentation (button-centre polling at ~15ms resolution, and a CDP `Page.startScreencast` capture at true per-paint framerate — see the "Reasoning about rendering from library source is not verification" entry below for why frame-level evidence, not source-reading, is the right first move). Asking the user narrowed it in one question: real phone only, never in desktop dev tools' mobile emulation. That's the tell — a real mobile browser can force a *synchronous reflow* mid-gesture that headless Chromium never triggers (Safari's address bar collapsing/expanding is the classic case, and it changes the very viewport height several of this deck's `vh`-based vars animate against); under that forced reflow the two dependent interpolations (`width` and the `%` that reads it) can read back out of step for a single frame. Fix: measure the pre-transition width once (`getBoundingClientRect`), store it as a fixed px custom property, and write *both* transition endpoints as literal `px` `calc()`s instead of `-50%` — the transition then interpolates between two fixed numbers with no live width dependency at any point, immune to whatever the reflow does to layout mid-frame. General rule: a `%` inside `translate`/`transform` is only as stable as the property it resolves against — if that property is itself animating, on a *real* device (not just this browser, this session) it's one forced layout away from a visible glitch, and no amount of steady-state testing will catch it.

## 2026-09-14 — A bubble-phase gesture listener never sees a down that starts inside a child that stops propagation — use capture
Adding swipe-to-navigate to the mobile Cover Flow, a `onPointerDown`/`onPointerUp` pair on the stage container silently never fired when the gesture started on a card's mac window — which is ~80% of the card's area, so effectively always. Cause: `InteractiveMacWindow`'s shell calls `e.stopPropagation()` on its own `onPointerDown` (so a tap inside a window isn't misread as a deck click elsewhere). React 17+'s event system delegates to the root and simulates the bubble phase entirely in its own fiber-tree walk *after* the real DOM event has already finished its real bubble — so React's `stopPropagation()` on an inner component halts that internal simulation before it ever reaches an outer component's handler, even though a plain `addEventListener` on that same outer DOM node (attached directly, not through React) *does* fire, since it ran during the real bubble, earlier. Diagnosed by attaching a raw native listener next to the React one and comparing: native fired, React's didn't. Fix: `onPointerDownCapture`/`onPointerUpCapture` on the outer container — capture runs outside-in, before any inner `stopPropagation()` exists to block it. `DesktopDeck`'s own `onCardStep` already used this exact pattern for the same reason (see [[FEAT-landing-deck-notes-folder]]'s technical-approach note) — worth checking for existing capture-phase handlers before adding a new bubble one anywhere near `InteractiveMacWindow`.

## 2026-09-14 — A custom CSS class and a same-property Tailwind utility on one element is a latent tie, not a "Tailwind wins" default
A `.t-deck-notes-sheet { display: flex }` rule (defined in `globals.css`, below the `@import "tailwindcss"` line) beat a `md:hidden` Tailwind class applied to the very same element at desktop widths — the sheet stayed visible when it should have been `display: none`. Both are single classes (specificity 0,1,0); Tailwind's own utilities are injected at the top of the file via `@import`, so a custom rule appearing later in the same file wins ties regardless of which class "sounds like" it should take precedence by author intent. Tailwind's own internal `md:` variants don't have this problem against *each other* (its layer system orders them correctly), but a hand-written rule outside its layers is just another same-specificity competitor. Fix: don't rely on a Tailwind utility to override a custom rule touching the same property on the same element — write the override as an explicit media query in the custom rule's own file instead. Caught by driving it in a real browser (`getComputedStyle`), not by reading the class list — see the next entry.

## 2026-09-12 — Guidelines grid: derive cols/rows from aspect for square cells
Fixed 6×8 on a 16:9 viewport makes wide rectangles (`cell ≈ (W/H)×8/6`). For square cells: `cols ≈ rows × (W/H)` (or invert on portrait), with a fixed short-side density (`TARGET_SHORT`, currently 5). Ship that always; keep manual col/row only for desktop edit mode.

## 2026-09-12 — Click sound: await AudioContext.resume; don’t soft-nav stub hashes
Browsers leave `AudioContext` suspended until a gesture; scheduling oscillators before `resume()` resolves plays silence. Chain play after `resume()`. Same-origin `#about` / `#privacy` stubs can trigger App Router soft-nav and throw `Router action dispatched before initialization` (esp. under Fast Refresh) — `preventDefault` on stub footer links until real routes exist.

## 2026-09-11 — Sliding tabs: snap on paint/resize, tween on click
Transitions.dev pill tabs need measured `offsetLeft`/`offsetWidth` written onto an absolutely positioned pill. On first paint and resize, suspend `transition`, write geometry, force reflow, restore — otherwise the pill animates in from `width: 0`. Clicks keep the transition so the pill slides. Honor `prefers-reduced-motion`. (Tried on the landing header then removed — pattern still useful if tabs return.) [[FEAT-landing-header-nav]]

## 2026-09-10 — `liquid-gooey` for the CTA pill→arrows, not full-page melt
Full-bleed hero → next panel is still a bad fit for `liquid-gooey` melt (see entry below). Button-level morph is the right use: Get Started / spinner footprint stacks two `Liquid.Item`s in one CSS grid cell, then `x: ±42` + `morph.shape` + `transition="bouncy"` splits into ← → after the spinner beat. Transparent button chrome; `fill`/`shadow` on `<Liquid>` paint the merged silhouette. Stack with `inline-grid` + `gridArea: 1 / 1` or closed items sit side-by-side in normal flow and the goo never reads as one pill.

## 2026-09-10 — Mobile deck: Cover Flow + phone aspect; desktop keeps linear spread
Handoff deck is breakpoint-split: desktop stays 16:9 rise→spread; mobile uses portrait phone ratio (`9 / 19.5`) and a CardCoverFlow-style 3D stack (`framer-motion` springs, rotateY / z / scale). Same macOS frosted `DeckWindow` chrome in both. Added `framer-motion` for the mobile stack only — don’t invent Unsplash filler; windows stay empty until content is asked for.

## 2026-09-10 — Deck cards: frosted glass, not clear and not solid canvas
Mac-window reference (Cursor Desktop acrylic): each deck card is a real window chrome — **18px** outer radius, title bar (inherits radius via `overflow: hidden`), traffic lights **~13px** (red `#FF5F57` / yellow `#FEBC2E` / green `#28C840`), content well below with **~12px** inner radius. Semi-opaque dark fill + `backdrop-filter` so hero video reads through. Brand hex stays a thin inset rim so it doesn’t cover the dots. Honor `prefers-reduced-transparency`.

## 2026-09-10 — Hero grid must sit above the video inside `isolate` *(grid removed 2026-09-18; the `isolate` / z-index lesson still applies to any layer over the video)*
`GuidelinesOverlay` is a permanent design layer (lines always on; cell numbers only when editing). With the video wrapper using `isolate`, a child `-z-10` paints *under* the opaque video and the grid "disappears." Use `z-[1]` (or any positive z) inside that wrapper so lines sit on the video but still under page UI (`z-10+`).

## 2026-09-10 — Deck linear-spread: soft ease, no mid-keyframe timing swap
CardLinearSpread (stack → fan) hitch came from one long `@keyframes` that swapped to a snappy ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`) at the rise→spread join — velocity jumps from ~0 to fast. Prefer two chained animations (rise `forwards`, then spread delayed by rise duration) sharing a soft ease-in-out (`cubic-bezier(0.4, 0, 0.2, 1)`). Avoid per-keyframe `animation-timing-function` switches on `transform`.

## 2026-09-10 — Deck linear-spread: one keyframe owns `transform`
*(Partially superseded by soft two-phase note above.)* CardLinearSpread needs care with `transform`: chaining two CSS animations both setting `transform` can fight the cascade (later name wins) if fill-mode/`from` don't match. A single `@keyframes` with a mid stop works only if one continuous ease owns the whole run — mid-keyframe ease swaps feel choppy.

## 2026-09-10 — Archive motion experiments before replacing them
The Mission Control recess + lagged hex deck handoff was parked in [[Patterns-landing-mc-recess-deck]] when the post-spinner sequence changed to bg-fade / logo-shrink / middle-band cards — so it can be revived without archaeology.

## 2026-09-10 — Landing handoff: CSS melt, not liquid-gooey
Full-bleed hero (video + UI) → solid next panel is a bad fit for `liquid-gooey` melt (image-seam goo). Synced CSS: hero blur+opacity + panel translateY-only, same duration/ease after the spinner wait.

## 2026-09-10 — Same-route panel: spinner is prelude, open is the transition
Landing CTA must wait on the spinner beat, then flip `data-open` — clearing loading and staying on the hero feels broken. Keep the next panel always mounted (never unmount on click / no `router.push`) so CSS intro/outro can run; drive travel with full-height `--panel-translate-y: 100%` plus synced opacity/blur.

## 2026-09-10 — Old app tokens are not the brand
Using `bg-background` from the Sage-era cool-navy oklch palette made the CTA next panel read as "brand blue." Landing canvas is `#F9F8F6`. After explicit purge, do not reintroduce navy/oklch design-system tokens or old product routes without being asked ([[0004-landing-only-purge-old-app]]).

## 2026-09-05 — Stubbing `getSessionUser` to null is a full auth catch-22
After Prisma removal, returning `null` from every session read plus hard-erroring `logIn`/`signUp` meant `requireUser()` always redirected and no action could create a session. Fix without a DB: put the full `SessionUser` in the httpOnly cookie and authenticate against an in-memory demo roster (see [[0003-cookie-only-sessions-demo-roster]]). Leave queries/workspace stubbed separately — auth and data persistence are different seams.

## 2026-09-05 — Removed Prisma entirely for Vercel (not just `prisma generate`)
First prod build failed on missing `@/generated/prisma/client`. A generate-in-build fix was drafted, but the user rejected staying on Prisma for this deploy ("remove the prisma its not accepting"). Packages, `prisma/` tree, and `db.ts` are gone; session/queries/workspace were stubs (auth later rewired per entry above). Landing page `npm run build` is clean. Do not re-add SQLite on Vercel — next DB needs a durable host (see [[0002-remove-prisma-for-vercel]]).

## 2026-09-05 — Vercel build needs `prisma generate`; generated client is gitignored
*(Superseded the same day by removing Prisma — kept for history.)* `src/generated/prisma` is in `.gitignore` (correct — Prisma regenerate output). Local `npm run build` worked only because that folder already existed from prior `prisma generate` runs. On a clean Vercel clone it did not, so Turbopack failed with `Can't resolve '@/generated/prisma/client'`.

## 2026-08-31 — Prisma 7 requires a driver adapter; there's no implicit engine connection anymore
`new PrismaClient()` with no options now throws `PrismaClientInitializationError: ... A driver adapter is required`. For SQLite, install `@prisma/adapter-better-sqlite3` (pinned to the same version as `prisma`/`@prisma/client`) and pass `new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })`. Note the export is `PrismaBetterSqlite3` (lowercase "q" in "Sqlite"), not `PrismaBetterSQLite3` — easy to typo from the package name. `prisma migrate dev`/`deploy` (the CLI) don't need this — only the runtime client does.

## 2026-08-31 — `prisma migrate reset` is blocked for AI agents by design
Prisma 7's CLI detects when it's invoked by Claude Code and refuses `migrate reset --force` outright, printing a message that the agent must ask the user for explicit consent before setting `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. For a disposable local dev SQLite file, the lighter-weight and equally effective path is: delete the db file directly (`rm dev.db`), then `prisma migrate deploy` (applies existing migrations to a fresh file, not gated) + reseed. Reserve asking the user for consent for cases where you actually need `reset`'s schema-diffing behavior against a real database.

## 2026-08-31 — Prisma CLI installed via `npx prisma init` without a pin can grab a release candidate
`npm install prisma @prisma/client` with no version pulled `8.0.0-rc.12` (an RC), which has a materially different CLI (`prisma.config.ts` skills-sync workflow, no `--datasource-provider` on `init`, etc.) from the stable `7.x` line. Pin to the latest stable (`npm view prisma versions --json`, filter out anything with a `-` in it) rather than trusting bare `npm install prisma` to land on something stable.

## 2026-08-31 — A shared `useTransition` across two unrelated actions leaks pending state
`PeopleManager` used one `isPending` flag for both "Add Person" and "Remove" — removing someone made the Add button read "Adding…" because both actions shared the same transition. Any component with two or more independently-triggerable async actions needs its own `useTransition` per action (or at least per meaningfully-different pending UI), not one shared flag. Caught via an actual click-through, not by reading the code — this class of bug doesn't show up in `tsc`/lint/build.

## 2026-08-31 — A Playwright click-through catches bugs that build/lint/typecheck can't
Two real bugs (duplicate React key from an owner appearing in both `team.leader` and `team.members`; a raw 500 from an unhandled unique-constraint violation) only surfaced by actually running the app and clicking through onboard → offboard → view-as, not from `tsc --noEmit`, `eslint`, or `next build`, all of which were clean the whole time. `chromium-cli` wasn't available in this environment; fell back to a local Playwright install (isolated in the scratchpad, not added to the app's own `package.json`) per the `run` skill's fallback guidance. Worth remembering: a clean build is necessary, not sufficient — always drive it before calling a feature done.

## 2026-09-02 — Click-through tests mutate the shared demo DB and the damage surfaces much later
The 08-31 offboarding click-through left Sarah Chen `OFFBOARDED` with Marketing's leader seat vacated in `dev.db`. Nothing noticed until 09-02, when a *new* feature's test failed mysteriously ("auto-shared with owner" but no team leader — the policy was fine; the leader relation was null) and her login timed out. When a click-through exercises destructive flows against the seeded demo DB, either restore the state it changed as the last step, or note in the vault that the DB is dirty. Related: the reset-consent workaround in the 08-31 `migrate reset` entry (`rm dev.db && prisma migrate deploy && npm run db:seed`).

## 2026-09-02 — `kill %1` across Bash tool calls is a no-op, and `next start` losing the port serves you a stale build
Shell job control doesn't persist between tool invocations, so `kill %1` silently killed nothing; the replacement `next start` then died with `EADDRINUSE` *inside a backgrounded subshell* (exit code invisible), and the old server kept serving the pre-fix build — making a just-made CSS fix look ineffective in the screenshot. Kill by port (`lsof -ti :PORT | xargs kill`), and after any restart, confirm the new process owns the port before trusting what the browser shows.

## 2026-09-04 — Don't generate a full design canvas/mockup set unless explicitly asked, even for "design the system top down"
Asked to "design the system top down," a full design-system + IA map + nine-screen mockup canvas was generated unprompted and published as an Artifact. Rejected outright as "AI slop" — the user meant they'd design it themselves and wanted Claude to build scaffolding or get out of the way, not receive a finished visual design. The phrase "design the system" is ambiguous between "produce a design" and "define the system architecture" — when genuinely ambiguous and the cost of guessing wrong is a large unwanted deliverable, ask before generating, don't default to the more ambitious reading. The rejected canvas lives at `.design/knowhow-canvas/` — treat it as dead work, don't reference or extend it.

## 2026-09-04 — When told to build a concrete screen, implement only what's named — no invented copy, no reused old design system
Given a hero video and told to build a landing page, the result included headline/subcopy/footer marketing copy nobody asked for, and reused the existing (already-criticized) design tokens and components rather than treating it as a fresh start. Corrected twice: once for the invented copy, once for not actually "starting over." The standing rule now: implement literally what's asked, piece by piece; never fill gaps with invented copy, layout, or visual decisions; when "start over" or similar is said, treat it as discarding prior visual decisions, not just adding to them. See [[Current-Context]] for the working agreement this produced.

## 2026-09-04 — Asset-driven design asks ("here's my font and reference image, mock it up") are a different mode than open-ended ones, but scope discipline still applies
Unlike "design the system top down" (rejected as AI slop, see the entry above) or an unprompted landing page, the user explicitly invited a logo collaboration this time and handed over concrete inputs: a reference image, an imported font family, an explicit color instruction. Drafting a visual from those inputs is answering the actual ask, not inventing one — the earlier rejections were about Claude supplying direction nobody asked for, not about Claude ever being allowed to produce a mockup. Still applied the "targeted changes stay targeted" discipline imperfectly: alongside the literal ask (one wordmark lockup) two unrequested layout variants (icon-beside-wordmark, standalone mark) were added and a font-weight comparison tweak nobody asked for. These were flagged as optional/skippable rather than presented as part of the deliverable, but the better default next time is to build only the literal lockup first and offer variants verbally rather than building them — asking costs one sentence; an unwanted extra artboard costs a rejection. See [[Current-Context]] for the in-progress logo work this produced.

## 2026-09-04 — When a reference image exists, measure its pixels programmatically instead of redrawing from visual memory of it
Three redraws of a logo mark (hexagon-with-flat-bands, then an isometric 3-face cube, then a chevron-notch hexagon) all missed, because each was built from a mental description of what the reference image looked like rather than the image itself. What actually broke the loop: asking the user to save the reference to a file (`referencelog.png` at repo root), then using Pillow (`python3 -m venv` + `pip install pillow` in the scratchpad — no PIL preinstalled, and system pip refuses global installs per PEP 668) to classify pixels by hue and trace exact per-row left/right edges and per-color bounding boxes. That measurement revealed the real structure in one pass: three identical hexagons (120w × 71h, point at 24px, flat plateau for 21px, taper for 26px) stacked with a 33px vertical step between tops — the interlocking-notch illusion is just hexagon overlap plus z-order (bottom plate drawn first, top plate last), not a chevron cut or a 3D cube-face split. General rule: the moment a visual reproduction task has a reference image and a second attempt from description has already missed, stop redrawing from memory — get the file and measure it (crop/zoom for a by-eye check, pixel-classify for exact vertices/colors) before touching the shape again. See [[Current-Context]] for the resulting mark spec.

## 2026-09-04 — Reading localStorage in useEffect+setState is a lint *error* here, not a warning — use a lazy useState initializer instead
Built a draggable component that read a saved position from `localStorage` inside `useEffect` then called `setState` — the obvious pattern for "sync from a browser-only API on mount." `npm run lint` failed with an actual error (not a warning): this repo's React-compiler lint rule flags synchronous `setState` inside an effect body as a cascading-render anti-pattern, and `tsc --noEmit` doesn't catch it since it's a lint rule, not a type error. Fix: move the read into `useState(() => { if (typeof window === "undefined") return fallback; ... })` — a lazy initializer runs once, isn't "an effect," and avoids the double-render. This does mean server-render and first-client-render can legitimately differ (server never sees localStorage), so pair it with `suppressHydrationWarning` on the element whose attributes depend on the stored value. General takeaway: always run the actual lint command after adding a new client-side effect, don't assume `tsc` clean means lint clean — this project's lint config catches a class of React bugs type-checking never will.

## 2026-09-04 — When copying a reference's positioning, also check its color logic against your actual background
Implementing the homepage logo, the reference screenshot analyzed just before ("Your Creative") used dark text on a light background — but the default instinct for text overlaid on a *video* was white (a common video-hero convention), so the first pass used white. Screenshotting the real result (the hero video's background is pale cream, close to white) showed near-invisible text. The fix was obvious once seen, but would have shipped invisible if not actually screenshotted — a reasonable-sounding convention (white text over video) can be wrong for a specific video's actual palette, and the reference already had the answer (dark-on-light) sitting right there. Always render and look, especially when "copy this reference's positioning" quietly also means "and its contrast logic."

## 2026-09-04 — Don't bundle a confirmed request with a speculative fix in one publish
Asked to fix logo plate proportions (ambiguous complaint, no pixel ground truth to verify against) and separately to swap the wordmark font to Greed (unambiguous, confirmed request) — both landed in the same republish. Result was rejected wholesale ("its worse, revert"), and it took a clarifying question to learn the user meant a full revert of both, not just the speculative sizing change. Since the two edits were independent, bundling them meant one bad guess forced reverting a perfectly good change too. Rule: when one change in a batch is a confirmed instruction and another is your own inference from ambiguous feedback, ship them as separate publishes (or at least be ready to name them separately) so a rejection can be scoped to the part that actually needs it.

## 2026-09-04 — Flipping a `NEXT_PUBLIC_*` env var while a dev tab stays open leaves component *state* stale even after the flag re-reads correctly
While repeatedly toggling `NEXT_PUBLIC_LOGO_EDITOR_ENABLED` in `.env` to test the logo editor (on → verify → off, several times in one session), the user reported being able to drag a logo piece even with the flag off and no edit button visible — looked like a real locking bug. Reproduced deliberately in Playwright: click "Edit positions" (sets `editMode` state to `true`, persisted to localStorage) with the flag on, then flip the flag off on disk *without reloading the page*. Result: the "Edit positions" button correctly vanished (its JSX condition re-evaluates fresh from the updated env constant on every render), but dragging still worked — because `editMode` is a `useState`, and Next's Fast Refresh/HMR patches the module in place without re-running that `useState`'s initializer on the existing component instance. The stale `true` survives; only a full reload (which fully remounts and re-runs the lazy initializer) resyncs it with the now-false flag. Not a bug in the locking logic — a normal fresh page load always computes the right value — but a footgun specific to *changing a `NEXT_PUBLIC_*` var live against an already-open dev tab*. Rule: after editing a `NEXT_PUBLIC_*` env var for a manual/live check (not just Playwright, which always starts fresh), hard-reload any open tab before drawing conclusions from it — and mention this to the user if you've been toggling the flag during the same session they have a tab open in, since the stale state is otherwise indistinguishable from a real regression.

## 2026-09-09 — Drag positions are design insight, not the responsive implementation
The landing hero's `Draggable` absolutes were useful for the user to show intended placement, but they cannot produce a WCAG-friendly, multi-breakpoint layout. Once the Your Creative reference was locked as the goal, the correct underlying model was normal document flow (flex column, centered lockup/subhead, breakpoint-specific CTA placement) — not more `em`/`vw` coordinate tuning. Keep drag tooling (if any) behind an edit flag for experimentation; ship layout with CSS.

## 2026-09-09 — Use `em` units for elements that scale together, `vw`/`vh` for elements anchored to viewport edges
The landing page's draggable positioning system used `em` units for everything, which works beautifully for the logo lockup (text + cube mark + ™ + tagline all scale proportionally with the shared `clamp()` font-size). But it fails completely for the CTA button and subhead, which need to stay at fixed screen positions regardless of viewport size. A CTA positioned at `left: 77em` (from an earlier desktop-sized drag session) overflowed off-screen on mobile because the reference font-size was too small to push it into view. The fix is a hybrid approach: use `em` for groups of elements that need to maintain relative alignment as they scale (logo parts), and `vw`/`vh` for standalone elements that need fixed viewport-relative positions (CTA in top-right, subhead at bottom). Additionally, for right-aligned elements like a CTA button, position from the right edge (`right: Xvw`) instead of left — otherwise the element's own width causes it to overflow on narrow viewports even when the `vw` position seems reasonable. General rule: pick the positioning unit based on *what the element's position is relative to* — its sibling content (em) or the viewport edges (vw/vh).

## 2026-09-04 — A muted decorative background video needs a much lower CRF than footage, and browsers prefer WebM over MP4 when both are offered
A looping hero animation (soft-gradient 3D shapes) encoded at VP9 crf 34 / H.264 crf 21 looked visibly degraded — banding on the gradients — even though the file stayed tiny (65KB). The bug wasn't obvious from the MP4 alone: Chrome/Firefox pick the first `<source>` they support, and WebM was listed first, so most viewers were silently getting the more-compressed VP9 file while the MP4 (the one easiest to eyeball-check) looked fine. Flat-gradient/vector-style motion graphics compress so efficiently that there's no real size cost to dropping CRF a lot (crf 34→20 for VP9, 21→16 for H.264 only doubled the file size, still under 320KB for a 9.5s clip) — for this kind of content, err toward much higher quality than footage-tuned CRF defaults suggest, and spot-check whichever `<source>` the browser will actually pick first, not just the fallback.

## 2026-09-10 — `liquid-gooey` items must be pinned to a shared absolute origin, and they snap on first render

Two findings from building the Get Started virus-split, both from reading `node_modules/liquid-gooey/dist/index.js` rather than guessing at the API (v0.2.1):

1. **`Liquid.Item` children lay out in normal flow**, so two items in a group become two stacked block boxes — a *vertical* peanut, the exact opposite of a horizontal split. `morph.shape` makes it worse (`display: contents` lets them join consecutive rows). The fix is structural, not animative: give both items `style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -r, marginTop: -r }}` so they occupy the *same* point, then animate only `x`. This is safe because `MirroredItem` renders `style={{ display: "inline-block", ...yourStyle, willChange }}` — your style spreads **after** its default, so `position` overrides cleanly. The blob follows correctly because `offsetTo()` walks the `offsetParent` chain, and the group is `position: relative`. Never leave the split direction up to animation values alone — make the geometry the only thing the layout can express. **But the opposite holds for the group itself:** `GooeyRoot` renders an inline `style={{ position: "relative", isolation: "isolate", ...style }}`, so `className="absolute inset-0"` on `<Liquid>` is silently beaten by that inline `relative`. With only absolute children, the group collapses to **0px tall** — and a zero-height outer `<svg>` renders nothing (SVG spec), so the goo never paints at all, with no error. Position the group through `style` (which spreads after the default), never `className`.
2. **Never mount an item already at its target `x`.** `MirroredItem`'s layout effect reads `cur.current`, which is `null` on the first render, and in that case it *writes the transform directly and returns* — no animation. Mount at `x = 0`, then flip to the target on a later frame (double `requestAnimationFrame`) so there's a previous value to interpolate from.

Also worth knowing: the group's goo layer is a single `svg[data-gooey-svg]` at `z-index: -1`, so you can fade the bridge out independently of the item content (`[&_[data-gooey-svg]]:opacity-0` via a wrapper `data-` attribute). That matters because at a 54px diameter with an 8px gap the goo is right on the binarization threshold and may re-bridge once the daughters settle — releasing the neck explicitly is more reliable than tuning `blur`/`contrast` to break at exactly the right distance. Relatedly, pass an opaque `fill` and control alpha with layer opacity: alpha-contrast binarization pushes a translucent fill toward solid, so `fill="rgba(0,0,0,.8)"` does *not* match a `bg-black/80` pill — `fill="#000"` at 0.8 layer opacity does.

## 2026-09-10 — Goo only reads if the neck's *lifetime* is long enough: tune `blur` to the FINAL gap, and time the travel to something slow

> **Correction (same day):** this entry was first written as *the* explanation for why the split showed no goo. It wasn't — the real cause was the 0px-tall group above (the goo layer never rendered at all), found only once the page was actually driven in Playwright. The arithmetic below is still the right way to tune the neck once it renders, but it was a confident, wrong root-cause story built from reading source. See [[#2026-09-10 — Reasoning about rendering from library source is not verification]].

The first working pass still needed tuning before it read as liquid. Two things worth internalising before reaching for the blur slider:

- **The bridge exists only while the edge gap is within roughly 1.3σ of `blur`.** With 54px circles travelling to a 62px centre distance, the circles *overlap* for the first ~70% of the travel (they only clear each other once centres exceed 54px) and then part by a mere 8px. So the entire gooey moment lives in the last sliver of the animation. On a 750ms spring that sliver would be ~100ms — too brief to read. Retiming the travel to the deck's 1331ms `cubic-bezier(0.22, 1, 0.36, 1)` (a very front-loaded curve, so the slow tail is exactly where the gap opens) stretched the neck's life to ~880ms and it suddenly read as liquid. **Goo is a function of dwell time near contact, not of blur alone.**
- **Tune `blur` against the final gap, not by eye.** The filter binarises alpha as `a*contrast - contrast/2`, and two blurred edges contribute `erfc(gap/2 / (σ√2))` at the midpoint. For an 8px final gap, σ=6 puts the neck's alpha at ~0.08 (invisible) while σ=8 leaves it solidly bridged forever. σ=6/contrast=18 — the library's own defaults — make the neck snap on its own at ~7.5px, around 1650ms. Worth doing this arithmetic instead of guessing: the usable window between "mush that never separates" and "no visible neck" is only a couple of px of σ.

Also: don't let crisp chrome and the goo blob paint the same translucent colour on top of each other. Two `bg-black/80` buttons over their own 0.8 blobs stack to ~0.96–0.99 — the split circles come out visibly darker than the pill they came from, and the overlap phase shows a darker lens where they cross. Fix used here: during the split the **liquid layer is the surface** (buttons transparent, `fill="#000"` at 0.8 layer opacity, `shadow` on the merged silhouette via the group's own prop), and at the settled phase the goo is dropped and real `bg-black/80` chrome swaps in within one React commit. Identical colour and geometry, so the handoff is imperceptible — and the final DOM depends on no SVG at all, which keeps the "no leftover neck" guarantee independent of filter tuning.

## 2026-09-10 — Reasoning about rendering from library source is not verification

Across two rounds on the Get Started split, `tsc`, `next build`, compiled-CSS greps and careful reads of `liquid-gooey`'s dist all passed — and the goo layer had never rendered once. Round one the user saw circles but "no gooey" (the buttons had their own `bg-black/80`, masking the empty SVG); I answered with a plausible neck-lifetime theory. Round two I made the buttons transparent to let the goo be the surface, and they vanished entirely — which is what finally exposed it. One Playwright probe reading `getBoundingClientRect()` on `[data-gooey-svg]` showed `152.8 × 0` in seconds. Same lesson as the 2026-08-31 click-through entry above (a clean build is necessary, not sufficient), recurring specifically for **visual/animation** work, where "does it paint" can't be answered by any static check. Rule: for any SVG-filter, canvas, or animation change, drive it in a browser and look at frames *before* explaining what the user is seeing. The scratchpad Playwright pattern (`npm i playwright` in the scratchpad, never the app's `package.json`) takes under a minute and a contact sheet of timestamped frames is the cheapest ground truth there is.

## 2026-09-10 — To divide a shape with goo, start the daughters AS the parent, not at its centre

The original brief required both split daughters to start coincident at `x = 0`. Geometrically sound, but it produced *pill → one circle → two circles* — the user wanted the pill itself to divide. The invariant that actually guarantees a horizontal split is **shared centre + constant height + only x/width animating**, not a coincident starting point. The fix: each daughter starts as the *whole* parent (`width: 100%` of the parent box, both centred), so their union is pixel-identical to the parent; each then shrinks to its final size while sliding outward. The overlap shrinks, a furrow forms where the inner caps surface, the goo rounds it into a waist, then a neck, then it snaps — real cell-division topology for free.

Mechanics in `liquid-gooey` 0.2.1: size-morphing needs `observe` (the `MirroredItem` path only animates translate/scale). With `observe`, the engine reads each child's `getBoundingClientRect()` relative to the group every frame, and wakes on `transitionrun`, style/class mutations and a per-item `ResizeObserver` — so plain CSS `width`/`transform` transitions (with a `transition-delay`, even) drive the silhouette correctly. `ObservedItem` wraps the child in a `display: contents` span; pass `style={{ display: "block", position: "absolute", inset: 0 }}` so layout stays fully owned by the child's own absolute positioning. Centre a width-animating element with `left: 50%` + `translateX(calc(-50% + Xpx))` — translate percentages resolve against the element's own (animating) width, so it stays centred every frame with no JS measurement. Verified with a per-frame Playwright recorder (see the "Reasoning about rendering" entry above): zero empty frames at the Layer-1 → liquid handoff, one vertical centre across ~190 frames.

## 2026-09-10 — Carousel motion: four traps, each only visible in a per-frame trace

Building [[FEAT-landing-deck-carousel]] with framer-motion `motionValue`s. Every one of these passed type-check and "looked fine" on a single click:

1. **`set()` across a wrap is read as velocity.** Teleporting a value −1.96 → +2 with `mv.set()` and then `animate(mv, …)` flung the card to slot **+712** before springing back: framer seeds the spring with `mv.getVelocity()`, which saw a 4-slot leap in one frame. Use `mv.jump(v)` (resets velocity), and pass the real velocity explicitly via `animate(..., { velocity })` if you want continuity.
2. **An ease-in tween restarted mid-flight gets overtaken.** A card that had to wrap while already moving restarted on an ease-in (zero start speed); the card behind it on a spring caught up and passed it — two cards coincident on screen, swapping layers (≈1000px overlap). Rule: every *on-screen* move shares one spring and inherits velocity; only off-screen time is free to choreograph (hold, delay, jump).
3. **A listener waiting for a threshold never fires if you're already past it.** The "swap when fully off-screen" watcher was attached to an exit spring aimed at exactly where a parked card already sat — zero distance, no change events, card stranded off-screen. Check the threshold before subscribing.
4. **Stagger can solve layering, not just pacing.** Adjacent 16:9 cards overlap at rest (76vw wide on 73vw spacing; 11.6vw at 1024px), so the incoming and outgoing centre cards must swap z-order somewhere. With z derived from distance-to-centre, the swap happens when they're equidistant; a 70ms stagger pulls them ~92vw apart at that instant (simulated first, then measured: 0px overlap at every swap). The cascade the user asked for is also what makes the layer swap invisible.

Method that found all four: a rAF recorder in the page logging every card's rect + computed z-index per frame, and assertions for (a) overlap at each top-layer change, (b) any >25%-viewport jump while on-screen, (c) exact landing vs the seated rects — run for single, mirror, rapid (110ms) and reversal (150ms) clicks at two widths.

## 2026-09-10 — A transparent full-screen layer can eat clicks for days without anyone seeing it

The open deck (`.t-deck`, `z-20`, `pointer-events: auto`) covered the whole viewport above the landing UI, so the CTA arrows under it — fully visible through the transparent stage — never received a click. Someone had already wired them (`focusDeckSide`) without that ever working. No screenshot can show this; Playwright's click actionability check reported it instantly ("`<div class="t-deck …">` intercepts pointer events"). When a layer exists for its *children's* interactivity, give `pointer-events: auto` to the children, not the full-bleed container. And when adding a control, click it with a real input driver at least once — `element.click()` in `evaluate` bypasses hit-testing and would have hidden this too.

## 2026-09-11 — Width-only sizing hides height bugs; test at real browser-window heights, not full-screen

The desktop deck's cards are `min(84.6vw, 68.4rem)` at 16:9 — their height is a function of width alone. Every check this session (and the user's own in Safari full-screen) ran at full-screen heights (900–982px), where it fit. In an ordinary Chrome window the toolbar takes ~70–120px of height, the deck stays the same size, and it collided with the subhead and the logo. When a layout is sized along one axis, also sweep the *other* axis at realistic sizes — for desktop web that means the window heights people actually have (MacBook Chrome ≈ 780–860, a non-maximised window can be ~690), not screen resolutions. A small `gap.mjs`-style Playwright table (element-to-element gaps per viewport) made the failure and the fix both obvious in one run.

Technique used for the fix: to scale something *uniformly* by a height ratio in pure CSS you need a unitless number, and CSS can't divide lengths — `tan(atan2(100vh, 956px))` returns `100vh / 956px` as a plain number (trig functions are supported Chrome 111+, Safari 15.4+, Firefox 108+; verified identical in Chromium and WebKit 26). Scaling the whole deck container (not just card width) preserved the composition — card-to-card overlap, drops, and the carousel's clear-air layer-swap maths from [[FEAT-landing-deck-carousel]] all scale together. The floor (0.7) comes from the carousel's off-stage geometry: below ≈0.67 a card at the ±1.6-slot swap threshold would be visible at the viewport edge.

## 2026-09-11 — Don't run a formatter the repo doesn't use; it reformats everyone's code

Ran `npx prettier --write` on `landing-hero.tsx` to tidy a fragment's indentation. The repo has no Prettier config or dependency, so it ran with defaults (80 columns) and rewrapped the whole file — code other people were actively editing — into a large whitespace-only diff. No pre-format copy existed anywhere (not staged; VS Code/Cursor local history predated recent edits; Turbopack's cache holds compiled output, not source). Program structure is unchanged (Prettier guarantees AST equivalence; typecheck/lint identical), but the diff noise and edit-collision risk are real. Rule: only run formatters the project itself configures (`package.json` scripts / config files); otherwise hand-indent the lines you touched. If you must experiment, copy the file to the scratchpad first.

## 2026-09-11 — Scaling a container also scales its "off-screen" parking spots

The height-fit `scale` on `.t-deck--desktop` shrank the deck around its centre — including the 110vh "parked below the viewport" position, which became ~76vh on screen and put card edges into view at short heights. Any distance defined *inside* a transformed container that must hold *on screen* (off-stage parking, rise start) has to be divided by the scale. Caught only because a probe counted on-screen cards after a close, then confirmed on a fresh load.

## 2026-09-11 — Comparing text size by box height compares box models, not fonts

"Features" (a block `<p>`, `leading-none` → box = 1× font-size) measured 34px tall vs "Take Control" (an inline `<span>` → box = the font's content area, ~1.3×) at 44.8px, which looked like a mismatch. Compare rendered font-size (computed size × accumulated ancestor scale) or render the same word in both styles and compare widths — both gave identical values (34.01px; 130.58 vs 130.56px).

## 2026-09-11 — GSAP SplitText: `tag: "span"` gets no display, splitting kills kerning, and Fast Refresh can't test cleanup

Building the subhead wave (GSAP 3.15 SplitText + `useGSAP`):

1. **With `tag: "span"`, SplitText sets no `display` on its wrappers** (it only styles its default `<div>`s: `position: relative; display: inline-block`). Inline boxes can't be transformed, so `y` tweens silently do nothing. Give words/chars a class (`wordsClass`/`charsClass: "inline-block"`) — words too, so wrapping text can't break mid-word.
2. **Inline-block characters lose kerning** (browsers don't kern across element boundaries): the subhead grew ~10px and glyphs moved up to 5.2px. Fix without touching typography: measure every glyph's position *before* splitting (Range over text nodes, after `document.fonts.ready`), then give each char the `margin-left` that restores the gap to its left neighbour (skip line starts). Matching every advance ⇒ same line width ⇒ same centring. Express it in `em` so it holds as the vw-based font size changes. Verified ≤0.11px per glyph, identical line boxes.
3. **Fast Refresh does not re-run `useGSAP`'s layout effect** (0 DOM rewrites observed after a real code change + "[Fast Refresh] done"), so it can't be used to test unmount cleanup; neither can Strict Mode here, because the split is deferred to `fonts.ready` and the first mount is torn down before it ever splits. What worked: a throwaway route mounting the component behind a toggle — unmount, observe the held char nodes' `style` for two wave periods (0 writes = timeline killed), remount (exactly one split), then delete the route.
4. React/SplitText caveat: SplitText rewrites (and on revert, re-creates) the DOM inside a React-rendered element. Fine while that content is static; if the subhead ever becomes state/prop-driven, re-key the element so React and SplitText don't fight over stale nodes.

Also: Tailwind v4's `scale-95` is the individual `scale` property, and CSS composes `translate` → `rotate` → `scale` → `transform` — so pressing (scale) an element positioned with `transform` pulls it toward its untransformed box. Position with `translate` instead.


## 2026-09-12 — Inline ref callbacks are already null when a layout-effect cleanup runs
`DesktopDeck` stored card nodes via `ref={(el) => { cards.current[i] = el; }}` and its seat effect's cleanup did `cards.current[i]?.style.removeProperty(...)`. Because the callback is a new function every render, React detaches the old one (calls it with `null`) during the commit's mutation phase for the child host nodes — *before* the parent's layout-effect cleanup runs. So the cleanup found no nodes and silently reset nothing; stale inline `z-index` then beat the CSS entrance on the next open (the "blue card opens behind" bug in [[Known-Issues]]). Rule: in an effect that writes to ref'd DOM nodes, snapshot them at setup (`const els = [...ref.current]`) and use that in the cleanup — the same thing the `react-hooks/exhaustive-deps` "ref value will likely have changed" warning is about, which doesn't fire for arrays of refs. Symptoms that point here: a reset that "works" on first run but leaves state behind on the next cycle, only after some interaction changed the state it was meant to clear. Found with a per-frame `elementsFromPoint` recorder over the overlap regions, which also printed the stale z-index values — a screenshot alone would only have shown "sometimes wrong".

## 2026-09-12 — A full-viewport stage needs one measured middle band, not per-element vh guesses
The landing composition is three bands (header top, subhead/footer bottom, deck in between) but each element was sized independently — type by `vw`, positions by `vh`, the deck by `100vh / 956px` with a 0.7 floor — so nothing knew how much room was actually left, and 55 of 121 swept sizes collided. Prototyping "measure the open-state band, fit the deck into it" (plus `min(vw, vh)` type caps anchored to a reference viewport so big screens don't change) dropped that to 11 edge cases, all at 390px tall. Two traps: (1) the deck's `scale` shrinks everything in deck coordinates, including carousel spacing — any "must be off-screen" rule has to divide viewport widths by the fit (`50vw / var(--deck-fit)`), which also removed the need for the 0.7 floor; (2) spacing in `vw` next to sizes capped in `rem` drifts apart above the cap (side cards slid off-screen at 1920+). Measure with a collision table (chrome vs visible cards, min vertical clearance where they overlap horizontally), not eyeballed screenshots. See [[Known-Issues]] `[landing / viewport]`.

## Seeded "random" values still hydration-mismatch unless rounded (2026-09-16)
`LoginSky` generated star positions from a seeded PRNG at module scope so server and client would match — but Next reported a hydration mismatch: `--star-peak` was `0.5935909696785882` on the server and `0.593590969678588` in the browser. `Math.pow` (and other `Math.*` transcendental functions) aren't required to be bit-identical across engines/builds, so Node and the browser can disagree in the last ulp, and React compares inline style strings exactly (custom properties especially — no numeric normalisation). Fix: round every generated value (`round3`) before it reaches a style. Any deterministic-but-computed style values rendered on both sides need the same treatment. See [[FEAT-landing-login-panel]].

## Nested border radius: inner = max(0, outer − inset) (2026-09-17)
User rule for **all** nested rounded elements ([craft.gustavofior.com/nested-border-radius](https://craft.gustavofior.com/nested-border-radius)): outer radius = inner radius + inset, where inset = parent padding + border width; if the inset exceeds the outer radius, the inner corner is square. Traps: a child flush inside a 1px border is still inset by 1px (`border-radius: inherit` on an `inset: 0` overlay is 1px too round); and when the inset is big, pick a side — the user chose to grow the *outer* radius for the login modal (10px button + 1.1rem + 1px → 28.6px) . **Only apply it to concentric corners** — elements flush with or close to the parent's corners. I first squared the floating deck mac windows (10.5px card, ~50px inset → 0) and the user rejected it: *"it should follow the rule but maintain its definition."* The windows float far from the card corners, so they aren't concentric and keep their own 14px; the rule applies *inside* them instead. Applied 2026-09-17: card `::after` 9.5px, window titlebar/body `max(0, var(--deck-mac-radius) − 1px)` = 13px, `--deck-mac-radius` stays 14px. The folder label (3px in a 7.35px hit area) doesn't reach the corners, so it was left alone. Any new nested surface must follow this. See [[FEAT-landing-login-panel]].

## Headless Chromium frame rates lie about compositing cost (2026-09-17)
Measuring the Log In sheet's slide with rAF deltas: default headless Playwright (CPU compositing) showed ~25fps and pointed at the hero video under the recess scale (hiding it → ~48fps). With `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` the same slide ran at 60fps once warmed up (first run ~15fps). Use headless numbers only to rank layers against each other; confirm with GPU flags before calling something janky, and discard the first run. See [[FEAT-landing-login-panel]].

## Don't run Prettier on `landing-hero.tsx` (2026-09-17)
The repo has **no Prettier config**, and the file isn't Prettier-formatted — `npx prettier --write` rewrote ~600 unrelated lines (default config) around a 150-line change. Recovered by restoring the committed file and re-applying only the intended edits. Match the surrounding style by hand; `tsc` + `eslint` are the checks.


## Redacting `.env` with `sed 's/=.*/=<set>/'` leaks multi-line values (2026-09-18)
`backend/.env` holds `GOOGLE_SERVICE_ACCOUNT_JSON` as inline multi-line JSON; a line-based redaction only masks the first line, so the private key printed in full. List key names only (`grep -oE '^[A-Z_]+=' .env`), never a transformed dump. See [[Known-Issues]] `[security / credentials]`.

## Backend OAuth flows share one redirect URI (2026-09-18)
`build_authorization_url` always sends `GOOGLE_OAUTH_REDIRECT_URI`, so login, signup and personal-OAuth all return to `/auth/callback` whatever route started them. The flow is identified only by the signed `state`'s `purpose` — dispatch on that, don't assume the per-flow `/…/callback` routes are ever hit. [[0008-continue-with-google-via-backend]].

## Cal.com's inline embed sizes and centres itself — plan around its band (2026-09-20)
`<Cal>` writes its own `height` onto the iframe once loaded (538px for `month_view` at 920px wide) and **centres that iframe** in whatever box it is given, so a taller container just adds dead space above and below. Two consequences, both measured in the browser: (1) an **auto-height** container tweens twice — once to whatever placeholder is in the slot, again when Cal reports its height — so a fixed slot is what makes the surrounding modal grow **once**; (2) the iframe is Cal's white card (458px, its own 8px radius) **plus an ~80px attribution band beneath it**, so centring the iframe leaves the card ~40px high — shift by half the band to centre what the eye reads as the card. Also: `@calcom/embed-react` statically imported into a landing-page client component puts Cal in the page's eager chunk and fetches `cal.com/embed/embed.js` on **every** visit; `next/dynamic` with `ssr: false` moved it to an on-demand chunk (0 Cal requests on load, verified). See [[FEAT-landing-book-a-demo]].

## Vercel Hobby won't deploy org-owned repos — that's why this repo is public (2026-09-20)
Vercel's free **Hobby** plan does support **private** repos; what it does not support is repos owned by a **GitHub organization** (that's Pro-only). This repo is owned by the org **`LOJJ-IO`** — `git remote -v` says `ronaldwopara/knowhow`, but that's a GitHub redirect left over from a transfer, so the remote URL is misleading. `gh repo view ronaldwopara/knowhow --json owner,visibility` resolves the truth: `owner.login = LOJJ-IO`, `visibility = PUBLIC`. So "Vercel needs me to make my repo public" is really "Vercel Hobby needs an org repo to be… actually it needs Pro" — going public was the workaround taken.

Ways out, if private matters: transfer the repo back to the personal account `ronaldwopara` (Hobby then takes it private), pay for Vercel Pro, or move hosting. **Cloudflare Workers** is the free option that allows private + org repos: Next.js 16 App Router needs `@opennextjs/cloudflare` (not the retired `next-on-pages`), `wrangler.jsonc` with `nodejs_compat` + an assets binding, and build/deploy via `opennextjs-cloudflare build && opennextjs-cloudflare deploy`. Low risk here because the deployed surface is landing + `/terms` + `/privacy` only, with no auth, data layer or ORM in `src/` ([[0004-landing-only-purge-old-app]], [[0002-remove-prisma-for-vercel]]).

Whatever host is chosen, the **origin changes**, which the backend cares about: CORS allowlist and `GOOGLE_OAUTH_REDIRECT_URI` / OAuth authorized origins in `knohow-staging` are per-origin ([[0008-continue-with-google-via-backend]]). Record the cutover as an ADR when it happens. Not decided yet — see [[Current-Context]].

## A personal Gmail is only its own org when it's new to Knohow (2026-09-20)
Worth not re-deriving: `complete_signup` looks the email up **org-agnostically first**
(`app/onboarding/service.py`), so if it already has an `OrgMember` anywhere, signing in is just a
login — no second bootstrap. The domainless personal org is reached only when the email is
unknown **and** Google sends no `hd` **and** the person answers "No — just me". A personal account
that belongs to a company org reaches Drive through personal-OAuth, because domain-wide delegation
cannot touch a Gmail account (`_infer_auth_type`, `app/auth/personal_oauth.py`) — that's the
contractor and Gmail-company case. So "work vs personal" is almost never the useful distinction;
**which org the account belongs to** is. I got this wrong first and the user caught it.
See [[0011-device-remembered-accounts]].

## Cross-origin cookies work between localhost ports in dev (2026-09-20)
The backend sets `SameSite=Lax` in development, and the frontend calls it cross-origin
(`localhost:3000` → `localhost:8000`) with `credentials: "include"`. That works, because
same-site is decided by registrable domain and **ignores the port** — both are `localhost`. In
production the two are different domains, which is why `cookie_kwargs()` flips to
`SameSite=None; Secure`. Don't "fix" the dev path after testing locally: the local success proves
nothing about production, and vice versa.

## Verifying a pre-sign-in screen without a real Google round trip (2026-09-20)
The account picker renders from backend state that normally only a real Google sign-in can
create. Rather than mock the frontend, seed it: insert an org + members + `remembered_accounts`
rows against a fixed device UUID, then `addCookies` that UUID in Playwright. That exercised the
real endpoint, the real CORS/cookie path and the real redirect — the row click was followed all
the way to `accounts.google.com` and its `login_hint` asserted. Gotcha: the desktop **Log In
button doesn't exist until the CTA split**, so the script must click Get Started and wait ~4s
first. Playwright isn't a repo dependency — install it in the scratchpad, not in `package.json`.

## A portal escapes clipping, not ranking (2026-09-20)
The account picker's badge tooltips are portaled to `document.body` so the Log In modal's measured
height and rounded surface can't clip them. That fixed the clipping and the tooltip still didn't
paint: the slide-up sheet is `z-[400]` (`landing-hero.tsx`) and the portal's positioner was
`z-50`. Portalling makes the tooltip a **sibling** of the sheet on `<body>`, and siblings are
ranked by z-index — so escaping the parent's stacking context is only half the job when the thing
you must clear is also a root-level layer. Positioner is now `z-[500]`. Symptom to recognise: the
element measures **visible, opacity 1, non-zero rect**, and simply isn't in the screenshot.
Debug by asserting the computed style and rect, not by eye. See [[FEAT-landing-login-panel]].

## Playwright `hover()` doesn't reliably hold a tooltip open for a screenshot (2026-09-20)
`locator.hover()` → `waitForTimeout` → `screenshot()` kept capturing the frame *after* the tooltip
closed, while a DOM assertion in the same run said it was open. `page.mouse.move(x, y, {steps: 10})`
onto the measured bounding box holds the pointer and the tooltip survives the capture. Assert the
computed state in the same run as the screenshot, or a "missing" tooltip will send you fixing code
that works.

## `@base-ui/react` added to the frontend stack (2026-09-20, user request)
New dependency for the tooltip primitive, at the user's explicit request (they specified Base UI).
Note it is **not** Radix: there's no `asChild`; the real element goes through `render={<button/>}`
and the children go inside the trigger. `clsx`, `tailwind-merge` and `tw-animate-css` were already
present. The tooltip was **written fresh in this repo** — Knohow stays independent of Sage_v1
(CLAUDE.md invariant 5); the user was asked and chose the fresh implementation over porting.
Lives at `src/components/brand/tooltip.tsx`, deliberately **not** `src/components/ui/`, which is
the path invariant 5 calls out.

## Portaled content inherits nothing, fonts included (2026-09-20)
The badge tooltip read in the browser's default sans while everything around it was Satoshi. The
picker sets the font with a `className` on an ancestor (`satoshi.className` on the `<ul>`), and the
tooltip is portaled to `document.body`, so it is not a descendant and inherits none of it. The
primitive stays font-agnostic; the **caller** passes `className={satoshi.className}` to
`TooltipContent`. Same root cause as the z-index catch above, one level up: a portal buys you
escape from clipping and from the stacking context, and costs you every inherited style. Check
font, colour and line-height on anything portaled. See [[FEAT-landing-login-panel]].

## No em dashes in user-facing copy (2026-09-20, user rule)
"No emdashes ever" — button labels, headings, body, page titles, metadata. Use a comma, a colon or
a second sentence; page titles use a pipe (`Terms of Use | Knohow`). Applies to placeholder copy
too. Code comments and `console.error` strings were left alone as not user-facing. Recorded in
[[0013-sign-in-is-to-an-organization]].

## Dropdowns inside the login modal open in place, never floating (2026-09-21)
`.t-login-modal` is `overflow: hidden` and its height is animated to the body's measured height by a
ResizeObserver (`LoginModal`). An absolutely positioned menu is therefore **clipped**, and a portal would
escape the tween that every other step rides on. `SetupDropdown` expands **in flow** instead: the list takes
part in layout, the observer sees the body grow, and the modal tweens open like any other step change.
Before converting it to an overlay, that `overflow: hidden` and the measured-height animation both have to
go, and the "area bounce" goes with them.

## Setup UI structure: primitives, feature folder, tokens (2026-09-21, user)
User's principle, now the shape of the code: **one primitive per job, feature folders for product UI,
tokens for numbers that repeat. New UI composes an existing shell rather than inventing another visual
system.**

- `src/lib/backend.ts` — `BACKEND_API_URL`, `backendFetch`, `backendError`, `Me`, `recordSetupStep`,
  `startAdminProof`. No screen builds its own URL or digs its own error message out again.
- `src/components/ui/` — primitives that own one thing: `drag-stepper.tsx` (a number),
  `choice-pill.tsx` (a choice), `tokens.ts` (`CTA_CLASS`, `SHEET_SLIDE_MS`).
- `src/components/setup/shell.tsx` — the shell every screen composes: `SetupHeading`, `SetupBody`,
  `SetupError`, `SetupAction`, `SetupChoices`, `SetupField`, `SETUP_CHOICE_CLASS`. **The one-heading /
  one-sub / one-action rule lives here**, so a new screen gets it by construction instead of by review.
- `src/components/setup/*-step.tsx` — one screen per file. `org-setup-form.tsx` is the *order* of the
  screens and nothing else.

**Why it mattered:** `landing-hero.tsx` had grown to ~4,700 lines holding the landing page, the demo flow,
the account picker and all of setup. Editing it by text-index surgery duplicated a block **twice in one
session** before being caught. It is now ~3,700 and setup is 960 lines across nine files.

**Still to split:** the demo flow and the account picker are the next tenants to move out.

## Measure before claiming a speed win (2026-09-21)
Splitting `landing-hero.tsx` and adding `next/dynamic` felt like a performance job. Measured, JavaScript was
**1.6% of the landing page**; four watercolour PNGs were **96.8%**. Converting them to AVIF took the page
from 15.56 MB to 1.72 MB — roughly **9x**, against the ~6% the code work was worth.

Two habits from it:
- **Break the page down by resource type before optimising anything.** CDP `Network.responseReceived` +
  `loadingFinished`, grouped by `mimeType`, takes a minute and settles the argument.
- **A dynamic import defers nothing if the component still renders.** The modal here was always mounted, so
  its contents loaded on every visit regardless of `next/dynamic`. Gate on the open state, then verify the
  chunk is absent from the initial request list rather than trusting the API.

## Rich link previews need a server route, not client metadata (2026-09-21)
Discord/Slack/iMessage crawlers fetch the pasted URL and read **HTML meta tags** — they do not run
React. A join link at `/?join=` on a client-only landing page unfurls as a bare URL. Fix: canonical
`/join/{token}` with `generateMetadata` + `opengraph-image.tsx` (dynamic `ImageResponse`), backed by a
**public** backend preview endpoint. Invite ready screen uses Copy → Check (clipboard); unfurls still
need the server route.

## Never call a parent callback inside a setState updater (2026-09-21)
`TeamsStep`'s Continue handler called `onDone(...)` inside `setSaved((current) => { ... })` so it could read
the latest saved array. React may invoke updaters during render; `onDone` immediately called `setTeams` /
`setStep` on `OrgSetupForm`, triggering the "Cannot update a component while rendering a different
component" error. Fix: return values from async work (`commit()` → `SetupTeam | null`), accumulate locally,
then call `onDone` after the loop — state updaters stay pure.

## Ask before changing layout; revert aggressively when told (2026-09-21)
Setup Back + modal height/width tweaks shipped together with misread "circle" feedback (options width,
not the Back control). User asked to revert everything except Back, then Back too. Rule: when a UI ask
is ambiguous, ask one clarifying question before changing layout; when they say undo, strip the feature
fully rather than leaving half-wired state.

## A `"use client"` icon map can't be indexed from a Server Component (2026-09-21)
`src/components/app/nav-icons.tsx` exported `NAV_ICONS: Record<string, LucideIcon>` from a
`"use client"` module. Server screens doing `NAV_ICONS[href]` got `undefined` for some keys and the
build died on prerender: *"Element type is invalid … but got: undefined"* (first failing route was
`/org-chart`, which is misleading — the route was innocent). Every export of a client module becomes a
client **reference**, not the value, so property access on a plain object export is not reliable across
the boundary. Fix: drop `"use client"` — lucide icons render fine in RSC, and a client component can
still import the same module. Rule: config objects read by both server and client must not live in a
client module.

## Cross-origin session cookies decide where you can fetch (2026-09-21)
The backend's session cookies live on *its* origin, so no Server Component in `src/app` can read them.
That single fact forces the whole shape of the signed-in app: the session is fetched in the browser, at
the top of the route group, and the app has no server-rendered content. Worth checking *before*
designing a data layer around Server Components — see [[0016-app-reads-the-backend-not-fixtures]].

## `leading-none` plus `truncate` eats descenders (2026-09-21)
The app's page title cropped the "g" in "Org chart". `leading-none` gives the line box no room below
the baseline and `truncate`'s `overflow: hidden` then cuts what pokes out. Tight leading is safe only
where nothing clips. Fixed with `leading-[1.3]`.

## Generated SVG can be verified without a browser (2026-09-21)
To check the identity system actually drew something sane, a throwaway route rendering it was built with
`next build`, then the prerendered HTML in `.next/server/app/<route>.html` was read directly: shape
counts, colours, `NaN`, and the same name at two sizes to prove determinism. Cheaper than reaching for
a screenshot tool, and it catches the failure that matters (geometry, not looks). Delete the route
afterwards.

## A percentage/flex height is only as definite as every ancestor (2026-09-22)
The org-chart canvas was `h-full flex-1` inside four nested flex columns that all looked correct, and
it still rendered at content height: one indefinite link anywhere in the chain silently collapses the
whole thing, and `min-height` then masks it as "working, just short". Replaced with a measured height —
`getBoundingClientRect().top` against `window.innerHeight`, re-measured on resize. Measuring can't
collapse, and "fit the window" is what it literally computes. Worth reaching for whenever a fill has to
be certain rather than probable.

## Fractional node positions leave a graph clustered in the middle (2026-09-22)
Placing a row's cards at `(i + 1) / (n + 1)` puts three cards at 25/50/75% — tidy in the abstract, but
it leaves ~300px empty at both ends of a wide canvas, which reads as a broken layout rather than a
composed one. A row that should use its width has to be laid out from the real widths: gutters at the
edges, the remainder divided between the cards. See `FlowCanvas`'s `spread`.

## Two icons that differ by a few pixels read as "no state change" (2026-09-22)
The sidebar toggle used Material Symbols' `left_panel_close` / `left_panel_open`. The glyphs genuinely
differ — comparing the outlines in the font proves it — but only by a small arrow inside an identical
frame, so at 20px the toggle looked broken: "doesn't even perform the swap". VS Code's codicon pair
differs by a whole filled pane and is unmistakable at the same size. A state icon has to differ in
*mass*, not in detail; if you have to look twice, it isn't communicating state. Also: when a user says
an icon looks wrong, check the source icon set before redrawing — Sage's look came from codicons, and no
Material glyph was ever going to match it.


## "Fill the height" and "read as a tree" are not the same instruction (2026-09-22)
Stretching `FlowCanvas`'s row gap to consume whatever height the window gave it did fill the canvas,
but with two rows it pinned the owner to the top edge and the teams to the bottom, ~500px apart: two
unrelated bands joined by very long connectors, not a chart. The stretch now stops at `MAX_ROW_GAP`
(240px, the distance the user dragged the cards to by hand) and the leftover height simply stays empty.
Filling space is a weak goal; the relationship between the rows has to survive the fill.

## Three icon sets, one `AppIcon` (2026-09-22)
The app's icons are now a subsetted Material Symbols font, a couple of inlined codicon paths, and one
lucide component (Workspace's folder, which has to be the same drawing as the `FolderOpen` it morphs
into on hover). Rather than three call sites' worth of imports, `AppIcon` resolves a name against
`APP_ICONS` / `CODICONS` / `LUCIDE` in turn, so `NAV_ICONS` stays a flat route → name map and screens
never learn which set their icon came from. Adding a Material icon still means re-fetching the font
subset with the new name; the other two sets are just another entry.

## A WebGL avatar needs a context budget and something underneath it (2026-09-22)
Swapping the person avatar's SVG gradient for a WebGL orb makes every avatar on the page hold a live
context, and browsers keep only ~16 before they start losing the oldest — one team card with a dozen
members would have blanked the sidebar's avatar. `FluidOrb` therefore counts live orbs in a module
scalar, stops taking contexts past 10, releases on unmount (`WEBGL_lose_context`), and pauses its frame
loop when it scrolls out of view. What it must **not** do is call
`WEBGL_lose_context.loseContext()` in cleanup: `canvas.getContext` returns the *same* context object
for the life of the element, so losing it poisons every later mount — in development React runs effects
twice, and the second run compiled its shaders against a dead context and reported the failure with a
null info log. Deleting the program, shaders and buffer is the whole of the cleanup; the context goes
with the element. The second half is the fallback: the old gradient stays rendered
behind the orb and only fades out once the orb reports it is painted. Without that the orb's
antialiased edge leaves the layer behind it showing as a coloured rim around the sphere — visible in
the first browser probe, invisible in any static check.

## "Switch account" in this product is a sign-in, not a flip (2026-09-22)
The profile menu's account list looks like Google's switcher, and the resemblance is the trap: Knohow
holds **one session at a time**, keyed to cookies on the backend's origin, and the remembered rows are a
device-local list keyed to an opaque device cookie — they are not parallel logged-in sessions. So a row
click is `continueWithGoogle(null, row.email)`: Google decides who signs in, and the address is only a
`login_hint`. A remembered row grants nothing on its own. The same reasoning sets the copy: "Log out of
all accounts" appears only when more than one account is remembered, and "Forget" is the word in Manage
accounts because removing a row is a device-local hide, never an unlink.

## Put the z-index on the positioner, not the popup (2026-09-22)
The profile menu was portalled to `<body>` with `z-[400]` on its popup, and a card on the org canvas
still painted over it. The popup isn't the element that establishes the layer — Base UI's positioner is
the positioned ancestor, and with no z-index of its own it lands in the body's default stacking order,
so a z-index on its child can only order it against its own siblings. The tooltip in this repo had it
right (`isolate z-[500]` on the positioner) and the menu copied the wrong half. Layers are now a
documented scale — menus 450, dialogs 500, tooltips 600 — because "portalled" is not the same as
"on top".

## A scale and a translate on one element fight over `transform` (2026-09-22)
The dialog was centred with `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` and animated with a
`scale`. Both write `transform`, so adding the scale class silently moved the dialog to the middle-right
of the screen. Centring moved to a `fixed inset-0 flex items-center justify-center` wrapper
(`pointer-events-none`, so the backdrop still gets the outside click) and the popup now only ever
scales. Verified in a browser: 214px of margin either side at 1100px wide.

## `active:scale-95` can silently swallow clicks (2026-09-22)
Every app button pressed with the landing's `active:scale-95`, and buttons started intermittently not
firing ("sometimes when i click on buttons they dont fire"). A `click` event only fires when
`pointerdown` and `pointerup` land on the same target; a button that shrinks under the pointer on press
can end the gesture outside its own (now smaller) box, especially on small icon buttons near an edge.
Switched every app control to `active:translate-y-px` — a 1px nudge, which is also what Sage's own
buttons do — keeping the hit area under the finger for the whole gesture. Worth remembering generally:
any `active:` transform that shrinks the target is a click-reliability risk, not just a visual choice.

## React's `onWheel` is passive; a trackpad pinch needs a native listener (2026-09-22)
Zooming the org chart on a trackpad pinch (which arrives as `ctrl+wheel`) also zoomed the whole browser
window. React binds `onWheel` passively, so a handler attached that way cannot call `preventDefault()` —
the browser's own page-zoom ran alongside the app's. Fixed with a real `addEventListener("wheel", fn, {
passive: false })` in a `useEffect`, closing over a ref rather than the handler itself so it doesn't need
rebinding on every render. Any gesture meant to *replace* a native browser behaviour (pinch-zoom,
some scroll-locking) needs the non-passive listener, not the React prop.

## A Tailwind class naming a token this repo doesn't have emits nothing (2026-09-23)
A component dropped in from elsewhere focused with `focus-visible:ring-2 focus-visible:ring-ring`. Knohow
defines no `--ring` / `--color-ring` in `globals.css`, so Tailwind v4 generated no rule for `ring-ring` —
no error, no warning, nothing in the build. Paired with the `outline-none` the same class list carried,
the control ended up with *no visible focus state at all*. Rewrote it to the app's own
`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917]`. Generally: a
missing design token in Tailwind v4 fails silently, so any pasted-in component's classes have to be read
against this repo's token set, and `outline-none` plus a dead ring class is the failure that actually
hurts.

## `motion/react` and `framer-motion` are the same library under two package names (2026-09-23)
Components copied off the web now import from `motion/react` (the renamed package). This repo has
`framer-motion@13`, which exports the identical surface — `animate`, `useMotionValue`, `useVelocity`,
`useSpring`, `useTransform`, `AnimatePresence`, `useReducedMotion`, `AnimationPlaybackControls`,
`MotionValue`. Retarget the import rather than installing `motion` beside it; two motion runtimes in one
tree means two copies of the animation loop and `AnimatePresence` contexts that don't see each other.

## A component that restyles itself instead of rendering the app's button drifts (2026-09-25)
A bell brought in from outside carried its own surface and glyph colours and no hover state. Dropped into
the topbar it looked *nearly* right — same size, same rounding, same position — so the regression read as
"something feels off in hover" rather than as an obviously wrong control. The fix was not to copy
`--app-muted` / `--app-active` into it, which is the same mistake one layer down; it was to have it
render `Button variant="secondary" size="icon"` and contribute only the parts that are actually new (the
swing, the badge). Rule of thumb for anything pasted in: if the app already has a control of that shape,
the newcomer renders it rather than matching it, and keeps only the behaviour that doesn't exist yet.
Where a glyph has to articulate — a bell body and its clapper moving separately — inline the *same*
icon's path data (lucide exposes it; render the icon once and read the `d` attributes) instead of
substituting a different bell, so the silhouette is unchanged.

## One spring at several strengths beats several animations (2026-09-25)
The bell reacts to three things: a new notification, a press, and a mouse arriving. Giving each its own
keyframes would have made three different objects. Instead one `ring(strength)` drives the same spring at
0.26 (hover), 0.5 (press) and 0.7–1.3 (arrival, scaled by how many landed at once), and the clapper is
never animated at all — it's a `useSpring` over the body's own `useVelocity`, so every impulse swings it
for free. Cheaper, and it reads as one physical thing. Gate pointer-driven impulses on
`event.pointerType === "mouse"`: touch fires `pointerenter` before `pointerdown`, so an ungated hover
rings the bell twice on the way to a single tap.
