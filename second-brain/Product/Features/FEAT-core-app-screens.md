---
type: feature
status: in-progress
tags: [area/frontend, status/in-progress]
created: 2026-09-21
updated: 2026-10-04
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
  know: the file is **subsetted** to the icons in `APP_ICONS` (~3KB, fetched with `&icon_names=…`; the full
  variable font is 3.8MB), so **adding an icon means re-fetching the subset**, and icons are addressed
  by **codepoint** rather than ligature name so a subset without a ligature table can never render as
  the literal text "folder_open". Sidebar toggle uses `left_panel_close` / `left_panel_open`.
  `lucide-react` stays in use on the landing and setup screens.

- Composes existing tokens (`satoshi`, `sohne`, `#f9f8f6`, `#1c1917`) plus a new app-chrome set in
  `globals.css`: `--app-sidebar-w`, `--app-border`, `--app-muted`, `--app-active`, `--app-dim`.
- Screen copy currently in the tree is **draft**, written from each feature's Goal line. The user
  owns final copy.
- **Workspace title `?` (Ronald, 2026-10-04).** A `CircleHelp` button right of "Workspace" in the
  topbar opens the app tooltip (`brand/tooltip`) on **click**, not hover; it stays up until a press
  outside or Escape. Screens hand topbar extras up through `TitleAside` / `TitleHelp`
  (`src/components/app/title-aside.tsx`, provider in `AppShell`). Content changes with the viewer:
  a fixed line on what the librarian does, then one role line (Super Admin > owner > lead, none for
  members), then status: Drive not connected (from `GET …/drive-preview`), or the to-sort /
  put-forward / waiting-for-a-lead counts, or "Nothing waiting for you." **Copy is a draft** built
  from the Help screen and Workspace's own lines; Ronald to edit. Checked in Playwright Chromium on
  local `/demo` (Super Admin view).
- **Sharing "Owned by" lead chip (Ronald, 2026-10-04).** The owner row on each Sharing team card
  shows Home's `Badge` "Lead" beside the person instead of a grey "(lead)". Offboarding's "Who takes over"
  picker now uses the `Badge` too (Lead / Owner), in its own swap-in dialog (2026-10-05).
- **Notifications' Librarian groups indented (Ronald, 2026-10-04).** Under LIBRARIAN, each tab's
  name (Workspace, Ownership, Sharing, Offboarding) sits in 16px (`pl-4`) and its rows 32px
  (`TaskRow indent` → `pl-8`), so the three levels read as a tree. `notifications-dialog.tsx`.

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
  page heading both read it, so they cannot drift. There is no `/search` route any more (see
  "Search is a modal" below).
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
- The sidebar has a **toggle** matching Sage_v1 (white pill, icon flips with state, tooltip).
  Notifications has a tooltip ("Notifications").

### Dashboard, org chart graph, dialogs (2026-09-21)
- **`/dashboard` is the app's home** and reflects every onboarding answer —
  [[0018-dashboard-reflects-onboarding]] has the full mapping of question → table → what shows.
- **`/org-chart` is a graph**: owner at the top, teams spread beneath, dotted canvas, draggable cards,
  measured bezier connectors (`flow-canvas.tsx`, generic over rows/widths/edges).
- **Settings is a dialog**, not a route — [[0017-dialogs-over-settings-screens]] records the dialog
  taxonomy (shell, `size`, `kind`, entrance, safe exit).
- **Open question:** the topbar's **Alerts** is drawn but not wired (Knohow has no notifications yet).
- ~~**What does New create?**~~ **Answered 2026-09-22:** **Doc · Sheet · Slide · Upload**. Forms and
  other Workspace types stay out. Not built yet — topbar New is still a dead control; when wired it
  opens this set (same auto-share / auto-file idea as [[FEAT-doc-creation-auto-share]], plus upload
  into the team/Company folder).

### Home's owner card names Super Admin (Ronald, 2026-10-04)
The org chart's owner card meta reads "Owner · Super Admin · you" when the owner is a confirmed
Super Admin (`isSuperAdmin` on the overview member), otherwise "Owner · you" / "Owner" as before.
Later the same day Ronald asked for **Owner** and **Super Admin** as `Badge` chips (the grey chip
used for Lead / New) under the name, with "you" kept as plain meta text after them
(`home-screen.tsx`, owner card).

