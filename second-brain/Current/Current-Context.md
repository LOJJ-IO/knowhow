---
type: context
status: active
tags: [priority/high, area/frontend, area/backend]
created: 2026-08-31
updated: 2026-09-22
related: ["[[FEAT-legal-pages]]", "[[FEAT-landing-book-a-demo]]", "[[FEAT-landing-deck-carousel]]", "[[FEAT-landing-header-nav]]", "[[FEAT-landing-deck-notes-folder]]", "[[0004-landing-only-purge-old-app]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[Patterns-landing-mc-recess-deck]]", "[[Known-Issues]]", "[[Architecture-Overview]]", "[[FEAT-workspace-onboarding-flow]]", "[[FEAT-drive-file-classification]]", "[[0006-observed-domain-tenant-identity]]", "[[0007-shared-drive-support]]", "[[0008-continue-with-google-via-backend]]", "[[0009-contractor-work-created-as-the-org]]", "[[0010-deletes-go-to-trash-30-days]]", "[[0011-device-remembered-accounts]]", "[[0012-identity-linking-one-person-many-accounts]]", "[[0013-sign-in-is-to-an-organization]]", "[[0014-org-setup-and-join-link]]"]
related: ["[[FEAT-legal-pages]]", "[[FEAT-landing-book-a-demo]]", "[[FEAT-landing-deck-carousel]]", "[[FEAT-landing-header-nav]]", "[[FEAT-landing-deck-notes-folder]]", "[[0004-landing-only-purge-old-app]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[Patterns-landing-mc-recess-deck]]", "[[Known-Issues]]", "[[Architecture-Overview]]", "[[FEAT-workspace-onboarding-flow]]", "[[FEAT-drive-file-classification]]", "[[0006-observed-domain-tenant-identity]]", "[[0007-shared-drive-support]]", "[[0008-continue-with-google-via-backend]]", "[[0009-contractor-work-created-as-the-org]]", "[[0010-deletes-go-to-trash-30-days]]", "[[0011-device-remembered-accounts]]", "[[0012-identity-linking-one-person-many-accounts]]", "[[0013-sign-in-is-to-an-organization]]", "[[0014-org-setup-and-join-link]]", "[[FEAT-core-app-screens]]"]
---

# Current Context

## Repo root cleanup (2026-09-20)
Removed ~15MB of tracked root duplicates of assets already under `public/deck/` and `public/hero/` (`blue/green/red/yellow/folder.png`, `signinbg.png`), deleted unused Create-Next-App SVGs in `public/`, deleted root `LOGO.otf` (identical to `src/fonts/logo/LOGO.otf`), and moved business/scratch media into `docs/business/` (projections PDF + PNG, BCW proposal, `V1-Draft.mp4`). App paths unchanged (`/deck/…`, `/hero/…`). Font trial folders remain gitignored at root. Root [`README.md`](../../README.md) replaced the create-next-app boilerplate with a short Knohow + frontend/backend run guide (backend section split into safer copy-paste blocks 2026-09-20 after a `cd`→`d` paste failure at repo root).

## Book a Demo — team size step (2026-09-20)
After "Who's this for?", Skip/Continue → **"How many people on your team?"** with chips `1` · `2–5` · `6–20` · `21–50` · `51–100` · `100+` (3×2 grid, skippable); then Cal. [[FEAT-landing-book-a-demo]].

## Book a Demo — abandoned recovery (built 2026-09-20)
**Counting starts** when Continue validates the work email (website field appears) → `demo_leads`. After **`DEMO_RECOVERY_IDLE_SECONDS`** (default 20 min) idle in the demo sheet, one Resend from **`noreply@knohow.app`**. Includes Cal until booked. Cancel on reopen / email CTA / Cal book. Resume: `/?demo_resume=<token>`. Migration `0012_demo_leads`; scheduler every 1 min. Local test: set `DEMO_RECOVERY_IDLE_SECONDS=60` and restart uvicorn. **APScheduler noise silenced 2026-09-21** (`apscheduler*` → ERROR in `logging_config`; job `coalesce` on wake) — only `jobs.demo_recovery_sent` when mail goes out. Full rules [[FEAT-landing-book-a-demo]].

## ✅ Backend merged into `main` (2026-09-15)
The FastAPI backend — auth/identity (Google OAuth login, domain-wide delegation, personal-OAuth fallback, encrypted token storage, tamper-evident audit log, Google API retry/backoff) plus org chart, sharing/ownership engine (TransferBatch dry-run/execute/reverse), activity detection, and DeepSearch — was merged from `backend/auth-foundation` into `main` on 2026-09-15 (user go-ahead: "merge into main"). `backend/` now lives on `main` as a second, independent codebase (Python/FastAPI) alongside the Next.js app — see [`AGENTS.md`](../../AGENTS.md)/[`CLAUDE.md`](../../CLAUDE.md), updated to drop the pre-merge standing reminder. Full reasoning and integration contract in [[0004-fastapi-backend-for-auth-and-identity]] and the "Backend integration contract" section of [[Architecture-Overview]].

**Still not deployed.** Merging the code is not provisioning it: GCP project `knohow-staging` exists (2026-09-18, [[0008-continue-with-google-via-backend]]), but no Railway/Postgres instance and no OAuth verification review submitted yet ([[Known-Issues]]). `src/lib/` (the Next.js app) still mocks Google Workspace entirely per [[0001-mocked-data-first-prototype]] — that invariant is unchanged by this merge, it only narrows for `/backend`. Wiring the frontend to call the backend, and actually provisioning GCP/Railway, are separate asks — don't start either without the user requesting it.

## Continue with Google wired (2026-09-18)
User chose **real sign-in via the backend** over a mocked one — [[0008-continue-with-google-via-backend]]. GCP project `knohow-staging` + OAuth client exist (Google accepts the client + `localhost:8000/auth/callback`); delegation authorization in a Workspace is unverified. Button → `${NEXT_PUBLIC_BACKEND_API_URL}/onboarding/signup` (`.env` / `.env.example`, `http://localhost:8000`). Backend fix: `/auth/callback` now routes signup state to `complete_signup`. **Local Postgres (2026-09-18):** Homebrew `postgresql@16` on the default **port 5432** (`brew services`, trust auth). An unused EnterpriseDB PostgreSQL 16 install was removed by the user the same day (no backup, never used; only macOS-protected empty container folders remain under `/Library/PostgreSQL/16/Library`). `backend/.env` `DATABASE_URL` → `localhost:5432/knohow`; role + DB `knohow` created; `alembic upgrade head` → `0002_org_engine_schema` (18 tables). Backend venv: `backend/.venv` (Python 3.12). Run: `cd backend && .venv/bin/uvicorn app.main:app --port 8000 --reload`. Full sign-in not yet tried by the user. After sign-in the landing looks unchanged — no signed-in UI yet. Service-account key rotated 2026-09-18 (new `95d725a7…`, loaded from a file path in `backend/.env`) — [[Known-Issues]].

## Contractor ownership decided (2026-09-18)
Contractors' work is company-owned by being **created as the org through Knohow** (automation account via delegation, contractor gets edit access) — [[0009-contractor-work-created-as-the-org]]. Decided, not built; needs delegation + an automation account per org, and the deferred contractor-scope questions answered first. Also corrected: per-file transfer from a personal account isn't possible. Contractor actions: create, edit, share, delete. **Every Knohow delete → Drive Trash, recoverable 30 days, then gone** ([[0010-deletes-go-to-trash-30-days]]). Owner approves a **scope**; contractor gets a **blank workspace**; entry = **sponsor's email invite link**. Scope set by the owner or an employee; contractor starts right away. Scope = files, folder, team or project; only a **team** scope needs owner approval. Contractor model now fully specified in [[0009-contractor-work-created-as-the-org]] — not built.

## To build (decided, not built) — started 2026-09-18
- ~~**Book a Demo abandoned recovery**~~ — **built 2026-09-20** — [[FEAT-landing-book-a-demo]].
- **Projects** — a way to create a project and group files into it (across folders and teams). Nothing in Knohow has this concept yet; needed before a contractor scope can be a project ([[0009-contractor-work-created-as-the-org]]).
- **Contractor model** — sponsor invite links, blank workspace, create/edit/share/delete as the org's automation account, scopes (files / folder / team / project; team needs owner approval) — [[0009-contractor-work-created-as-the-org]].
- **Restore from Trash** — every delete goes to Trash for 30 days, so Knohow needs a way to restore ([[0010-deletes-go-to-trash-30-days]]).
- ~~**Domain check**~~ — **built 2026-09-18** (backend): `hd` check, one org per observed domain, auto-affiliated standing enforced, personal-account pending state + domainless org, owner approval, **owner join controls** (pending list, auto-accept Workspace accounts opt-in, nominated owner confirms by signing in) — [[FEAT-workspace-onboarding-flow]] → Technical approach.
- **Identity linking** — one person with several emails (next pass, user 2026-09-18).
- ~~**Admin proof**~~ — **built 2026-09-18** (backend + Yes → check redirect). **User to-do:** enable the **Admin SDK API** in `knohow-staging` and add `admin.directory.user.readonly` to the OAuth consent screen. ~~**"Verify I'm the Workspace admin"** button~~ — **built 2026-09-20** (frontend): "No" / "I don't know" on the Super Admin question now goes to a `verifyAdmin` step (verify → `startAdminProof()`, or Skip for now → closes the sheet) instead of a blank screen; placeholder copy, unverified in a browser (needs backend + real sign-in). Still to design: the `?admin_proof=` **result** screens' real copy.
- ~~**Forwardable invite links** + **delegation guide & detection**~~ — built 2026-09-18 (backend; invite arrival wired in frontend) — [[FEAT-workspace-onboarding-flow]] → "Bottlenecks". Result screens built with **placeholder copy** (all `?admin_proof=` / `?signup=personal` / `?invite=wrong_account`). **One action per screen** is now a user rule. Open admin link (no-email Super Admin invite for team chats) built in backend. Still to design: in-app invite UI (email + open link), delegation guide screen, setup checklist, done screen.
- **Frontend for sign-in results** — ~~owner / Super Admin setup screens~~ built 2026-09-18 with spec wording as placeholder copy ([[FEAT-landing-login-panel]]); still to design: the **done screen** (user will describe), `?signup=personal` question screen, limited-standing / waiting state, owner approval UI.
- **Personal-account screen** (backend ready 2026-09-18) — no `hd` + no invite → ask "Does your company use Google Workspace?" (yes → sign in with work account; no → domainless org); via invite → sponsored join ([[FEAT-workspace-onboarding-flow]] → "Personal account at sign-in").
- **Signed-in screen** — nothing shows after Continue with Google returns (user designs it) — [[0008-continue-with-google-via-backend]].
- **Personal-OAuth callback fix** — same shared-callback bug as signup ([[Known-Issues]]).

