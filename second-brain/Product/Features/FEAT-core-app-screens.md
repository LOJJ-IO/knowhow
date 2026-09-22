---
type: feature
status: in-progress
tags: [area/frontend, status/in-progress]
created: 2026-09-21
updated: 2026-09-21
related: ["[[Current-Context]]", "[[FEAT-workspace-onboarding-flow]]", "[[FEAT-landing-deck-carousel]]", "[[FEAT-org-chart-builder]]", "[[Lessons-Learned]]", "[[0001-mocked-data-first-prototype]]"]
---
<!-- Filename convention: Product/Features/FEAT-short-title.md -->

# FEAT: Core App Screens (Post-Onboarding)

## Status
`in-progress` — shell + navigation built 2026-09-21; the 7 screens are empty states awaiting design, one at a time.

## Problem
After a user successfully completes the Workspace onboarding and org setup (or joins an existing org), they currently drop into an empty state or back to the landing page. We need the actual logged-in application UI. The user wants the core application screens to mirror the main value propositions showcased in the landing page's feature deck.

## Solution
Build out the core authenticated application screens corresponding to each of the 7 features in the landing page's deck. 

The planned screens/views are:

1. **Unified Workspace**
   - *Goal:* Eliminate file clutter and ensure all Google Drive documents live in one predictable location.
   - *Concept:* The main dashboard or default view where all company/team files are aggregated predictably, separated from personal drives.

2. **Auto-Own**
   - *Goal:* Allow Top Leaders to edit/move documents instantly without asking permission.
   - *Concept:* A view or interface highlighting ownership, perhaps a management screen for files where leaders can see and take action on documents seamlessly.

3. **Auto-Share**
   - *Goal:* Guarantee people have immediate access to the files they need without asking for links.
   - *Concept:* Integrated deeply into the Workspace view; possibly a dedicated "Shared with my Team" or auto-provisioning rules management screen.

4. **Oversight**
   - *Goal:* Keep Top Leaders fully informed without requiring manual updates.
   - *Concept:* An activity feed or high-level reporting dashboard showing recent document creation, edits, and team activity.

5. **DeepSearch**
   - *Goal:* Allow individuals and managers to instantly locate any document.
   - *Concept:* A global search interface (Command+K or prominent search bar) with advanced filtering, capable of finding files across the entire org chart.

6. **Org-Chart & Permissions**
   - *Goal:* Make ownership and access rules follow real teams.
   - *Concept:* A visual Org-Chart builder/viewer where admins can manage teams, assign leads, and see who has access to what scopes. (Note: Ties into the ongoing `FEAT-org-chart-builder.md`).

7. **Instant Offboard**
   - *Goal:* Protect confidential information and eliminate data leak risks when someone leaves.
   - *Concept:* An administrative screen for offboarding a user, showing exactly what files they created and transferring them to the organization instantly.

## Out of scope
- The actual execution of Google Workspace API actions for these features from the frontend (will still rely on the FastAPI backend for domain-wide delegation).
- Replacing Google Drive entirely (Knohow acts as the management/view layer on top).

## UI/UX

### Decided 2026-09-21 (user, via clarifying questions)
- **Shell:** persistent left **sidebar + one route per screen** (references: ElevenLabs, the banking
  dashboard). Not a widget dashboard, not panels over Workspace.
- **Look:** **quiet neutral** — near-white ground, hairline borders, no card shadows, type carries the
  page. Closest to the existing landing tokens; the soft-card / colored-chip look of the Elera and
  Hamed references was explicitly *not* chosen.
- **Data:** **mocked fixtures inside `src/`**, per [[0001-mocked-data-first-prototype]]. Reads are
  already scoped by `organizationId` so the backend swap is a change of body, not of signature.
- **Pass size:** shell + navigation only, then **screen by screen** with the user reviewing the feel.
- **Empty states:** the user asked for the *pattern* Sage_v1 used — one canonical `EmptyState`
  (icon disc, title, one-line description, optional single action), centred, used everywhere a list
  comes back empty. Rebuilt Knohow-native; no Sage code, deps (`cva`) or tokens crossed over, so
  invariant 5 holds.
### Shell sizing and type (user 2026-09-21, two references)
- **Sidebar sized off X, then cut twice** (user, same day): `--app-sidebar-w: 12.6rem` (202px) —
  17.5rem → 14rem (−20%) → 12.6rem (−10%) → **11.34rem** (−10% again). The longest label
  ("Offboarding") is close to truncating at this width. Rows stay `--app-row-h: 3rem` with 22px icons and 1.0625rem labels, so they still read as
  destinations rather than list items.