### Search is a modal, not a screen (Ronald, 2026-10-04)
Ronald: Search doesn't need its own screen. The top bar's Search pill is now a real input
(`topbar.tsx`, ⌘K focuses it). Type, press Enter, and `SearchDialog`
(`src/components/app/search-dialog.tsx`) opens over the current screen with the same results as the
old screen: count, Docs/Sheets/Slides/Other tabs, and title / team / owner rows. It is `size="lg"`,
a little wider than the other dialogs (`sm`), and the team and owner columns are fixed at 9rem each so
they sit close to the title instead of being pushed to the far right. The dialog's title is the query
in quotes. `AppDialog`'s `footer` is now optional (the results have no action). Removed:
`src/app/(app)/search/`, `screens/search-screen.tsx`, `APP_SEARCH`, and `/search` from `proxy.ts` and
`NAV_ICONS`. Search no longer debounces as you type; it runs on Enter.

### Sharing rules are customisable (Ronald, 2026-10-04)
Ronald picked all four: **who new files go to**, **drop the "plus Alex"**, **who owns them**,
**access level**. Each team card on Sharing has **Edit** (owner, Super Admin or that team's lead) →
"<Team> rule" dialog: team members with checkboxes (untick = left out), a switch for the top
leaders, "Also share with" (other teams / people, picked from a select, removable chips), Access
(Can edit / Can comment / Can view), Owned by (domain accounts only; picking the lead again means
"follow the lead"). The card now reads e.g. "Everyone on Design except Sam, plus everyone on Sales
and Alex" and shows an **Access** row.
Backend: `teams` columns `share_top_leaders`, `share_extra_member_ids`, `share_extra_team_ids`,
`share_excluded_member_ids`, `share_role`, `owner_override_id` (migration `0023`, dev + test DBs
upgraded). `resolve_auto_share_recipients` (`sharing/visibility.py`) applies the rule;
`_auto_own_target` + `governance._ownership_target` prefer `owner_override_id`; `share_role_for`
sets the Drive role for auto-share and confirmed suggestions. `PUT
/organizations/{org}/teams/{team}/sharing-rule` validates + audits (`sharing.rule_changed`).
Tests: `tests/test_sharing_rule.py`; backend 213 passed. Not clicked through in a browser.
**Dropdowns redone (Ronald, same day: "looks nothing like" the app, no logos):** native `<select>`s
replaced by `PickerMenu` in `sharing-screen.tsx`, drawn like Manage teams' link lifetime menu (white
pill + chevron, rounded white popup, `z-[550]` over the dialog). "Add a team or person" lists Teams
(with `TeamIcon`) and People (with `PersonAvatar`); picked chips carry the icon/avatar too. "Owned
by" shows the owner's avatar, name and Lead badge, with a check on the current pick ("The company
owner" is offered only when the team has no lead).
**Add opens its own dialog (Ronald, same day):** "Add a team or person" is now an outline button
(New team's plus) that swaps the rule dialog for an "Add a team or person" dialog, the same
close-then-open hand-off as Manage teams → New team (`MODAL_SWAP_MS`, backdrop held). It lists Teams
(30px `TeamIcon`, "Everyone on X") and People (30px avatar) as tick rows; **Add** puts them on the
rule and swaps back. The draft rule lives on the Sharing screen so it survives the swap. "Owned by"
still uses the `PickerMenu` dropdown.
**Rows read left to right (Ronald, same day):** "Also share with", "Access" and "Owned by" are each
one row, label left and control right (`ROW_CLASS`), like the "Plus Alex" switch; added chips wrap
under their row, right-aligned. The "Owned by" pill shows avatar + name + **Owner** badge (not Lead;
Ronald picked it). The team list stays under its heading.
**Badges, and no bare "Plus Alex" (Ronald, same day):** the top leaders are listed as person rows
(avatar, full name, badges) under the team's members, with the one switch on the right. Every person
in the rule dialog, the Add dialog and the owner list carries `PersonBadges`: **Owner** (company
owner), **Lead** (this team), **Super Admin** (never bare "Admin"). `/sharing` now sends
`owner_id` and each person's `super_admin` (from `super_admin_verified_at`).
The "Owned by" list always opens upward (`side="top"`) and its pill's arrow points up (Ronald).
Notifications tweak same day: Librarian group labels are near-black and groups are 20px apart.
Group labels sit 16px in under LIBRARIAN; rows were 32px in, then pulled back at Ronald's ask
("un tab these") so they line up with their label at 16px.

### Screens' prompts become the Librarian; explanations become the `?` (Ronald, 2026-10-04)
Ronald's rule: a bar that explains a screen is **help** (the title's `?`, `TitleHelp`); a bar or list
that prompts you is the **Librarian**. No grey bars at the top of these tabs any more.

