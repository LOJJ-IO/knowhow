---
type: context
status: active
tags: [priority/high, area/frontend, area/backend]
created: 2026-08-31
updated: 2026-09-04
related: ["[[0001-mocked-data-first-prototype]]", "[[FEAT-org-chart-builder]]", "[[FEAT-doc-visibility-dashboard]]", "[[FEAT-doc-creation-auto-share]]", "[[FEAT-onboarding-offboarding-automation]]", "[[Known-Issues]]"]
---

# Current Context

## Active priority (as of 2026-09-04 — supersedes the demo-prep priority below)
The user is rebuilding the entire frontend themselves, from scratch, screen by screen — this is **not** a Claude-driven redesign. Claude's role narrowed sharply after two corrections in one session (see [[Lessons-Learned]], 2026-09-04 entries): a generated design-system/IA/screens canvas was rejected outright as "AI slop," and a follow-up landing-page build was corrected twice more for inventing marketing copy and reusing old design tokens/components instead of genuinely starting fresh. Working agreement going forward: **implement only what is explicitly asked, one piece at a time; never invent copy, layout, or visual decisions; ask rather than fill gaps.** The user also asked that second-brain be updated after every change, without exception — not just "non-trivial" ones.

## What's true right now (2026-09-04)
- `/` (`src/app/page.tsx`) is just the full-bleed looping hero video (`public/hero/onboarding-loop.{mp4,webm}` + poster, converted from `V1-Draft.mp4`; see [[Lessons-Learned]] for the encoding gotcha) — no logo, no nav, no buttons, no copy. Logged-in visitors still redirect straight to `/dashboard`. (Nav/logo were added then removed at explicit request — see [[Lessons-Learned]] 2026-09-04 entries; don't re-add without being asked.)
- `/login` (`src/app/(auth)/login/page.tsx`) and `/dashboard` (`src/app/(app)/dashboard/page.tsx`) were deliberately cleared to blank placeholders at the user's explicit request, to give a clean slate for their own rebuild. **This is intentional, not a bug**: login renders nothing (no form — signing in through the UI does not currently work), dashboard keeps only its `requireUser()` auth guard and renders nothing. Do not "restore" either without being asked.
- Everything else from the 2026-09-02 pass (org chart, team pages, settings, activity, the doc-visibility/auto-share engine) is untouched and still uses the old design system — the user has not asked for those yet.
- A generated design canvas (`.design/knowhow-canvas/`, published as an Artifact) was rejected by the user as not what they meant — they want to design the system themselves. Do not reference or extend it; treat it as dead work.

## Demo-prep priority (2026-09-02, now superseded but kept for reference)
- Demo flow works end-to-end as owner (`owner@acme.test`), leader (`sarah.chen@acme.test`), and member (`mike.ross@acme.test`): login → org chart → owner dashboard (search, create-with-audience, auto-filing panel, per-team boards) → member dashboard (create → auto-share receipt → My Recent Work) → leader/owner see the doc arrive → activity feed logs it.
- New schema field `Document.sharedWithEveryone` (owner broadcasts); visibility rules centralized in `visibilityWhere()` in `src/lib/queries.ts`.
- `dev.db` has minor click-through residue — see the demo-data entry in [[Known-Issues]] for the pristine-reset command.
- Most of the 2026-09-02 work was committed mid-session by something outside this Claude session (commits `88b1130`, `3d61b6a` — likely the user's IDE); the sidebar sign-out contrast fix and these vault updates are still uncommitted.

## What was true from the first build pass (2026-08-31)
- Repo: `/Users/user/knowhow` (local only — no GitHub remote yet, ask before creating one). Not related to Sage_v1 except as the conversation it spun out of — see [[0001-mocked-data-first-prototype]].
- Stack: Next.js 15 App Router (TypeScript, Tailwind v4), Prisma 7.10.0 + `@prisma/adapter-better-sqlite3` (SQLite), custom cookie-session mock auth. See [[Architecture-Overview]].
- Design language ported from Sage's frontend (grayscale oklch tokens, pill buttons, same radius scale) per explicit user request — hand-rolled `ui/` primitives, not a shared dependency.
- All core routes shipped and verified via a real click-through (Playwright, since `chromium-cli` wasn't available in this environment): `/login`, `/signup`, `/org-chart`, `/dashboard` (role-branched), `/team/[teamId]/people`, `/activity`, `/settings`.
- Onboarding/offboarding engine (`src/lib/workspace.ts`) is real: adding/removing a person actually mutates the DB (sharing policy application, document reassignment, access-revoke simulation) and writes to `ActivityEvent` — only the actual Google API calls are mocked. See [[FEAT-onboarding-offboarding-automation]].
- `npm run build`, `npx tsc --noEmit`, and `npm run lint` are all clean.
- Demo login: any `@acme.test` address (see `prisma/seed.ts` for the roster — owner is `owner@acme.test`), password `knowhow-demo`.
- Two real bugs found and fixed during the click-through pass (duplicate React key on the owner dashboard; unhandled duplicate-email 500 during onboarding) plus one UX bug (shared pending-state label) — see [[Known-Issues]] and [[Lessons-Learned]] for details.
- second-brain vault seeded for this repo, mirroring Sage's structure/conventions (see [[README]]).

## Logo/brand-mark collaboration (2026-09-04, in progress)
Distinct from the hands-off frontend rebuild above: the user explicitly invited Claude into this one, with concrete assets, so it's not scope creep to draft from them. Given: (1) a reference image of a hexagonal stacked-plate "cube" mark — blue top plate, middle plate split green/yellow, red bottom plate, thin gaps between; (2) a Söhne (`sohne-font-family/` at repo root, "Test" trial `.otf` files — not licensed for production, fine for drafting) font import; (3) explicit instruction to keep the Google-palette colors already in `src/app/globals.css` (`--gblue`/`--ggreen`/`--gyellow`/`--gred`) and drop navy entirely from the mark.
Exploration published as an Artifact: <https://claude.ai/code/artifact/79a0d832-1a06-4234-baf7-d6eb3ec056b8> — a `Main` lockup (the literal ask: wordmark with the mark inline, light + dark backgrounds, Söhne weight tweak) plus two unsolicited bonus layout variants (icon-beside-wordmark, mark-alone/app-icon) flagged to the user as optional/skippable, not the deliverable.

Three redraws from a description of the image missed (see [[Lessons-Learned]] 2026-09-04 "measure pixels, don't redraw from memory"). The user then saved the actual reference to `referencelog.png` (repo root — untracked scratch file, not yet cleaned up) and it was pixel-measured directly. **Confirmed mark spec**, not a guess: three identical hexagons (each 120 units wide, 71 tall — 24px point-to-shoulder taper, 21px flat-side plateau, 26px shoulder-to-point taper), stacked with a 33-unit vertical step between each hexagon's top point, drawn back-to-front as red → green/yellow (split at the vertical centerline) → blue, each with an 8-unit white stroke (`stroke-linejoin: round`) — the interlocking-notch look is pure hexagon overlap + z-order, no chevron cut or isometric cube-face split. Exact colors sampled from the reference: blue `#4285F4`, green `#34A853`, yellow `#FBBC05`, red `#EA4335` (standard Google brand hex — close to but not identical to the app's existing oklch `--gblue`/`--ggreen`/`--gyellow`/`--gred` tokens; worth a decision on which wins before this lands in code). Tried widening the stack step (33→45 units, to make the middle plate look less small relative to top/bottom) and swapping the font to **Greed** (Frost Type Foundry TRIAL, dropped at `greed-font-family/` at repo root, Standard width) in the same publish — user called the result worse and asked for a full revert of both. Reverted to the pixel-verified 33-unit-step hexagon geometry and Söhne, confirmed clean (no leftover Greed/wide-step references) before republishing. Lesson: don't bundle an unverified fix (the step change, a guess at their sizing complaint) with an unrelated confirmed request (the font swap) in one publish — if the bundle gets rejected, it's ambiguous which part failed and costs a round trip to disambiguate (see [[Lessons-Learned]]). Both `sohne-font-family/` and `greed-font-family/` are untracked trial fonts at repo root, not yet licensed for production. Still open: whether the plate-size complaint needs a different fix than the reverted one, and final placement (inline between "Kn"/"how" vs. beside the full wordmark) — don't build this into `src/components/brand/logo-mark.tsx` until the user confirms.

## Still open
1. **Frontend rebuild is mid-flight and user-driven** — `/login` and `/dashboard` are blank placeholders; the rest of the app still has the old design. Wait for explicit per-screen direction; don't get ahead of it.
2. Commit the tail of the 2026-09-02 demo-prep work (sidebar sign-out fix + vault updates) when the user says so; most of it was already committed mid-session (see above).
3. No GitHub remote — ask before creating one if the user wants it pushed.
4. Real Google OAuth + Admin SDK domain-wide delegation is still fully mocked — needs a GCP project + Workspace admin consent that only the user can provision (see [[0001-mocked-data-first-prototype]]).
5. "View as" has no permission check — demo-only, flagged in [[Known-Issues]], must not ship past prototype as-is.
6. SQLite is a prototyping choice — migrating to a real Postgres instance is an open follow-up decision, not yet made.