- **Layout and type off Elera:** sidebar and content share one ground with **no divider**;
  `--app-ground: #f4f2ee` sits a shade under the landing's `#f9f8f6` so white panels read as panels;
  sentence-case grey section labels; **fully rounded pill** on the active row (neutral `--app-active`,
  not Elera's green — the quiet-neutral decision still holds); the screen's **name lives in a top row**
  (`Topbar`), aligned with the org name in the sidebar, not in the screen body; **search moved out of
  the sidebar** into that top row.
- **Brand:** the sidebar's top row is the landing's full `LogoLockup` ("Kn⬡how™ by LOJJ.io",
  `fontSize="2.5rem"` — 1.6rem → 1.92rem → 2.5rem across three user resizes, and that row
  drops to `px-3` because the lockup needs the width in an 11.34rem column; `as="div"` since `Topbar` owns the
  page's `<h1>`), not the bare hexagon mark
  plus a name (user 2026-09-21). Side effect: the **organization's name is no longer displayed**
  anywhere in the shell — it reads as the product, not the tenant. Worth a home once there is more
  than one org on a device.
- **Nav position:** the section list starts **5.85rem** from the top, not 4.5rem (user asked for it
  30% lower, 2026-09-21) — `pt-[1.35rem]` on the scrolling nav container.
- **Fonts:** Söhne for the page title and empty-state titles; Satoshi (Medium for nav
  labels) for everything else. Same two faces as the landing.
- **Icons: Google Material Symbols (Outlined)**, self-hosted per `next/font/local` like every other
  font here — `src/fonts/material-symbols/`, wrapped by `src/components/app/icon.tsx`. Two things to
  know: the file is **subsetted** to the 7 icons in use (2KB, fetched with `&icon_names=…`; the full
  variable font is 3.8MB), so **adding an icon means re-fetching the subset**, and icons are addressed
  by **codepoint** rather than ligature name so a subset without a ligature table can never render as
  the literal text "folder_open". `lucide-react` stays in use on the landing and setup screens.

- Composes existing tokens (`satoshi`, `sohne`, `#f9f8f6`, `#1c1917`) plus a new app-chrome set in
  `globals.css`: `--app-sidebar-w`, `--app-border`, `--app-muted`, `--app-active`, `--app-dim`.
- Screen copy currently in the tree is **draft**, written from each feature's Goal line. The user
  owns final copy.

## Technical approach

### Built 2026-09-21
Route group **`src/app/(app)/`** — parentheses keep the group out of the URL, so the routes are clean
top-level paths and the landing at `/` is untouched:

| Screen | Route |
| --- | --- |
| Unified Workspace | `/workspace` |
| Oversight | `/oversight` |
| Auto-Own | `/ownership` |
| Auto-Share | `/sharing` |
| Org-Chart & Permissions | `/org-chart` |
| Instant Offboard | `/offboarding` |
| DeepSearch | `/search` |

- [`src/lib/app-nav.ts`](../../../src/lib/app-nav.ts) — the single source for every screen's label,
  route, section (`Organization` / `Access` / `People`) and one-line purpose. The sidebar row and the
  page heading both read it, so they cannot drift. `/search` is held separately (`APP_SEARCH`): it is
  reached from the sidebar's search field, not from the section list.
- [`src/lib/organization.ts`](../../../src/lib/organization.ts) — mocked `getOrganizationChrome(organizationId)`
  (org name, domain, viewer). `MOCK_ORGANIZATION_ID` stands in until sign-in state is threaded from the
  backend; swapping it is one line in the layout.
- `src/components/app/` — `sidebar.tsx` (client, needs `usePathname`), `nav-icons.tsx` (route → lucide
  icon; deliberately **not** a client module, see [[Lessons-Learned]]), `shell.tsx` (`AppPage`:
  heading + purpose + body), `empty-state.tsx` (the canonical empty state), `empty-screen.tsx` (a whole
  screen that has nothing in it yet).
- Each of the 7 pages is currently `<EmptyScreen>` only. As a screen gets real content it keeps
  `AppPage` and renders `EmptyState` just for its empty case.
- Verified: `next build` prerenders all 7 routes; eslint clean. **Not yet opened in a browser.**

### Identities and real data (2026-09-21)
- Teams and people carry **seeded generative identities** — [[0015-seeded-generative-identity-system]].
- The shell reads **`/auth/me` and `/org-chart/{org_id}`**, not a fixture —
  [[0016-app-reads-the-backend-not-fixtures]]. `/org-chart` is the first screen on real data: team
  cards with their generated icon and member count, plus loading, empty and error states.
- The sidebar has a **toggle** (Sage_v1's behaviour, icon flips with state, tooltip; no white pill).

### Dashboard, org chart graph, dialogs (2026-09-21)
- **`/dashboard` is the app's home** and reflects every onboarding answer —
  [[0018-dashboard-reflects-onboarding]] has the full mapping of question → table → what shows.
- **`/org-chart` is a graph**: owner at the top, teams spread beneath, dotted canvas, draggable cards,
  measured bezier connectors (`flow-canvas.tsx`, generic over rows/widths/edges).
- **Settings is a dialog**, not a route — [[0017-dialogs-over-settings-screens]] records the dialog
  taxonomy (shell, `size`, `kind`, entrance, safe exit).
- **Open question:** the topbar's **Alerts** and **New** are drawn but not wired. Knohow has no
  notifications, and there is nothing to create until documents exist. What should each do?

### Still to do
- Enforce the `organizationId` requirement on every data-access function as real reads appear.
- The six screens other than `/org-chart` are still empty states: there is no data behind them yet.
- Nothing links into the app yet: after `setup_step = done` the founder still lands on the landing
  page. Wiring that redirect is a separate ask.
- Backend endpoints for DeepSearch and the org chart do not exist yet.
- `⌘K` is drawn on the sidebar's search field but not bound to anything.

## Open questions
- What is the first screen after `setup_step = done`? `/workspace` is the obvious default but the
  user has not confirmed it, and nothing redirects there yet.
- ~~Separate tabs or widgets on one dashboard?~~ **Answered 2026-09-21:** sidebar + one route each.
- ~~What does the empty state look like before documents are synced?~~ **Answered 2026-09-21:** the
  Sage_v1 pattern, rebuilt Knohow-native. Final copy still the user's.
- Which screen does the user want built first, and does the sidebar need an org switcher / sign-out?