- **Help (`?`)**: Ownership ("Owned by the company" text), Sharing ("Access follows your teams"),
  Offboarding ("When someone leaves"). Workspace already had one. The Help screen keeps its bar.
- **Librarian tasks** (new kinds from `GET /organizations/{org}/tasks`, no Drive calls):
  `librarian_sort` / `librarian_review` (Workspace; `task_counts` in `librarian/service.py`),
  `ownership_review` (one per planned move) + `ownership_stuck` (owner / Super Admin / lead only),
  `share_suggestions` (your own files waiting on a share), `offboarded` (one per person, a report,
  **cleared** per browser with the same localStorage list as a team update's minus; Ronald picked
  clearable). Built in `governance_tasks` (`api/routes/governance.py`).
- **Genie pills on each tab** (`LibrarianPopup` in `notification-center.tsx`): when a tab has its
  Librarian tasks, the pills pop up once per visit, act on that tab's own dialog, and genie into
  the bell. Workspace = sort/review, Ownership = moves + can't-move, Sharing = files to share,
  Offboarding = offboarded (button clears).
- **Notifications**: tabs Pending · Librarian · Teams (Librarian got its own tab, Ronald
  2026-10-04; superseded the LIBRARIAN header under Pending and the indented groups). Pending
  holds **Tasks** (title with lucide `ListChecks`). Librarian has one section per tab
  (`LIBRARIAN_GROUPS`), titled like Tasks with that tab's sidebar icon, rows flush. Dialog is the
  new `md` size (`max-w-lg`, 512px) so three tabs + Clear all fit. Buttons go to the tab with `?librarian=` / `?review=` / `?stuck=1`, which
  opens the matching dialog (`useUrlRequest` in `screen-kit.tsx`; those pages now have Suspense).