## Signed-in app shell built (2026-09-21)
The first logged-in UI exists: route group **`src/app/(app)/`** with a persistent sidebar and one route
per landing-deck feature — `/workspace`, `/oversight`, `/ownership`, `/sharing`, `/org-chart`,
`/offboarding`, `/search`. Decisions the user made by picking: **sidebar + 7 routes** (ElevenLabs /
banking references), **quiet neutral** look (not the soft-card Elera/Hamed look), **mocked fixtures in
`src/`**, and **shell + nav only this pass, then screen by screen**. Empty states follow the **Sage_v1
pattern** at the user's request — one canonical `EmptyState` (icon disc, title, one line, optional
single action) — rebuilt Knohow-native, no Sage code/deps/tokens, so invariant 5 holds. New app-chrome
tokens in `globals.css` (`--app-sidebar-w`, `--app-border`, `--app-muted`, `--app-active`, `--app-dim`).
All screen copy is **draft** (written from each feature's Goal line); the user owns final copy.
`next build` prerenders all 7, eslint clean, **not yet opened in a browser**. Nothing links into it yet:
after `setup_step = done` the founder still lands on the landing page. Full detail in
[[FEAT-core-app-screens]]; the RSC gotcha it cost is in [[Lessons-Learned]].

**Wired in (2026-09-21, after the user reported clicking an account did nothing):** the landing now
sends a signed-in member whose setup is finished to `APP_HOME` (`/workspace`, `src/lib/app-nav.ts`), and
`setup_step === "done"` no longer reopens the setup sheet on its empty branch. Root cause and the full
chain in [[Known-Issues]]. `/workspace` as the post-setup home is still an **assumption** the user
hasn't confirmed.

**Shell restyled (2026-09-21):** sidebar sized off the **X** reference then cut twice at the user's request
(17.5rem → 14rem → 12.6rem → **11.34rem**, 3rem rows, 22px icons; brand row is the landing's full lockup at
1.92rem), layout and type off **Elera** (shared ground with no divider, `--app-ground: #f4f2ee`,
sentence-case section labels, pill active row, page name in a new `Topbar` with search moved there from
the sidebar). Icons are now **Google Material Symbols**, self-hosted and **subsetted to the 7 in use**
(2KB) and addressed by codepoint — details and the re-fetch caveat in [[FEAT-core-app-screens]].
Still not opened in a browser.

**Identities + real data (2026-09-21):** teams and people now have **seeded generative SVG identities**
— [[0015-seeded-generative-identity-system]]. Team icons are abstract geometric compositions from a
fixed vocabulary; people get gradient fields; the name is **only a seed** (no letters, initials or
meaning), and the same name always renders the same icon. Visible in the setup teams-naming step (icon
appears per slot as you type), the "Which teams are you in?" pills, the sidebar's person avatar and the
`/org-chart` cards. The user chose a **deterministic renderer over an image model** for consistency and
cost; the image-model prompt they wrote stays an exploration tool, not the product path.

The app also **no longer uses a fixture** — [[0016-app-reads-the-backend-not-fixtures]]. `/auth/me` and
`/org-chart/{org_id}` are read in the browser (session cookies live on the backend's origin, so a Server
Component can't see them), fetched once in `AppSessionProvider` and handed down by context; signed-out
bounces to `/`. `MOCK_ORGANIZATION_ID` is deleted. `/org-chart` is the first screen on real data.
**Invariant 2 still holds:** nothing in `src/` touches a Google API.

Shell also gained a **sidebar toggle** matching Sage_v1's control: white pill, glyph flips with
state (`left_panel_close` / `left_panel_open`), tooltip Collapse/Expand. Notifications bell has a
tooltip too. Descenders were being clipped by `leading-none` under
`truncate` — fixed on the page title, the org-chart card title and the sidebar section labels.

**Known dev-server wrinkle (2026-09-21):** `/search` 404s on the long-running `next dev` while every
other app route serves; `next build` lists the route and the file is correct, so it is stale dev state.
Restart `next dev` if it shows up.

**Dashboard + org chart graph (2026-09-21):** the user reported that onboarding work wasn't reflected
in the app, then asked that **every onboarding function seed the dashboard**. Done —
[[0018-dashboard-reflects-onboarding]]. New backend read `GET /organizations/{org_id}/overview`
(`org_overview`, plus `list_members`) assembles every answer setup collects in one round trip; new
`/home` screen (now `APP_HOME`, first nav row) shows the org, setup state, owner, Super Admin
confirmation, teams with their generated icons, everyone including people waiting for approval, linked
accounts counted as *people* not accounts, join link state and open invitations. `tests/test_org_overview.py`
covers it (3 tests); backend suite 112 passing. `/org-chart` is now a **graph** — owner on top, teams
spread beneath on a dotted draggable canvas, from a flowchart component the user supplied
(`src/components/app/flow-canvas.tsx`, generic).

**Dialogs (2026-09-21):** Settings is a **dialog**, not a route — [[0017-dialogs-over-settings-screens]],
which also records the dialog taxonomy borrowed from Sage_v1 (one shell; `size` sm/lg/xl; `kind`
form/confirm; scale+fade entrance off Base UI's data-attributes; always-available safe exit). It writes
the two settings that actually have endpoints (org name, auto-accept Workspace accounts), both
owner-only in the backend, and shows the join link read-only.

**Top band + sidebar foot (2026-09-21):** topbar matches the reference — panel toggle, page name, then
search, alerts, New, and the person's generated avatar. The reference's grid icon was left out per the
user. **Alerts and New are not wired to anything yet** (no notifications; nothing to create until
documents exist) — open question in [[FEAT-core-app-screens]]. Sidebar foot is the organization's name (1.40625rem, and it stays in the collapsed rail at 0.75rem rather than disappearing with the labels — which org you are in is the one thing the rail can't say by shape); Help and Settings both live in the
profile menu (2026-09-22). The chart is a **board** (2026-09-22): drag empty canvas to pan, pinch to zoom (a trackpad pinch
arrives as ctrl+wheel; two-finger touch is tracked through pointer events), 0.4–2.5×, zooming about the
point under the fingers. The dots pan and scale with it, and a card drag divides by the scale so it
still tracks the pointer. Home is the chart alone — no summary panel, no stat pills — plus two
`secondary` buttons top right (2026-09-22): **Recent updates**, which replays the pulses for the
**narrowest recent window that holds anything** — last hour, else 6h, 12h, a day, a week (`RECENT_WINDOWS`,
recomputed on each press because it reads the clock). It reads a **new** `recent_changes` feed on the
overview — a week of activity regardless of who has seen it — because `changes` is scoped to the viewer
and `dashboard_seen_at` is stamped on every visit, so from the second visit on there was nothing left
to pulse and the chart looked broken. One pass: the icon shows Pause while it travels
and returns to Play when the last pulse lands, and the **icon alone** goes `--app-play` green
(`#15803d`) for exactly that long. `pulseKey` on `FlowCanvas` remounts every pulse, stagger and all,
and **Manage teams**, whose team marks overlap into a stack and which is **disabled on purpose** until
the screen behind it is specified. Both sit **on** the grid (absolute, top right of a wrapper around
`FlowCanvas` — inside the canvas they would scroll away with the chart) and rest at `--app-active`, the
fill `secondary` normally reaches on hover, because `--app-muted` disappears against the dots. Hover is
a 1.02 lift instead of a colour change. Manage accounts is a **tree** like the Log In picker's remove
screen: linked personal addresses branch under their org, joined by a trunk, because forgetting an org
row and hiding a linked address are different acts and the nesting is what says so.

**Dashboard absorbs the chart and oversight (2026-09-22):** `/org-chart` and `/oversight` are **gone** —
one screen now, [[0019-dashboard-absorbs-chart-and-oversight]]. Owner on top, teams beneath; a caret on
each team card enumerates its members inline (the canvas re-measures, so connectors re-route on their
own); a team that changed since **you** last opened the dashboard carries a count badge and a
highlighted border; its connector sends a **pulse** up to the owner. Changes are read from the
**audit log** (`app/activity/changes.py`), so any action type counts without being enumerated;
attribution to a team is four rules, and anything unattributable stays visible as an org-wide change.
`org_members.dashboard_seen_at` (migration `0016_dashboard_seen`) is stamped **after** the dashboard is
drawn, never before. Pulses fire on **real events only** — quiet is correct when nothing happened, which
is everything today. Backend suite **116 passing**. Canvas rows no longer stretch to the full window
height — the gap between owner and teams caps at `MAX_ROW_GAP` (240px in `FlowCanvas`), so the tree
sits near the top the way the user positioned it by hand, and spare height is left empty. Both cards
run **30% bigger** than the first pass (`OWNER_W` 348, `TEAM_W` 302, padding/avatar/type scaled with
them), so the chart stays one scale. The sidebar toggle keeps **Sage's codicon pair**
(`layout-sidebar-left` / `-off`): lucide's `panel-left` pair was tried so the topbar would match the
sidebar's icon set and rejected — this control is Sage's, and its two states have to differ by a whole
filled pane, not an arrow. The bell beside it is lucide (Sage has no equivalent). The toggle is
otherwise the same control as the topbar's
Notifications button — grey disc, 40px, 20px glyph, `--app-active` on hover — with the white ringed
pill it used to sit in removed. The screen is **Home** now, not "Dashboard" (user
2026-09-22): route `/home`, label "Home", `HomeScreen` in `screens/home-screen.tsx`, `APP_HOME =
"/home"`. The backend keeps its `dashboard-seen` endpoint and `org_members.dashboard_seen_at` column —
renaming those is a migration, not a label. Its nav icon is codicon **home**, whose doorway fills in while the sidebar row is hovered
(`HomeMorph` — the whole glyph pop-swaps on the folder's 600/25 spring, colour unchanged). Every nav row's icon now morphs on hover, one
pattern in `nav-morph.tsx` (`NAV_MORPH`, `AnimatePresence` `popLayout`, scale 0.5↔1, spring 600/25,
supplied by the user): Home's house lights its doorway, Workspace's folder opens, Ownership's shield
gains its check, Sharing's link becomes a send, Offboarding's user gains an X. No row changes
colour: red on Offboarding was tried and taken back out (user 2026-09-22), so the glyph carries the
meaning on its own.
Resting icons are lucide so the still icon is the same drawing that animates (`LUCIDE` in `icon.tsx`),
at `NAV_STROKE` 1.75 to sit with the 400-weight labels. Rows are `px-4` with a `gap-3`, section labels
aligned to the same left edge, and the sidebar's scroll area is `.app-scroll-plain` so macOS's always-on
scrollbar stops painting a divider down its right edge. Windows (the surfaces content sits on: the summary panel, the dotted canvas, empty screens, the loading
placeholder) are **`rounded-[32px]`**, measured off a reference the user supplied rather than eyeballed
— its corner arc traces to ~55px in the image and its type sizes put that image at ~1.6×. Cards *on* a
window keep their own 14px. Every app button now carries the landing's press
feedback (`active:scale-95`, 150ms). Settings turns its gear 180° on hover (spring 400/25) and Help
swaps `CircleHelp` for `MessageCircleQuestion`, both from the same family.

**The profile chip opens a menu (2026-09-22):** `profile-menu.tsx`, a Base UI `Menu` anchored under the
topbar chip and aligned to its right edge so it opens leftward. It holds who you are (orb, name, email
— not a row, there is nothing to switch to), **Settings** (moved out of the sidebar, taking its gear
turn with it), **Help** (a `Menu.LinkItem` on a Next `Link`, since it is a route — still in the sidebar
too) and **Log out**, whose arrow steps through its doorway on hover (`LogOutIcon` — only the arrow
moves, so the icon is drawn from lucide's geometry rather than used as a component) and whose copy
becomes "Log out of all accounts" only when more than one account is remembered. That count includes
linked personal addresses, because they have rows in this list even though the backend carries them on
an org row. The account block is a **submenu trigger**: it opens "Switch accounts"
to its left, listing the same `GET /auth/remembered-accounts` rows the Log In picker uses, a tick on the
current one, then "Add another account" (`continueWithGoogle`) and "Manage accounts"
(`manage-accounts-dialog.tsx` — per-row **Forget**, which is `DELETE /auth/remembered-accounts` and
device-local: the member, the org and the linked identity are untouched, and the row returns on the next
sign-in). **Switching is now instant** (user 2026-09-22, chosen over keeping the Google round trip): `POST
/auth/switch` issues session cookies for any account **remembered on this device** — the device cookie
is the credential, the endpoint refuses anything not in this browser's list, and a linked personal
address (which has no member row) still goes through Google. "Add another account" is the **identity
linking** flow (`GET /auth/link-account/start`), not signup, and that callback now returns to `/home`
instead of the landing — signup was asking a personal address whether its company uses Workspace and
stranding the person on the marketing page. Rows carry the Log In picker's Org / Personal chips (`POST /auth/logout`, then `/`; the backend keeps the device cookie so the
picker still offers the account). The reference had teams, themes, plans and a desktop app; those are
left out because Knohow has none of them.

**Overlay mechanics and layering (2026-09-22):** one motion for every overlay — `.app-modal` in
globals.css, the Transitions.dev curve the user supplied: scale 0.96 → 1 over **250ms** in,
**150ms** out, `cubic-bezier(0.22, 1, 0.36, 1)`, off under `prefers-reduced-motion`. Driven by Base UI's
`data-starting-style` / `data-ending-style`, not an `.is-open` class and a timer. The dialog is centred
by a wrapper rather than a translate, because a scale and a translate on one element fight over
`transform`. Layers: **menus 450 · dialogs 500 · tooltips 600**, and the z-index goes on the
**positioner**, never the popup — that was the "z index is all wrong" bug: a portalled popup whose
positioner has no z-index sits in the body's default layer, where a canvas card painted over it.

**Buttons have a taxonomy (2026-09-22):** [[0020-button-taxonomy]] — one `Button`
(`src/components/app/button.tsx`) on two axes, the same shape as the dialog system's: `variant`
(`default`/`outline`/`secondary`/`ghost`/`destructive`/`link`) and `size`
(`default`/`xs`/`sm`/`lg` plus the `icon-*` mirror), taken from Sage_v1's taxonomy and rendered on
Knohow's own ink and rounding. Adopted by the dialog footers, the settings dialog, the topbar's New and
notifications, the sidebar toggle and the team caret. `FormDialog` now exists beside `ConfirmDialog`, so
both are compositions of `AppDialog`.

**Collapse is a rail, and the sidebar no longer resizes (2026-09-22):** the toggle takes the sidebar to
`RAIL_W` 64px instead of 0, and the drag-to-resize handle is **gone** — two widths, 208 and 64, no
stored preference. In the rail the section groups lose their `mt-6` (there are no captions left for it
to separate, and it read as a hole in the column) and the nav starts `pt-2` under the mark — icons only, centred, labels moved into right-side tooltips, section captions dropped, and
the lockup reduced to the bare `LogoMark` at 18px (the reference puts its mark at ~0.29 of the rail's
width; measured 37px of 129px). One `Row` component renders every entry in both states. The sidebar's
foot is **empty**: the person's avatar, their name and the organization were all removed from it, and
the person now lives only in the topbar's white profile chip (36px orb plus first name). The sidebar no
longer reads the session at all. Home's topbar title is a **rotating greeting** (playful, time-of-day,
weekday, season, short UI lines, favorites weighted), not the screen's name — every line includes the
person's first name in a way that still reads naturally. Picked once per tab in
`sessionStorage`, from the **browser's** clock, and therefore only after hydration. Rainy/cold/sunny
weather lines wait on a real weather signal. Person avatars are **fluid orbs** now (`FluidOrb`, a WebGL
shader the user supplied): one colour per identity from `personColor`, which reuses the old gradient's
seed so nobody's colour changed. The gradient it replaced is still rendered underneath as the fallback
and fades out once the orb reports it is painted — an orb holds a live WebGL context, a page gets ~16,
so past a budget of 10 the avatar is simply the gradient — `AppIcon` now resolves a
small inlined `CODICONS` set as well as the Material Symbols subset, so a route's icon can come from
either set by name.

**Next:** user picks which screen to build first.

## Account picker — Remove link icon (2026-09-21)
Lucide `UserRoundX` before the picker's "Remove account(s)" link only (`gap-[4px]`, same
size/color as the label, underline spans icon + text). Second-screen heading unchanged. Remove
screen lists linked personal emails as their own rows too. See [[FEAT-landing-login-panel]].

## Log In account picker built (2026-09-20)
"Which account today?" — the accounts this browser has signed in with, shown instead of the plain
Log In screen when there are any ([[FEAT-landing-login-panel]]). User's reference was Canva's picker.
Keyed to a **device**, never a person — full reasoning in [[0011-device-remembered-accounts]], which
also records the correction that a personal Gmail is only its own org when it's new to Knohow.

- **Backend:** `remembered_accounts` table (migration `0008_remembered_accounts`, applied locally),
  `app/models/remembered_account.py`, `app/auth/remembered.py`, long-lived `knohow_device` cookie
  set on every successful sign-in (both the login and signup callbacks), `GET`/`DELETE
  /auth/remembered-accounts`, and `/onboarding/signup?email=` → Google `login_hint`. Logout keeps
  the device cookie on purpose. 75 backend tests pass (9 new, `tests/test_remembered_accounts.py`).
- **Frontend:** `AccountPicker` in `landing-hero.tsx` — initial-circle avatars (Google gives us no
  picture; tint is a deterministic hash, **placeholder palette**), **one row per person** with black
  `Org` / `Personal (n)` chips beside the name and the addresses behind a **tooltip** (revised later
  the same day — see below), OR divider,
  "Continue with another account", Terms/Privacy line, "Remove accounts". Light modal, matching the
  existing sheet. Accounts are fetched **on mount, not on open**, so the modal sizes once
  ([[FEAT-landing-book-a-demo]]'s lesson). Copy is **placeholder**.
- **Verified in a real browser** at 1470×956 (Playwright, seeded DB + device cookie): picker renders,
  a row click reaches `accounts.google.com` with the right `login_hint`, "Remove accounts" empties
  the list and falls back to "Log in or sign up in seconds". `tsc`/`eslint`/`next build` clean.
- Seed data from this session was removed when both databases were cleared later the same day
  (see "Sign-in is to an organization" above).
- **Open:** Privacy Policy must describe the `knohow_device` cookie before launch ([[Known-Issues]]).

## Identity linking built (2026-09-20)
The picker repeated a person's name once per account, so the user asked for **one name + chips**.
That needed identity linking, previously "next pass" — built and recorded as
[[0012-identity-linking-one-person-many-accounts]]. **One org account, many personal** (user's
choice); `personal` = any non-Workspace account, so a contractor's Gmail in a company org reads as
personal. Links are **only ever made deliberately** (sign in, then "add another account") — never
inferred from a matching name, which a test guards.

- **Backend:** `people` table + `org_members.person_id` (migration `0009_identity_linking`, applied
  to the dev **and** test DBs), `app/models/person.py`, `app/auth/identity.py`,
  `GET /auth/link-account/start` → shared `/auth/callback` (purpose `link_account`) →
  `?link=linked|already_linked|has_org_account`. Partial unique index `uq_person_one_org_account`
  enforces the one-org rule in the database, not just in the service. `/auth/remembered-accounts`
  now returns **people**, each with `accounts[{email, kind, organization_name}]`.
  **83 backend tests pass** (8 new in `tests/test_identity_linking.py`, against real Postgres).
- **Frontend:** black chips + portaled compact tooltip (`src/components/brand/tooltip.tsx`, new dep
  `@base-ui/react`, written fresh — **not** ported from Sage_v1, user asked and chose that).
  Clicking a person signs in with their most recent account; **no account picking**.
- **Verified in a real browser** (Playwright, seeded DB): four accounts collapse to two rows
  ("Ronald Wopara" with `Org` + `Personal (2)`, "Dana Okafor" with `Org`), and the tooltip shows
  both personal addresses.
- **Not built:** any UI to *create* a link. The endpoint exists but nothing calls it, so in practice
  every person still has one account until that screen is designed. **Next obvious gap.**

## Sign-in is to an organization (2026-09-20, supersedes the person-row picker)
User: *"when people are signing in, they're signing in as an organization"*. The picker's row is
now an **org**, not a person: org name leads, person's name as subtext. Two companies plus a
personal workspace is three rows. Full reasoning: [[0013-sign-in-is-to-an-organization]], which
revises [[0012-identity-linking-one-person-many-accounts]]'s one-org rule and row shape.

- **Backend:** `uq_person_one_org_account` dropped (`0010_many_orgs_per_person`) so a person may
  hold two companies; `person_emails` added (`0011_person_emails`) for a verified address with no
  membership; `/onboarding/link-org-account` (no session needed, reads the pending-signup cookie);
  `/onboarding/personal-org` now takes a `name`. `/auth/remembered-accounts` returns
  `organizations[]`. **84 tests pass**; both dev and test DBs migrated to `0011`.
- **Frontend:** row = avatar + org name + person subtext + one `Org`/`Personal` chip whose tooltip
  holds the address. Personal-account screen: **Yes, link my work account** / **No, just me** →
  name-your-workspace step. **OR divider halved** (user). Tooltip font fixed to `satoshi`
  (portaled content inherits nothing).
- **User rule: no em dashes in user-facing copy, ever.** Applied to the sheet and to the
  `/terms` + `/privacy` page titles (now `|`). Saved to agent memory and [[Lessons-Learned]].
- **Still open:** copy for the personal-account screen (user said the wording has to change but
  didn't finish saying to what); no in-app UI to add another account; a stored `person_emails`
  address is **not** recognised at a later sign-in.
- **Both databases were cleared on 2026-09-20** at the user's request (`truncate ... restart
  identity cascade` over every table in `knohow` and `knohow_test`; schema kept, alembic still at
  `0011_person_emails`). That removed the seed rows **and** the two real sign-ins
  (`rwopara@ualberta.ca`, `rwopara2007@gmail.com`), 7 orgs and 5 audit entries. No
  `oauth_credentials` existed, so nothing needs re-consenting with Google. **Signing in again
  starts the new flow from scratch**, which is the point: the old personal org was auto-named
  "Ronald Wopara" by the pre-0013 code, and the new path asks the person to name it.
- To see the picker without signing in, re-run `seed-picker.py` from the session scratchpad
  (device `11111111-1111-1111-1111-111111111111`). Nothing is seeded right now.

## Remove-accounts screen + linked-address chip (2026-09-20)
- **`?link=` was never wired** (bug, mine): the backend returned `linked` / `already_linked` from the
  day it was built, but nothing read or cleared the param, so a real link left the URL sitting at
  `?link=linked` with no confirmation. Fixed; `link` is now stripped with the other results.
- **A linked personal address had nowhere to show.** Because "yes, I have an organization account"
  creates no personal org ([[0013-sign-in-is-to-an-organization]]), the address lives in
  `person_emails` with no row. It now rides as a **`Personal (n)` chip on the person's org rows**
  (user's choice), addresses in the tooltip. A row that is itself personal gets no extra chip.
- **"Remove accounts" is now a second screen in the modal**, not an immediate wipe: checkboxes,
  org name over email, back chevron, and singular/plural driven by the **list** count. Selective
  removal via `DELETE /auth/remembered-accounts {member_ids}`; the device cookie survives a partial
  removal. See [[FEAT-landing-login-panel]].
- **89 backend tests pass**; tsc/eslint/next build clean.
- **DB state:** the session's seed data was removed again afterwards. `knohow` holds only the user's
  real sign-in - one member (`rwopara@ualberta.ca`), one person, one linked address
  (`ronaldwop@gmail.com`), **zero remembered accounts** (the user had clicked Remove accounts), so
  the picker won't appear until a fresh sign-in.
- **Still open:** the personal-account screen wording the user began describing but didn't finish;
  `complete_signup` ignores `person_emails` ([[Known-Issues]]); no in-app UI to add another account.

## Brand spelling (2026-09-17, user)
The product is spelled **Knohow** in all user-facing text — the logo is *Kn* + hex mark (the "o") + *how*. The repo, folder and vault still say "Knowhow"; don't rename those unasked, but never write "Knowhow" in UI copy, page titles or metadata.

## Org setup copy (2026-09-20)
Owner question is **"Are you the owner of the organization?"** (dropped "/ top"). If No → **"Do you know the owner's email?"** with Yes / No only; Yes → email field; No → skip nomination. Backend allows `is_owner=false` without `owner_email`. Super Admin still has Yes / No / I don't know. [[FEAT-landing-login-panel]] / [[FEAT-workspace-onboarding-flow]].

## Org setup + join link decided (2026-09-20, not built)
**Setup is the next onboarding step for both flows** (Workspace and personal) and is where the org chart
is created. User's shape: create the groups, send **one deep link**, people sign in through it, join the
org, pick a team, enter the app. Security edge cases worked through and locked in [[0014-org-setup-and-join-link]]:
- **First person to sign in from the domain runs setup and owns the org outright** (no proof gate); if that
  was the wrong person, **admin proof takes the org over**.
- Chart at setup = **teams only, no named seats**; people fill in as they join. Teams are **typed in**, and
  **pulled from Google Workspace groups when delegation makes that available** (typing always works).
- Founder's own team is asked **after** the teams exist, "none" allowed. **Team leads are named by the owner
  when approving someone into the team.** Owner, admins, and a team's lead can edit teams afterwards.
- Link is **domain-locked** (org's Google domain only; contractors keep the sponsored path in
  [[0009-contractor-work-created-as-the-org]]), **expires with the owner choosing the lifetime when sending**,
  and is **revocable** (people already in stay in).
- **Picking a team is a request, not a grant** — owner or an admin approves from one pending list.
- While waiting: **in the app but empty**, with a line saying it's with the owner.
- Wrong account at the link → name the expected account, one button to switch. Account already in another
  org → **refuse and explain** ([[0013-sign-in-is-to-an-organization]]).
- Owner sees **who joined, when, and who's pending**. Removal from the chart **revokes the sharing Knohow
  granted** and reports it; Google access granted outside Knohow is stated as out of our reach.
- **Resume, don't restart (user, 2026-09-21):** if an onboarding step hasn't been completed, signing in
  takes the person **back to that step**, never to Get Started. **Not true today** — `signup_redirect`
  (`backend/app/api/routes/auth.py`) redirects to `frontend_origin` with no marker of where they stopped.
  Waiting-for-approval is **not** an unfinished step (those resume into the empty in-app state).
  **Saved as they go** — each team persists as it's typed, so a half-built chart is a real state: setup
  completion is its own flag (not "has teams"), the join link is unsendable until it's set, and a team typed
  by mistake needs a way to be removed.
- **Copy approved 2026-09-21** for every setup + join screen (founder's teams, Workspace-group import,
  founder's own team, link creation/lifetime/ready, all four joiner rejection screens, team pick, waiting
  state, approver list, lead question, resume, removal). Drafted by Claude at the user's request and
  accepted as written; lives in [[FEAT-workspace-onboarding-flow]] → "Copy for setup + join".
Still needed before building: the pending-request state + approver UI +
empty in-app state + link records + team-lead role + admin-proof ownership takeover + a stored onboarding
state with a resume route don't exist yet.

## ⏭ Next + a standing reminder (2026-09-21)

**✅ Done 2026-09-21 (user asked for the full reset).** `knohow` was dropped and rebuilt: 24 tables, at
`0015_join_links (head)`, **zero rows** — no org, member, team or remembered account. The pre-reset dump is
in the session scratchpad as `knohow-before-reset.sql`. Next sign-in with Google creates the org fresh and
runs setup from "What's your organization called?".

**Gotcha worth keeping:** `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` run from a shell psql leaves
`public` owned by the **shell's** role, so Alembic (connecting as `knohow`) fails with *"no schema has been
selected to create in"*. Fix before migrating:

```bash
psql -d knohow -c 'ALTER SCHEMA public OWNER TO knohow; GRANT ALL ON SCHEMA public TO knohow;'
```

The reset is destructive and is the user's call to trigger — do not run it unprompted.

```bash
# Wipe and rebuild the dev database, then replay every migration.
psql -d knohow -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
cd backend && .venv/bin/alembic upgrade head
```

**Note that testing "from the top" needs the reset *first*.** The live org already has
`setup_step = done`, two teams and a membership, so the setup flow will not reopen on sign-in until the
row is cleared. A narrower reset that keeps the account:

```bash
psql -d knohow -c "UPDATE organizations SET setup_step=NULL, setup_completed_at=NULL, name=observed_domain;"
psql -d knohow -c "DELETE FROM org_memberships; DELETE FROM teams; DELETE FROM join_links;"
```

**Still not built (the joiner's half of the link):**
- Nothing validates `?join=<token>`: no expiry check, no revoked check, **no domain lock enforced**.
- No "Which team are you in?" request screen for the person arriving, and no pending-**request** state
  distinct from the existing pending-join.
- No approver view (who joined, who is waiting, naming a lead on approval).
- No done screen after setup, so finishing still drops onto an unchanged landing page.
- Wrong-account / already-in-another-org / expired / turned-off screens: copy approved, none built.

## Landing page weight: 15.56 MB → 1.72 MB (2026-09-21)
**Measured, not estimated** (production build, cache disabled, over CDP). The refactor below was about
maintainability; **this** is what made the site faster.

| | before | after |
|---|---|---|
| images | 15.07 MB (96.8%) | **1.23 MB** |
| JavaScript | 0.25 MB | 0.25 MB |
| video | 0.12 MB | 0.12 MB |
| **total** | **15.56 MB** | **1.72 MB** |

**The cause was four deck mats and the sign-in backdrop shipped as full-size PNGs** — `red` 3.6 MB,
`blue` 3.3 MB, `green` 3.1 MB, `yellow` 2.5 MB, `signinbg` 1.5 MB, `folder` 892 KB. All 1672×940
watercolour, the worst possible content for PNG. Converted with `sharp` to **AVIF (q55) + WebP (q82)**:
15,095 KB → **922 KB AVIF (93.9% smaller)**, WebP 1,762 KB as the middle fallback.

**How they're served:** CSS mats and `.t-signin-bg` use a two-declaration pattern — plain `url(...png)`
first as the floor, then `image-set()` with AVIF → WebP → PNG, which wins everywhere modern. The Notes
folder icon is an `<img>`, so it became a `<picture>` with AVIF/WebP `<source>`s. **PNGs stay in the repo
as the fallback; modern browsers never fetch them.** Verified in-browser: the mats resolve to
`/deck/green.avif`, and the deck renders unchanged.

**The video was never the problem** (311 KB mp4 / 125 KB webm). It was the stills.

**Lazy loading, honestly:** the setup screens now compile to a separate ~16 KB chunk outside the initial
ten files, and a real bug was fixed on the way — `DemoForm` was the final fallback branch inside an
**always-mounted** modal, so it rendered on every page load; the sheet's contents are now gated on
`sheetOpen`. But JS is only **14%** of the page even now, so this was worth doing for correctness, not for
speed.

## Setup split out of landing-hero + stepper redesigned (2026-09-21, user)
**Stepper now matches the reference the user sent:** a capsule with **− on the left, the number centred,
+ on the right**, still draggable sideways, arrow keys, `role="spinbutton"`. (The `lorenzo04us/Bencho`
source it came from 404s, so this is built to the screenshot.)

**Split, on the user's principle** — *one primitive per job, feature folders for product UI, tokens for
numbers that repeat; new UI composes an existing shell rather than inventing another visual system*:
`src/lib/backend.ts`, `src/components/ui/{drag-stepper,choice-pill,tokens}`,
`src/components/setup/{shell,org-name-step,teams-step,own-team-step,invite-link-step,org-setup-form,types}`.
`landing-hero.tsx` went ~4,700 → ~3,700 lines and now just imports `OrgSetupForm`. Details in
[[Lessons-Learned]].

**Re-audited live after the refactor**: all ten screens still 1 heading, ≤1 sub, and the flow runs end to
end. The count screen's buttons are now − / + / Continue (the first two adjust one value; they are not
competing actions).

## Teams = count then slots; admin check moved to the end (2026-09-21)
**User: "one choice per screen" and "one header and sub head per screen".** Worth keeping the distinction
that came out of it: a *question with answer choices* (Yes / No, or pills) is **one decision** and is fine;
an **action plus a bail-out** ("Check with Google" / "Do this later") is **two actions** and is not.

- **Super Admin "No" / "I don't know" no longer gets its own screen.** Proving admin was never a gate on
  setting up an org, and the screen trapped a founder who isn't the Workspace admin. Those answers now go
  straight to naming the org, and the check became **its own one-action screen at the very end**:
  "Connect Knohow to Google." / "Only a Workspace admin can do this. Google will check whether that's you,
  and ask for one extra permission." → **Check with Google**. Setup is recorded `done` *before* it, so
  closing there doesn't reopen setup. Skipped entirely when `is_super_admin`.
- **Teams is now two screens** (user's call, after I argued against one-name-per-screen):
  1. **"How many teams are in {Org}?"** / "Drag to set the number." — a **`DragStepper`**: one control, drag
     horizontally to set the value, arrow keys for the keyboard, `role="spinbutton"`. The user referenced a
     `DragStepper` from `lorenzo04us/Bencho` (`src/lab/GlassKit.tsx`); **that repo 404s**, so this is my own
     implementation of the behaviour the name implies.
  2. **"What are they called?"** — exactly that many slots. Each commits on blur or Enter (Enter moves to
     the next slot, **never advances the screen**); editing a committed slot **PATCHes** rather than making
     a second team.
- **Why not one name per screen:** nobody knows their team count before listing them, a wrong count either
  traps you or leaves empty screens, and the count is data we never use. Counting first fixes the real flaw
  — "am I done yet?" — without those costs.
- **Link-ready URL is a read-only field, not a paragraph**, so it stops reading as a second sub-line.

**Audited live over CDP, all ten screens:** every one has exactly **1 heading and ≤1 sub**. Button counts:
one action each, except the two screens whose buttons are *answers* (own-team pills, lifetime pills) plus
their Continue, and the Yes/No questions.

## Three fixes from the user's first full test (2026-09-21)
1. **Super Admin "I don't know" screen was unclear.** It asked *"Not sure who your Workspace admin is?"* —
   the question they had just answered — never said what their answer meant, and offered "Verify I'm the
   Workspace admin". Rewritten to **state their standing first**: "You're not a Super Admin yet." /
   "Knohow needs a Workspace admin to connect your organization's Google account. Google can check whether
   that's you. It asks for one extra permission." Choices: **Check with Google** · **Do this later**.
2. **It never showed that they aren't the Super Admin** — same fix; the heading is now the fact.
3. **Teams screen looked like it only wanted one team.** The placeholder was cleared after the first pill,
   so nothing invited another. Now **"Add another"** once at least one pill exists.

Walked in a real browser: owner → Super Admin → "I don't know" lands on the new screen with the right copy
and two choices.

## Invite link built — three screens, one action each (2026-09-21)
User: **"One action per screen"**, so the link is three screens, not one form.

- **Offer** — "Ready to bring everyone in?" / "One link works for everyone at {domain}. They pick their
  team, you approve." → **Create invite link**
- **Lifetime** — "How long should the link work?" / "You can turn it off at any time." → pills
  `24 hours · 7 days · 30 days · No end date` (**7 days pre-picked** so the button is never dead and nothing
  is greyed) → **Continue**
- **Ready** — "Your link is ready." / "Anyone with a {domain} account can use it. Everyone else is turned
  away." + the URL in a read-only field → **Copy** (clipboard only; Copy → Check morph on click),
  which also finishes setup. Join URLs are **`/join/{token}`** with server-rendered Open Graph title,
  description, and a generated preview image for unfurls in Discord/Slack/iMessage. Public
  `GET /join-links/{token}` feeds both. Legacy `/?join=` redirects to `/join/`.
  so the approved copy's separate "Done" would have been a second button).

**Backend:** new `JoinLink` model + migration **`0015_join_links`** (applied to `knohow` and `knohow_test`),
`create_join_link` / `revoke_join_link` / `join_link_url`, `POST`/`DELETE
/organizations/{org_id}/join-link`. Deliberately **not** an `Invitation`: a nomination names one person and
is consumed, this is multi-use and org-wide. **Issuing a new link revokes the old one** — the owner's model
is "the link", singular, and a forgotten second link is the leak the lifetime exists to prevent. `inviteLink`
is now a resumable `SETUP_STEPS` value. **107 backend tests** (4 new).

**Verified over CDP**, all three screens: headings and body copy correct, `30 days` selected reached the
backend as `"30d"`, and each screen showed exactly **one** button (the lifetime screen's pills are choices,
not actions).

**Join arrival + unfurls built (2026-09-21):** `/join/{token}` opens the Log In sheet with org-specific
copy from `GET /join-links/{token}`; Open Graph image/title/description for paste previews. **Still not
built:** signup carrying the join token, domain lock enforcement, team pick → request. Next piece
([[0014-org-setup-and-join-link]]).

## Teams + own-team rebuilt as pills (2026-09-21, user)
User: *"i want the team names to be inside pills... put one team, enter as a pill, put another, enter as a
pill... and then it asks you which one are you and you just click on the pill"*, plus **three things I got
wrong**: the screen had several buttons (Add team / Remove / Continue) against the **one-action rule**,
**Enter submitted the form and jumped to the next screen** instead of committing the team (so there was no
way back), and **greyed-out disabled buttons were never asked for**.

- **Teams screen is a tag field.** Type, **Enter commits a pill**, caret stays. Pills wrap in the field,
  each with an ×, Backspace on an empty caret takes back the last. Enter **never** advances.
- **Own-team screen is those pills, clickable.** Multi-select, selected = filled, `I'm not in any` is
  exclusive either way round. `SetupDropdown` deleted — nothing else used it.
- **One button per screen** (Continue), **never disabled, never greyed**.
- Pill anatomy follows the user's own `tag-input` spec: chip owns height + max width
  (`h-7 w-fit shrink-0 max-w-[min(70%,24ch)]`), only the label shrinks (`min-w-0 truncate`), the × is
  `size-4 shrink-0`.
- **Verified in a real browser over CDP**, not by reading the code: typed "Design", pressed Enter, got three
  pills and stayed on the screen; Continue then showed the same pills selectable, two on, one button.

## Own-team step is multi-select + the "nothing happens" question (2026-09-21)
**"Nothing happens" was setup succeeding.** The DB proves it: teams `Finance` + `Computing` saved, a
`member` membership for `rwopara@ualberta.ca` on **Computing**, `setup_step = done` at 17:00:01. Continue
posted the membership, recorded completion and closed the sheet — onto an unchanged landing page, because
**the signed-in / done screen still doesn't exist** (user's to design; it's been on the "to build" list
since 2026-09-18). Nothing to fix in the flow; the gap is the missing screen.

**Multi-select** (user: *"i could also be in more than one team"*): `SetupDropdown` now takes `multiple` +
`values`, keeps the list open while ticking, marks chosen options with a check, and reads the chosen names
on the trigger. `OwnTeamStep` posts one membership per team, and **"I'm not in any" is exclusive** with the
teams either way round. Copy went plural: *"Which teams are you in?"* / *"Pick as many as apply."*

**Latent bug fixed alongside:** `OwnTeamStep` only ever knew the teams handed to it by the previous screen,
so **resuming setup at this step showed an empty dropdown**. It now fetches `/org-chart/{org_id}` when
nothing was carried in.

## Sheet positioning bug — the real one (fixed 2026-09-21)
The landing **scrolls inside its own `overflow-hidden` container**, not on the document. The sign-in sheet
was `absolute`, so it scrolled away with the content: with the container at `scrollTop: 639` the sheet sat
at `top: -639` and its modal off-screen above, leaving a sliver of sign-in background that looked like a
broken page. The body-level scroll lock was also locking nothing. Sheet is now `fixed`, and the lock
applies to the container (`pageRef`) too. Verified live over CDP: sheet `top: 0`, modal centred at 259,
"What's your organization called?" with `Ualberta` prefilled. Full write-up in [[Known-Issues]].

## Sheet-on-load bug (found + fixed 2026-09-21)
Clicking an account in the picker, signing in, and coming back showed the landing page with a band of the
sign-in background and the Edmonton mark, no modal. Cause: `sheetAtTop` was only ever set by the sheet's
`onTransitionEnd`, so a sheet **opened on load** (the setup resume) never raised and `LoginModal` stayed
closed. Fixed with a fallback timer (`SHEET_SLIDE_MS = 992`). Written up in [[Known-Issues]].

**Live DB state (2026-09-21):** one org `ualberta.ca` (never named — `setup_step` NULL, 1 org chart, **0
teams**), one member `rwopara@ualberta.ca` (**approved**), 1 remembered account. So the resume fallback
sends this account to the **org-naming** screen, prefilled `Ualberta`.

## Two agents on one file — what it cost, and what to check (2026-09-21)
A second agent worked in `src/components/brand/landing-hero.tsx` at the same time as this session and
resolved the clashes as **merge conflicts, keeping both sides**. That produces old-then-new code stacked in
place rather than replaced. Symptoms seen: a duplicated `onClick`, a redeclared `step` state, a duplicated
`needs_org_setup` condition, and an orphaned `<li>` that finally broke the Turbopack parse.

**The dangerous case is the one that still compiles.** The other agent's Cal.com blink fix was present but
**dead**: the old unconditional `setHeights(...)` survived above the new threshold guard, so the observer
re-rendered on every Cal interaction exactly as before. Nothing failed; the fix simply never ran.

**That agent also committed** as `d605fc7` (15:56) — org naming + teams screens, plus `rename_organization`
and `delete_team`, and it added **`lucide-react`** (not in the locked stack — user to decide). Its commit
**dropped the blink fix entirely**: `lastFull` is absent from `d605fc7`.

**Restored into the working tree afterwards** (all verified: tsc 0, eslint 0, `next build` 0, 103 backend
tests):
- `SetupDropdown` + `OwnTeamStep` ("Which team is yours?"), and `TeamsStep` now hands its list on.
- Resume wiring: `recordSetupStep` at each advance, `Me.setup_step`, `OrgSetupForm` starting on the
  reported step, and the sheet opening for `needs_org_setup || setup_step`.
- The remove-accounts **tree** (parent org rows, nested linked addresses, connected trunk) and
  `forgetRememberedAccounts(memberIds, emails)`.
- The **Cal.com blink fix**, this time without the stale line above it.
- The other agent's **picker refinements**, which its own commit also dropped: the `UserRoundX` icon on the
  Remove link (`leading-none`, not `pb-px`), the label counting **`removableAccounts(...)`** rather than
  organizations (they differ once addresses nest), tighter rows (`gap-0.5`, `px-2 py-1`, `leading-tight`),
  and the OR divider at `mt-3`.

**How the gap was found** (worth repeating, not eyeballing): compare top-level symbols between the two
versions, then compare whitespace-normalised sorted line sets. The symbol sets matched while six real UI
lines were still missing — a positional `diff` drowns them in noise because restored blocks land at
different line numbers.

**If this happens again:** `git log` first (the other agent may have committed), then grep for old/new pairs
that compile — duplicate props, redeclared state, a stale statement above its replacement. `tsc` alone will
not catch the last one.

## "Resume, don't restart" built + two bugs it exposed (2026-09-21)
User: *"i know the current log in hasnt completed all these new steps why is it taking me to the get
started screen"*. Three separate causes, all fixed.

**1. Setup completion was inferred, not recorded.** `needs_org_setup` = "no OrgChart row AND founding
member", and the owner/Super-Admin questions **create** that row — so setup looked finished the moment the
first question was answered, and `orgName` / `teams` / `ownTeam` were unreachable. Exactly the trap
[[0014-org-setup-and-join-link]] flagged for teams ("setup completion is its own flag, not *has teams*"),
hit one step earlier.
- **Fix:** `organizations.setup_step` + `setup_completed_at` (migration **`0014_setup_progress`**, applied
  to `knohow` and `knohow_test`). `record_setup_step()` / `resume_setup_step()` in the onboarding service,
  `POST /onboarding/setup-step`, and `setup_step` on `/auth/me`. Frontend records each advance and starts
  `OrgSetupForm` on the reported step; the sheet now opens for `needs_org_setup || setup_step`.
- Only the **founding member** resumes; an unknown step is refused rather than stored.
- **Legacy fallback:** an org with a chart but no recorded step resumes at `orgName` (nothing had finished
  setup before the column existed, so it can't re-prompt anyone who was genuinely done). This is what makes
  the user's existing local org pick up where it left off.

**2. The founder is `auto_affiliated`, not approved.** A brand-new org's first member gets
`MemberStanding.AUTO_AFFILIATED` (`app/onboarding/service.py`, `created_org` branch) — there is nobody
approved to approve them yet. The routes added for naming and teams used `require_same_org`
(approved-only), so **every one of them would have 403'd on the first real run**. New
`require_same_org_for_setup` in `app/api/deps.py`: approved members pass as usual, and the founding member
also passes **while setup is unfinished**, so it can't become a way for an auto-joined member to edit the
chart afterwards. Applied to rename-org, create-team, delete-team and memberships.

**3. Tree connectors were detached.** The remove screen drew one elbow per child with a flex `gap`, so the
line broke between rows. Now one continuous trunk: spacing moved into each child's padding, children are a
fixed 56px so the trunk meets each row at its middle (36px), non-last children get trunk + stub, the last
turns the corner and stops.

**103 backend tests pass** (5 new); tsc/eslint/build clean. Still **unverified in a browser**.

**TeamsStep Continue console error fixed (2026-09-21):** `onDone` had been invoked inside a `setSaved`
updater, which updated `OrgSetupForm` during `TeamsStep`'s render. Continue now accumulates committed teams
after the loop and calls `onDone` outside any state updater.

**Setup back removed (2026-09-21):** Outside-modal Back + history wiring was tried, then fully
reverted after layout/jump regressions. Setup screens stay forward-only again.

**Setup press + field shake kept (2026-09-21):** Choice buttons / pills use `active:scale-95`
(same as Continue). Empty/invalid fields shake + red on Continue like Book a Demo — owner email,
org name, team names. Continue stays black (never greyed).

## Remove accounts is a tree now, and hiding an address is its own thing (2026-09-21)
**Bug found:** the remove screen listed each linked personal address as a flat row carrying the *member
ids* of the orgs that surfaced it, so ticking `ronaldwop@gmail.com` forgot the whole organization row with
it. Nothing was lost (the link survived, signing in re-added the row) but it removed far more than the
person asked for.

**Fix (user's design):** the screen is a **file tree** — one organization per row, the person's linked
personal addresses **nested underneath** with an elbow connector. Ticking an organization ticks its whole
branch; a child can be unticked on its own to keep it. Unticking a child does **not** rescue the row above
it, because they are two different removals.

**The two ticks mean different things, deliberately:**
- An **organization** is *forgotten* on this browser (unchanged behaviour: `remembered_accounts` rows go,
  the member/org/person/links are untouched, signing in re-adds it).
- A **child address** has no row of its own — it lives in `person_emails` and rides on the org rows as a
  `Personal (n)` chip. So removing it from the sign-in screen is a **hide, scoped to this device**, never an
  unlink. Unlinking would follow the person to every browser, which is not what "remove it from this
  screen" means ([[0011-device-remembered-accounts]], [[0012-identity-linking-one-person-many-accounts]]).

- **Backend:** new `hidden_remembered_emails` table (migration **`0013_hidden_remembered_emails`**, applied
  to both `knohow` and `knohow_test`), `HiddenRememberedEmail` model, `hide_emails()` in
  `app/auth/remembered.py`, `list_remembered_orgs` filters hidden addresses out, `forget_device(None)` also
  clears the device's hide list, and `DELETE /auth/remembered-accounts` takes `emails` alongside
  `member_ids` (returns `{removed, hidden}`). A call naming **only** emails does not forget anything and
  **keeps the device cookie**.
- **Frontend:** `removableAccounts` returns a tree, `RemoveAccountsScreen` renders parent/child rows, and
  `onRemoved` now reports `{memberIds, emails}` so the picker drops hidden addresses from the chips without
  a reload.
- **98 backend tests pass** (3 new/updated in `tests/test_remembered_accounts.py`); tsc/eslint/build clean.
- **Not decided:** whether signing in with a hidden address again should un-hide it. Today it stays hidden
  until the browser's accounts are removed entirely.

## Founder's own team + custom dropdown (2026-09-21)
Third screen of setup: **"Which team is yours?"** / "Pick the one you work in.", reading the teams the
founder just added, plus **"I'm not in one"** as a real answer (a founder can sit above the teams). Picking
a team POSTs `/organizations/{org_id}/memberships` with role `member` — being in a team isn't authority,
that's settled by the owner question. Step order in `OrgSetupForm` is now owner questions → `verifyAdmin`
→ `orgName` → `teams` → `ownTeam`.
- **`SetupDropdown`** (user asked for a custom dropdown, not a native `<select>`): built from the setup
  screens' own button, combobox/listbox roles, `aria-activedescendant`, arrow keys, Enter/Space, Escape,
  click-outside, chevron that flips open.
- **It opens in place, not floating.** `.t-login-modal` is `overflow: hidden` and animates to its measured
  body height, so an absolutely positioned menu would be clipped. Expanding in flow grows the modal through
  the same ResizeObserver tween as every other step. Worth knowing before anyone tries to "fix" it into an
  overlay — see [[Lessons-Learned]].
- `/auth/me`'s `id` is now on the frontend `Me` type (the membership POST needs the member id).
- **Invented copy to review:** the dropdown's resting label **"Select a team"** — the approved set doesn't
  name it. Marked PLACEHOLDER in the code.
- tsc/eslint/next build clean. **Unverified in a browser.**

## Org naming + team creation screens built (2026-09-21)
**The org was never named.** A Workspace org is created with `name` set to its hosted domain
(`app/onboarding/service.py:478`), so it was literally called `acme.org` — which would have shown on the
invite link's sign-in screen, in the "already with {OtherOrg}" refusal and in the Log In picker. Only the
personal-org path ever asked a human. Fixed: **setup now names the organization first**, prefilled with a
guess from the domain (`acme.org` → `Acme`), pre-selected so one keystroke replaces it.
- **Frontend:** `OrgNameStep` + `suggestOrgName` in `src/components/brand/landing-hero.tsx`. Copy: "What's
  your organization called?" / "This is the name your team sees when they join."
- **Backend:** `rename_organization` (`app/org_chart/service.py`) + `PATCH /organizations/{org_id}`;
  `/auth/me` now returns `organization_name` and `organization_domain` for the prefill.
- Step order in `OrgSetupForm`: owner questions → `verifyAdmin` → **`orgName`** → `teams`.

## Team creation screen built (2026-09-21)
First screen of setup proper, from the approved copy ([[FEAT-workspace-onboarding-flow]] → "Copy for setup
+ join", [[0014-org-setup-and-join-link]]).
- **Frontend:** `TeamsStep` in `src/components/brand/landing-hero.tsx` — **"What teams are in {Org}?"**
  (the name from the screen before; falls back to the org's current name), team-name field + **Add team**, each team **POSTed as it's added** (save-as-you-go), a
  quiet **Saved** line, one row per team with **Remove**, and a **Continue** pill that only appears once
  there's at least one team. On mount it **GETs `/org-chart/{org_id}`**, so a founder who closed the tab
  comes back to the teams they already added. The setup `heading`/`body` helpers were hoisted to module
  scope (`setupHeading` / `setupBody`) so this screen shares the questions' type.
- **Wiring:** reached from the `verifyAdmin` step's **"Skip for now"**, which used to close the sheet.
  The admin-proof return path (`?admin_proof=verified`) still lands in `SignInResultPanel` and does **not**
  continue into teams yet.
- **Backend:** `delete_team` (`app/org_chart/service.py`) + `DELETE /organizations/{org_id}/teams/{team_id}`
  — new, because Remove had nothing to call. Deliberately **refuses once the team has people or child
  teams**: at that point it's an org-chart change affecting someone's access, not an undo of a typo.
  7 new tests (`tests/test_team_setup.py`, covering both screens), **96 backend tests pass**; tsc/eslint/next build clean.
- **Invented copy to review:** the repeated-name error `You already have a team called {name}.` — the
  approved set doesn't cover duplicates. Marked PLACEHOLDER in the code.
- **Unverified in a browser** (needs the backend running and a real sign-in).

## Active priority
The user is rebuilding the frontend from scratch, screen by screen — **not** a Claude-driven redesign. **Implement only what is explicitly asked; never invent copy, layout, or visual decisions; ask rather than fill gaps.** Update second-brain after every change.

## Agent tooling (2026-09-18)
Antigravity **customizations for this repo** live in the workspace (not under `~/.gemini/antigravity/builtin/…` — that tree is built-in product docs only):
- **Second-brain always on:** root [`GEMINI.md`](../../GEMINI.md) + Always On rule `.agents/rules/second-brain.md` + **PreInvocation hook** [`.agents/hooks.json`](../../.agents/hooks.json) → `scripts/second-brain-pre.py` injects `Current/Current-Context.md` into every model turn; skill `update-second-brain` for write-back. Cursor: `.cursor/rules/update-second-brain.mdc` (alwaysApply) + `.cursor/skills/update-second-brain/`.
- Other Always On / glob rules: `knowhow-invariants`, `mcp-policy`, frontend/backend
- MCP: `.agents/mcp_config.json` — github + context7 (authenticate github in Customizations if needed). Forbidden: Prisma MCP, Drive MCP against `src/`, DB MCPs until Postgres provisioned.
Keep Antigravity surfaces in sync when invariants change.

## What's true right now (2026-09-16) — landing only
- **Old app purged** ([[0004-landing-only-purge-old-app]]). Live route: `/` → `<LandingHero />`.
- Canvas: `--background: #F9F8F6`, `--foreground: #1c1917`.
- **Desktop header** ([[FEAT-landing-header-nav]]): logo left; Log in + Book a Demo + Get Started right (shared `CTA_CLASS`, −20% then **+10%** → **~47.9px** height / matching type+padding; **`font-bold`**; tight group). Split arrow chevrons use **`strokeWidth={3}`** (was 2). Sliding tabs removed. Mobile header still logo-only (+ bottom Get Started).
- **Log In panel (2026-09-16):** clicking "Log In" in the desktop header recesses the landing ([[Patterns-landing-mc-recess-deck]]: scale `0.9` + dark veil, 900ms) while a full-height panel (background `public/hero/signinbg.png` + twinkling stars and occasional shooting stars) slides up from the bottom; a Close button, and (2026-09-17) a **centred sign-in modal** (Notes-panel surface, 420px wide): a thin line until the panel reaches the top, then grows via user-supplied `.t-resize` to reveal "Log in or sign up in seconds" + "Use your Google account to continue with Knohow." + **Continue with Google** (inert) + Terms of Use / Privacy Policy line. Sheet now eases with `--resize-ease`; hero video pauses while it's open. Contractors → deep/email links, not a modal toggle ([[FEAT-workspace-onboarding-flow]]). **Book a Demo (2026-09-17):** opens the same sheet with a demo form (names first; each valid Continue bounce-grows in Work email, then Company website; Continue = the header pill, right-aligned); a white-text **"M:SS reserved" countdown** at the Close label's size (no pill) sits top-left of the sheet (5:00 from first open this visit, keeps running, then "Hold Expired"; digit pop-in); required-field check with the user-supplied shake error state; submits nowhere yet. **Segment step (2026-09-19):** a valid website replaces the fields with "Who's this for?" — four stacked cards (Agencies / Startups / Nonprofits / Other, outline briefcase / rocket / heart / pencil, placeholder copy; Other grows a text box in below the cards and the highlight sits on the box, not the card) built as the setup steps' choice button rather than the reference's card chrome; one choice, skippable, picked = hairline darkens to `#1c1917`; the pill reads **Skip** until a card is picked, then **Continue**, which opens the **booking screen**: the user's **Cal.com embed** (`@calcom/embed-react`, `knohow-demo/15min`, `month_view`) inline in the same modal — `LoginModal`'s ResizeObserver + `.t-resize` give the "area bounce"; on this step the modal drops its own surface (transparent bg/border, no shadow, no padding) widens 420 → **920px** and drops to the plain 10px radius via `.t-login-modal:has(.t-demo-booking)`; the slot is a **fixed 920×538** (Cal's own measured height) so the modal grows once, not twice; `translate: 0 40px` centres Cal's card against its 80px attribution band; the embed is **lazy-loaded** via `next/dynamic` (`demo-booking-step.tsx` + `demo-booking-slot.tsx`) after it slowed the landing — 0 Cal requests on load; and **page scroll is locked while the sheet is open**; `public/knohow-mark.png` holds the slot while Cal loads. Verified in-browser at 1470×956 (Playwright) 2026-09-20 — [[FEAT-landing-book-a-demo]]. See [[FEAT-landing-login-panel]]. Desktop only (no mobile trigger); video **pauses** while the panel is open (2026-09-17). Click-outside no longer closes the deck behind the open panel. See [[FEAT-landing-login-panel]].
- **Get Started handoff:** six-phase CTA — `idle → spinner (400ms) → blank (220ms) → arrows (280ms) → splitting → controls`. Pill pinches into two **~47.9px** circles via `liquid-gooey` on the deck rise/spread schedule. At `controls`, goo unmounts and **real** left/right circles (chevrons) drive the deck. **Desktop:** looping **seven-card** feature ring (Unified Workspace → Auto-Own → Auto-Share → Oversight → DeepSearch → Org-Chart & Permissions → Instant Offboard); mats cycle green / blue / red / yellow; three visible + rest parked; ←/→ cascade unchanged ([[FEAT-landing-deck-carousel]]). **Mobile:** Cover Flow over the same seven — awaiting user decision on arrow semantics. The open deck only takes clicks on its cards + Cover Flow bar (`globals.css`); before that fix the full-screen deck layer swallowed every click on the arrows. **`data-open` flips with the split.**
  - **2026-09-16:** Sound effects removed from all buttons, controls, stub footer links, and deck arrows per user request (`playClickSound` & `AudioContext` removed).
  - **2026-09-11:** desktop **Log in / Book a Demo** (Book a demo → Book a Demo 2026-09-12 → **Book a Demo** again 2026-09-17) are hidden until the split, then goo out of the pill into their row slots on the same schedule as the arrows and hand over to the real buttons (Δ 0px). **Click outside** the card band / logo lockup / any control plays the whole handoff **backwards** (pieces flow back + side cards fold under the centre card → deck sinks + logo/subhead grow back → arrows fade → Get Started); spinner not replayed; a drag released outside doesn't count. **"Features"** label (subhead's face/tracking/colour/open-state size, verified identical rendered px) sits just above the middle card, desktop only — centred (`left-1/2`; 45% nudge reverted 2026-09-12). See [[FEAT-landing-deck-carousel]].
  - **2026-09-11 (later):** **controls inverted per user** — ← brings the left card to centre (cards travel right), → mirrors; clicking the card in the left/right slot does the same as that arrow (drags don't count). Arrow circles now press in like the other buttons (`active:scale-95`, 150ms; positioned via the `translate` property so the press scales about their own centre; chevrons follow via `group-has`). **Subhead wave:** GSAP 3.15 + SplitText (`gsap`, `@gsap/react` added at user request) — a left→right crest, 12px, every 8s (first at 8s), on desktop + mobile subheads; tunables in `SUBHEAD_WAVE`; skipped under reduced motion. See [[FEAT-landing-deck-carousel]] / [[Lessons-Learned]].
  - **2026-09-12:** each mac title bar shows that card's feature name (centred, Söhne, muted stone on light `#d1cfcc` titlebar; size ×1.1 ×3 → `0.95832rem`). Title uses `line-height: 1.3` + `top: 50%` / `translate(-50%, -50%)` so descenders aren't clipped by `overflow: hidden` (ellipsis).
  - **2026-09-12 (bug fix):** centre (blue) card no longer rises under the side cards on a Get Started after the carousel was stepped and closed — seat-effect cleanup now snapshots the card nodes. See [[Known-Issues]].
  - **2026-09-12 (later):** desktop metaphor — main `{5.1, 8.9, 80.4×79.8%}`; Notes `{61.7, 66, 35.1×28%}` (= resize floor; width 39 −10%, 2026-09-12); folder `{86, 3}`; radii +5% (card 10.5px, folder plate 7.35px). See [[FEAT-landing-deck-notes-folder]].
- **Deck:** seven feature cards; painted mats cycle the four PNGs; outer radius **10px**; inset mac windows (**14px**; titlebar/body **13px** inside the 1px border — nested-radius rule, see [[Lessons-Learned]]; light well `#f3f2ef`, titlebar `#d1cfcc`) — **draggable** / **resizable**. Favicon = hex mark (`src/app/icon.svg`); the same mark also exists as a **PNG** at `public/knohow-mark.png` (now the Cal embed's loading placeholder) (2026-09-20, user request) — 1024×1169 canvas, transparent, with the mark **zoomed out 60%** (drawn 410×468, centred, 2026-09-20 user request — canvas size unchanged, the surplus is padding), rasterized from `icon.svg` with `sharp` (already a dependency; no `rsvg`/ImageMagick on this machine). Nothing references it yet. Desktop seats three (±side + centre); cards 4–7 park via `--deck-park-slot` until seated.
- **Desktop:** 16:9 rise + linear-spread. Deck scales with window height below 956px (`--deck-fit`, floor 0.7) so Chrome-height windows keep room above/below — see [[Known-Issues]] (resolved 2026-09-11). **Mobile (2026-09-14, resized 2026-09-15):** landscape (`16/9`) Cover Flow, same style as desktop just smaller and inset with visible gutters (`min(72vw, 21rem)`, was `82vw/26rem` then `9/19.5` portrait before that) — proportions matched to a user-supplied reference screenshot of a different site (for sizing only, not styling); 3D coverflow peek on neighbouring cards kept (explicit user call). Content (titlebar, dots) scales via a CSS container query so it doesn't read oversized on the shorter card. Own nav bar (‹ › + dots) removed — the split Get Started arrows are the only explicit navigation, plus a swipe on the stage (capture-phase, see [[Lessons-Learned]]). Windows are move-only on mobile (`.t-deck-resize` hidden below 768px). **Notes (2026-09-15):** no dialog on mobile at all now — the Notes folder icon is desktop-only (hidden on mobile), and the active card's note shows automatically in a plain panel stacked below the stage, updating as the user swipes/taps — [[FEAT-landing-deck-notes-folder]].
- **Desktop footer links (2026-09-12):** **About Us** (left) + **Terms of Use** · **Privacy Policy** (right, grouped; `gap-4`, desktop `lg:gap-6`; Terms of Use added 2026-09-17) via `FooterStubLink` (button stubs + `active:scale-95` press until real routes; sound effects removed 2026-09-16), Satoshi bold + underline + `cursor-pointer`, size `0.908552rem` (CTA face −20%), same row, `mt-[2px]` under “Take Control…”. **Mobile (2026-09-17, user: "put the footer links on their own line on mobile"):** the link row moved out of the subhead block to its own line **below Get Started** (bottom of the mobile column, `pb-[max(1rem,safe-area)]`) — with Terms of Use added, the centred link collided with the Get Started pill (~10–15px). Get Started's container `pt-8` → `pt-14` (+24px = the removed row) so the pill keeps its old ~13px gap under the subhead. Open-deck Cover Flow still overlaps the subhead on short phones (375×667) — pre-existing, see [[Known-Issues]] `[landing / viewport]`. CTA pills / Notes folder press. Real destinations not wired yet.
- Subhead / logo / CTA size+position tweaks live in `landing-hero.tsx` + `globals.css` (see recent Lessons-Learned). Hero video grain `.t-hero-grain`. **Guidelines grid removed 2026-09-18** (user: "remove the grid") — `GuidelinesOverlay` + `guidelines-overlay.tsx`, the "Edit grid" mode, `NEXT_PUBLIC_EDITING_MODE_ENABLED` and `.env.example`'s old entry are gone (`.env.example` re-added 2026-09-18 with `NEXT_PUBLIC_BACKEND_API_URL` only); restore from git if wanted. `src/lib/use-hydrated.ts` is now unused but kept.
- `LogoMark` hex: `#4285F4` / `#34A853` / `#FBBC05` / `#EA4335`. Lockup mark offset `translate-x-[5%]` / `translate-y-[10%]` (nudged left from 8% x, 2026-09-12).

## Open questions / next
1. **Mobile CTA-split "twitch" — fixed 2026-09-14, still awaiting phone re-verify** (no device available this session either). Root cause + fix in [[Known-Issues]] / [[FEAT-landing-deck-carousel]] (a live `%`-based `translate` resolving against its own animating `width`, fragile under the forced reflow a real phone's browser-chrome collapse triggers — never reproducible in headless Chromium). Also: mobile "Features" label; tune middle-band geometry; card body content.
2. **Header action destinations** — Log in / Book a Demo wire-up; mobile treatment — [[FEAT-landing-header-nav]].
3. Auth / data / Google seams in the **Next.js app** (`src/lib/`) return only when explicitly asked — unaffected by the backend merge (item 6 below), which is a separate codebase.
4. Hero video contrast strategy ([[Known-Issues]]).
5. GitHub remote `LOJJ-IO/knowhow` (org-owned; `git remote -v` still prints the pre-transfer `ronaldwopara/knowhow`, which GitHub redirects — check owner with `gh repo view`, not the remote URL). **Repo is currently PUBLIC (confirmed 2026-09-20)** — because **Vercel Hobby cannot deploy org-owned repos** (that's Pro-only; Hobby *does* allow private repos, so privacy was never the blocker — org ownership was). Ways out if private matters: transfer to personal `ronaldwopara`, buy Vercel Pro, or move hosting (Cloudflare allows private + org repos free). See [[Lessons-Learned]] 2026-09-20. Vercel from `main`. **Cloudflare hosting floated 2026-09-17, raised again 2026-09-20 (still noted, not decided — no ADR):** user mentioned wanting to host with Cloudflare. Findings: DNS/domain free and a shared domain (`knowhow.com` + `api.knowhow.com`) would make the backend's session cookies same-site, dropping the `SameSite=None` cross-site setup in [[Architecture-Overview]]'s backend contract; Next.js would need the OpenNext adapter (`@opennextjs/cloudflare`) — Next 16.3.3 support unverified; FastAPI can't run on Workers (native `psycopg`/`cryptography`) so it'd need Cloudflare Containers or stay on Railway; **Cloudflare has no Postgres** and D1 is SQLite, which 10 backend models rule out (Postgres-only column types) — external Postgres via Hyperdrive instead. Cost difference is marginal at this stage (~$5–45/mo across options). Recommended if revisited: Cloudflare DNS + frontend, FastAPI + Postgres on Railway.
6. ~~`backend/auth-foundation` merge into `main`~~ — done 2026-09-15. Next open item: GCP/Railway/Postgres provisioning, whenever the user asks.
7. **Viewport growth / short heights (awaiting user decisions)** — **proposal prototyped + tested (55 → 11 colliding sizes, unchanged at 1470×956)**, awaiting go-ahead to apply; sweep findings + open questions in [[Known-Issues]] (`[landing / viewport]`): desktop overlap below ~700px tall, side cards off-screen on wide screens, mobile Cover Flow not height-aware, phone landscape falls into the desktop layout.
8. ~~Restart `next dev`~~ — `next build` passes as of 2026-09-17.
9. **Product direction captured 2026-09-16 (not built):** onboarding = Google sign-in → verified Workspace domain is the tenant → org name as label → owner and Super Admin asked separately ([[FEAT-workspace-onboarding-flow]]; backend gaps listed there). **Later 2026-09-16:** frontend mocked; domain check = Google `hd` claim (Workspace or not) then Knowhow org lookup; personal Gmail allowed; no authority inferred from another; state table (before owner / owner confirmed / Super Admin approved) in the spec. **2026-09-17:** tenant identity settled — observation creates the candidate, verification upgrades it in place; one active org per observed domain; every org starts unbound and binds only on **admin proof** (a real admin-only Google call, not the self-declared answer and not `approve_delegation`'s attestation); personal accounts get a domainless org (one owner, one per person); binding a domain never reclassifies members. Also agreed: claims vs acceptance (anyone may claim, only standing accepts), identity linking (standing is per person, proven by signing in, data stays per account), three independent layers (membership / Google identity & access / authority), auto-affiliated = evidence only (personal accounts never auto-affiliate), sponsorship is vouched-only + non-transitive and shows in the org chart as sponsored. See [[0006-observed-domain-tenant-identity]] and [[FEAT-workspace-onboarding-flow]]. **Invariant surfaced:** Knowhow cannot assert Google ownership — no Shared Drive support in `backend/`, and Google refuses consumer↔Workspace transfers, so the contractor case is unimplementable as imagined; open question written up as [[0007-shared-drive-support]] ([[Known-Issues]]). Company-vs-personal file classification = rules → lightweight metadata classifier → content analysis → LLM last, human confirms, confidence ≠ authority ([[FEAT-drive-file-classification]], [[0005-layered-file-classification-no-llm-first]]). **Terms decided:** *Private* = company file restricted from coworkers; *Personal* = employee's own non-company file (never visible to the company, not stored as org data). Backend's `personal` flag actually implements Private — rename pending ([[Known-Issues]]). Six agreed privacy/authority constraints in the classification spec. **Formal rules (12) agreed** — Company/Personal/External, confirmation required before `FileIndex`, Shared Drive exception; backend sync currently violates the FileIndex invariant ([[Known-Issues]]). **The same model gates DeepSearch** (Company only) — DeepSearch currently can surface Personal files to leaders ([[Known-Issues]]).

## Legal pages (2026-09-17)
`/terms` + `/privacy` live (Canva-style layout; LOJJ.IO, Alberta, info@lojj.io, sales-led pricing, 18+) — [[FEAT-legal-pages]]. Footer + Log In modal links now navigate. **Not lawyer-reviewed. The Privacy Policy states the agreed privacy model, which `backend/` breaks today — launch blocker in [[Known-Issues]] `[legal / privacy]`.**

## Next session (from 2026-09-17): onboarding/sign-in UI
The onboarding **model** is specified ([[FEAT-workspace-onboarding-flow]], [[0006-observed-domain-tenant-identity]], [[0007-shared-drive-support]]); **no UI exists**. The user is starting a fresh chat to build the **sign-in + onboarding screens** — frontend **mocked** ([[0001-mocked-data-first-prototype]]), mock shaped like the backend's onboarding responses, screens implemented **only as explicitly asked** (no invented copy/layout).
**Decided 2026-09-17: the screens live inside the Log In slide-up panel** ([[FEAT-landing-login-panel]]) — not a separate route. Deferred on purpose: contractor action scope; DeepSearch scope for an ordinary member; domainless↔candidate merge; Shared Drives ([[0007-shared-drive-support]]).

## Archive
Pre-purge product history and long logo/editor chronology live in git + older vault revisions.