- Sharing's "Waiting for you" list moved into a "Waiting for you" dialog on Sharing. Offboarding's
  "Already offboarded" list is only in the bell now. The just-offboarded "X is offboarded" bar
  stays (it's the result of your own action).
- Workspace's "Your librarian" bar (Sort my Drive) shows only when nothing is waiting.

Checked: `tsc`, eslint (only a pre-existing `topbar.tsx` set-state-in-effect error), backend 210
passed (`test_librarian_counts_are_tasks`; sandbox asserts every new kind). Pages return 200; not
clicked through in a browser.

### New folder dialog: preview + colour (Ronald, 2026-10-04)
Ronald found the New folder dialog too wide for one field. It is now the `sm` dialog with a live
preview on top (the grid's `Folder`, `decorative` so it isn't a button, name under it as typed),
then Name, then **Colour**: four circles, **blue (default), green, orange** (Ronald's pick) and a
**custom** circle (rainbow until used; it opens the system colour picker and then fills with the
pick). The colour is saved: `knohow_folders.color` (`#rrggbb`, null = blue; migration `0022`,
`create_folder` validates it) and the Folders grid draws each folder in its colour. `Folder` derives
flap/edge from one base colour (`themeFor` in `folder.tsx`); blue keeps the original drawing's
values. Team folders have no colour yet (they're made by the backend, so blue). Checked: `tsc`,
eslint, backend 209 passed (new `test_folder_keeps_its_colour`). Not yet looked at in a browser.

### Folder details view + renamed files update (Ronald, 2026-10-04)
Ronald (voice note) asked for two things inside a Workspace folder.
- **Details view.** Two icon buttons (grid / list) sit before "Add files" in `FolderView` (`workspace-screen.tsx`); details shows the same table as Ownership: Name (with "Doc · Edited …"), Team, Owner. Ownership's table now lives in `src/components/app/file-table.tsx` (`FileTable`) and both screens render it; Ownership passes `selected`/`onToggle` for its checkboxes, the folder doesn't. The type filter applies to both views. The choice isn't remembered between visits. Ronald also mentioned "who created it / who last edited it" and settled on the owner; last editor isn't stored, so it isn't shown.
- **Renamed files update.** `FileIndex.title` was only refreshed by the 6-hourly reconciliation sweep, so a Doc renamed in Google kept its old name in Knohow. `folder_detail` (`backend/app/librarian/service.py`) now re-reads name + edit time from Google (through each file's owner's Drive client) for rows not synced in the last 15s (`REFRESH_AFTER`), saves them, and re-sorts. An owner Google won't answer for keeps the stored names. `FolderView` reloads on tab focus / visibility, so coming back from Docs shows the new name. `folder_detail` also returns `owner` and `team_name` per file. Test: `test_opening_a_folder_picks_up_a_rename_and_says_who_owns_it`. Not refreshed live elsewhere: the Folders grid previews and Ownership still read stored titles (they pick up the folder's refresh, or the sweep). Backend 218 passed; tsc + eslint clean. Not clicked through in the browser.

### Click pop-over: Rename / Delete; Settings Trash + Logs (Ronald, 2026-10-04)
Decision and rules in [[0033-rename-delete-from-knohow-trash-and-logs]]. Built:
- `ItemMenu` + `RenameDialog` in `src/components/app/item-menu.tsx`: one Base UI menu per screen, anchored to the clicked element, Pencil "Rename" and Trash2 "Delete", styled with the profile menu's exported `MENU_POPUP` / `MENU_ITEM` / `MENU_LAYER` (12rem wide). Items grey out without permission.
- Folders grid: a click waits 250ms then shows the pop-over; a double click opens (`Folder` got `onDoubleClick`, and `onOpen` now gets the click event; keyboard click opens). Folder delete reuses the "Delete X?" confirm.
- Inside a folder: each `FileCard` is now a button; details rows take `onRowClick` (`FileTable`). Delete trashes straight away (no confirm, since it's restorable) with a toast "Moved to Trash / … can be restored from Settings for 30 days."; a failed rename/delete shows a red line under the header.
- Settings dialog: **Trash** (always shown; Restore per file) and **Logs** (owner / Super Admin). Labels via `actionLabel` in `src/lib/change-text.ts` (new actions added there).
- Backend: `PATCH …/folders/{id}`, `PATCH …/company-files/{file_id}`, `POST …/company-files/{file_id}/trash|restore`, `GET …/trash`, `GET …/audit/log`; per-file `can_manage` in folder detail, per-folder `can_manage` in the list. Migration `0024_file_trashed` (dev + test DBs upgraded). Tests: `test_rename_and_trash_go_through_the_owner_and_can_be_undone`, `test_only_owner_lead_or_top_may_rename_or_trash`, `test_custom_folder_renames_team_folder_does_not`. Backend 221 passed; tsc + eslint clean; `/workspace` compiles. **Not clicked through in the browser** (backend wasn't running).
- Copy I wrote and Ronald may want to change: the toast, "Nothing in Trash. Files deleted in Knohow stay here for 30 days.", "Deleted by X · Gone in N days", Logs' "Nothing yet.".

### Workspace empty state gets its action (2026-09-23)
`/workspace`'s empty state now carries a **primary button: "Connect your Google Drive"** (user copy;
"Google Drive" written the way the landing writes "Google Workspace"). `EmptyScreen` gained an optional
`action` prop that it forwards to `EmptyState`'s existing `action` slot, so any screen can pass its one
action. The button is **not wired to anything yet** — no handler, no backend call; `src/` stays mocked
per [[0001-mocked-data-first-prototype]].

### Superseded: org chart + oversight merged (2026-09-22)
`/org-chart` and `/oversight` no longer exist as screens. Both were folded into `/dashboard` —
[[0019-dashboard-absorbs-chart-and-oversight]]. The 7-screen list above still describes the *features*;
it no longer describes the *routes*. Remaining screens: Workspace, Ownership, Sharing, Offboarding,
Search (plus Help; Settings is a dialog).

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

### New → name and teams before creating (Ronald, 2026-10-04)
Ronald (voice note) wanted a new Doc / Sheet / Slide / Form to land in the right team's folder and show up in Notifications. Picking a type in the topbar's New menu now opens a small `sm` dialog (`NewFileDialog` in `src/components/app/new-menu.tsx`): a **Name** field (blank = Google's "Untitled …") and, only when there's more than one team to choose, **Which team is it for?** with Sharing's round-check rows. Anyone ticks any of their own teams; the **owner** sees every team plus **All teams**. One team or none skips the picker. Ronald picked each of these (2026-10-04).
- **Backend:** `POST …/documents` takes `name` and `team_ids` (`backend/app/documents/service.py`). The first chosen team is the file's `team_id`; the rest go in `sharing_state["extra_team_ids"]`, which `can_view_file` honours. The file is added to every chosen team's folder. Picking a team you're not on is a 403 (owner excepted). No `team_ids` keeps the old behaviour (first own team).
- **Notifications:** the `document.created` audit entry lists all `team_ids`, and `activity/changes.py` now counts an entry for every team it lists, so each team's Notifications shows "Document created · name". The creator gets a toast ("“Test 1” was created in Marketing.") and the overview re-reads, so it's in their Teams tab right away. This is a deliberate exception to the "never toast your own actions" rule in `app-toasts.tsx`.
- **Checked:** 4 new tests in `backend/tests/test_librarian.py` (name + two teams + visibility + feed, refusing someone else's team, owner any team, one-team default); full backend suite 217 passed; `tsc` + eslint clean. Not clicked through in the browser, because that creates a real Google file.
- **Sandbox name fix (Ronald, 2026-10-04):** Ronald made "Monday" in the sandbox (Acme) and Google opened "Untitled document". The sandbox Drive never calls Google; it returned a `docs.new` link, which can't carry a name. `app/sandbox/drive.py` and the frontend fallback (`newFileUrl` in `new-menu.tsx`) now use Google's `…/document|spreadsheets|presentation|forms/create?title=` links instead. Real orgs were already fine: Drive `files.create` names the file. Sandbox + librarian tests pass (40).
- **Toast at the top, like Sage's (Ronald, 2026-10-04):** Ronald didn't see the created toast and asked for Sage's toast, at the top. Every app toast (`app-toasts.tsx`) now sits top right under the topbar (`top-[4.5rem]`, 19rem wide), drops in from above and swipes away up or right (`.app-toast` in `globals.css` re-anchored to `top`). The card follows Sage's shape, rebuilt in Knohow (no Sage code or tokens, invariant 5): an icon (green `CircleCheck` for `type: "success"`, else `Info`), a bold title over a grey line, and an X at the top-left corner on hover. The New toast reads "Document created" / "“Monday” is in Marketing." and waits for the Knohow tab to get focus back, since the file opens in another tab and the toast used to time out unseen.
- **Files open in Google (Ronald, 2026-10-04):** a mouse click on a file in a Workspace folder (grid card or details row) opens it in a new tab. Right-click / keyboard still opens the Rename / Delete / Move menu, which another session had already moved to right-click the same day. The backend's `_file_view` now sends `web_view_link` from `file_link()` in `librarian/service.py`. For real orgs that's `drive.google.com/open?id=…`, which picks the right editor for any type. In the sandbox it's Google's `create?title=` link, so each click makes a new blank file with the same name. Ronald picked that over no link or real copies. `FileTable` got `onRowOpen`. Test: `test_folder_files_carry_a_link_to_open_them`; backend 222 passed.
- **Toasts look like the Librarian's pills (Ronald, 2026-10-04):** Ronald asked for the toast to match the Librarian pills (`NotificationCard`). Every app toast is now black glass (`rgb(0 0 0 / 0.8)` + 24px blur, 22px corners, the pill's shadow), the icon white in a `white/12` circle (still `CircleCheck` for success, `Info` otherwise), the title in Söhne 1rem white over a `white/70` line, an action as a white pill button on the right, and a dark X on hover. And like the pills, a press anywhere but a toast sends every toast away (`close()` on a capture-phase `pointerdown`), with the press still reaching what was pressed. Files: `app-toasts.tsx`, `.app-toast` in `globals.css`. Typecheck and lint clean; not seen in a browser yet.
- **Bell badge digits level (Ronald, 2026-10-04):** Ronald said "28"/"29" sat crooked. First guess (trimming each digit to cap height) was wrong and is reverted: Satoshi's metrics put digits within 0.02em of centre. The real cause: each `DigitColumn` was offset by `-value × 1.3em`, so the ones column of 29 moved ~285px and the tens ~20px, and the two rounded to different sub-pixels. Tiles and the roll are now measured from the column's current digit, so every column rests at exactly 0 (`notification-bell.tsx`). Lesson in [[Lessons-Learned]].
- **Owner card "· you" beside the name (Ronald, 2026-10-04):** on Home's owner card, "you" moved from after the Owner / Super Admin badges to a dim "· you" right after the name (`home-screen.tsx`). **Capitalised to "· You" (Ronald, 2026-10-04).**
- **Dot-line updates and toasts (Ronald, 2026-10-04):** Notifications' Teams rows and the New toast now share `DotLine` (`components/app/dot-line.tsx`): "Document created · (avatar) Alex Morgan · (team icon) Engineering". When a change reached several teams, the first line is what + who and each team gets its own line under it (Ronald picked this over wrapping inline). The toast is the same without the "what" (the title says it): "Spreadsheet created" / "(avatar) Ronald · (icon) Engineering". No file name anywhere (Ronald removed "“Mike” is in Engineering."). Backend: each feed event now carries `team_ids` (`activity/changes.py`), mapped to `ChangeEvent.teamIds`; `change-text.ts` gained `changeParts` (what + actor), `describeChange` builds on it. Rows no longer truncate; they wrap. Backend 222 passed, lint/tsc clean, not seen in a browser. Open: with many teams (owner picking All teams) the toast gets tall; capping it is Ronald's call.
- **Follow-ups (Ronald, 2026-10-04):** Notifications rows dropped the team part (they already sit under their team heading); the toast keeps it. A created file now says its type: the feed sends the audit's `details.kind` as `kind`, and `changeParts` maps doc/sheet/slide/form to "Document/Spreadsheet/Presentation/Form created" (older entries without a kind stay "Document created"). The New dialog's team rows got a 4px gap (`gap-1`) so ticked rows read as separate pills.
- **Toast teams fold into a count (Ronald, 2026-10-04):** one line per team made a six-line toast that "makes no sense". `DotLine` now shows several teams as up to 3 overlapped team icons + "N teams" ("All teams" when it's every team in the org), so the toast is title + one line: "Document created" / "(avatar) Alex Morgan · (icons) All teams". Also fixed a hydration error: Base UI's `Toast.Description` is a `<p>` and the avatar's orb is a `<div>`; it now renders as `<div>` (`render={<div />}` in `app-toasts.tsx`).
- **"Multiple teams" (Ronald, 2026-10-04):** replaces "N teams" / "All teams" in `DotLine`: more than one team shows the team icons overlapped like the org chart's `MemberStack` (three at most, then a circle with only a plus when there are more than three) + "Multiple teams". `tone="dark"` on the toast so the overlap rings match the black glass. The `everyTeam` prop is gone.
- **Toast wider + genie (Ronald, 2026-10-04):** toasts are now 360px (`sm:w-[22.5rem]`, the Librarian column's `COLUMN_PX`) so "(avatar) Alex Morgan · (icons) Multiple teams" stays on one line and the toast is as short as a pill. A press outside now genies them into the bell instead of just closing: the flight was pulled out of `NotificationCenter` into exported `flyIntoBell(shots, to, done, zIndex)` + `bellCentre()` in `notification-center.tsx`, and `app-toasts.tsx` snapshots the toasts 550ms after they drop in (html-to-image, `transform: none` so the stack's offset comes from each rect), hides them, closes them and flies the snapshots at z 550. Reduced motion or no bell just closes. Lint/tsc clean; not seen in a browser.
- **Toasts stay until pressed away (Ronald, 2026-10-04):** `Toast.Provider timeout={0}` (was 8000): no auto-dismiss, a toast stays until a press elsewhere genies it into the bell, like the Librarian pills. Applies to every app toast (Pending tasks and team changes too).
- **Name doesn't stick on every type in the sandbox (Ronald reported, 2026-10-04):** see [[Known-Issues]]. Sandbox-only; the real Drive path names every type.
- **Toast dismiss is the red minus (Ronald, 2026-10-04):** the hover X at the toast's top-left is now Notifications' red minus (18px `#EA4335` circle, white bar), same spot, shows on hover/focus. It genies its own toast into the bell (Ronald: "the minus closing doesn't trigger the genie"): `ToastList` now has one `genie(id?)` used by both the press-outside listener (all toasts) and the minus (that toast), with snapshots cached per toast id (`data-toast-id`) and only the flying toasts hidden.
- **Not done:** a rename made later in Google doesn't reach Knohow (the title is saved at creation). Teammates get the bell count, not a toast.

