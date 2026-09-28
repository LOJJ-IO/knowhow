---
type: context
status: active
tags: [priority/high, area/frontend, area/backend]
created: 2026-08-31
updated: 2026-09-27
related: ["[[FEAT-legal-pages]]", "[[FEAT-landing-book-a-demo]]", "[[FEAT-landing-deck-carousel]]", "[[FEAT-landing-header-nav]]", "[[FEAT-landing-deck-notes-folder]]", "[[0004-landing-only-purge-old-app]]", "[[0004-fastapi-backend-for-auth-and-identity]]", "[[Patterns-landing-mc-recess-deck]]", "[[Known-Issues]]", "[[Architecture-Overview]]", "[[FEAT-workspace-onboarding-flow]]", "[[FEAT-drive-file-classification]]", "[[0006-observed-domain-tenant-identity]]", "[[0007-shared-drive-support]]", "[[0008-continue-with-google-via-backend]]", "[[0009-contractor-work-created-as-the-org]]", "[[0010-deletes-go-to-trash-30-days]]", "[[0011-device-remembered-accounts]]", "[[0012-identity-linking-one-person-many-accounts]]", "[[0013-sign-in-is-to-an-organization]]", "[[0021-founder-not-owner-leads-self-claim]]", "[[0014-org-setup-and-join-link]]", "[[FEAT-core-app-screens]]", "[[0022-landing-and-app-on-separate-origins]]", "[[0023-founder-setup-google-check-before-owner]]", "[[0024-own-drive-consent-for-work-accounts]]", "[[0025-linked-personal-drive-visible-to-owner]]", "[[0026-notifications-tasks-and-updates]]"]
---

# Current Context

## Org onboarding model locked + built (2026-09-26)
User confirmed A–I. **[[0021-founder-not-owner-leads-self-claim]]** supersedes [[0014-org-setup-and-join-link]] on ownership / leads / join approval / who reissues the link. Summary: **founder ≠ owner**; SA > owner > team lead; first **lead claim** wins; join is a **request only if a lead exists**; later multi-leads; **one org-wide link** (team leads can reissue); owner-on-join is a **claim**; SA is undo/exceptions; multi-team + per-team lead Y/N → app. Workspace connect: Google-check → Connect, or know-who → email / don’t-know → copy open link. Tooltips for Owner + Super Admin.

**Shipped on `main` 2026-09-26 (Phases 0–4):** privacy FileIndex fixes landed; founder `OrgSetupForm` rewritten; `create_org_chart` no longer requires `is_owner`; join token in OAuth state + domain lock; `JoinPlacementForm`; migration `0018` (`team_join_requests`, `pending_owner_member_id`, `join_placement_completed_at`); Settings reissue + team-join approvals; tests in `backend/tests/test_join_placement.py`. Spec: [[FEAT-workspace-onboarding-flow]].

**Standing fix (2026-09-26):** the 403 "membership not yet approved by the organization's owner" was hitting people ADR-0021 never approves. Now the **founder is `approved` when the org chart is created** (owner or not), and a joiner placed directly on a lead-less team is approved. Only a joiner with a **pending team request** stays `auto_affiliated`; Home shows a dark grey "not approved by the founder yet" note for them instead of the raw API error (founder never sees it). Old test assertion in `test_domain_check.py` updated. 3 `test_team_setup.py` link tests were already failing (stub actor lacks `organization_id`, `service.py:464`), not touched.

**Connect + join-team list (2026-09-26):** Connect Workspace auto-starts Google’s admin check (no “Check with Google” click; invite-someone remains after a failed check). `GET /org-chart/{id}` uses any-standing so joiners see team pills instead of a standing 403 on the join wizard.

**Invite step copy (2026-09-26):** `invite-link-step.tsx` offer body now reads the ADR-0021 order in steps: "They pick a team, one claims lead, and the lead approves newcomers." (was "They pick their team; that team's lead approves when needed.")

**Invite link ready screen (2026-09-26):** Copy now sits inside the link pill (`SetupCopyLink` in `setup-share-action.tsx`: read-only field + black Copy→Check button, resets after 1.6s), and the screen's main button is **Continue** (finishes setup). Copying no longer advances. Connect-Workspace's "Share this link" screen got the same pill + Continue; the old standalone `SetupShareAction` (Copy that also finished the step) is removed. **2026-09-27:** the black Copy button is gone: `SetupCopyLink` now renders the delegation guide's `CopyField` (now `src/components/ui/copy-field.tsx`, the app-wide copy look per [[UI-Consistency-Rules]] 13a, with a black "Copy"/"Copied" tooltip on the icon): 40px field with an in-field copy icon that turns into a check, with an `execCommand` fallback that says when copying failed. No visible label on the link screens (`showLabel={false}`); the delegation fields keep theirs.

**Connect step reuses the "didn't confirm" screen (2026-09-26):** when `/auth/me` has `admin_proof_attempted` and not `is_super_admin`, `ConnectWorkspaceStep` skips `4ee5629`'s auto-start and renders the existing `SignInResultPanel` `admin_not_verified` screen (Invite someone else → know-who, Continue to the app). Body copy restored to the pre-`58541a9` line "You can keep using Knohow. You can invite your Super Admin later." (user 2026-09-26); heading and buttons unchanged. User chose (2026-09-26) to **keep the Super Admin check separate from sign-in**: sign-in stays `LOGIN_SCOPES` only; the Directory-readonly consent is founder-only and its token is discarded, so each check is a Google round trip (silent after first consent).

**Google result screens (2026-09-26):** `SignInResultPanel` shows a drawn-in mark above the heading (`ResultMark`, using the Transitions.dev `.t-success-check` CSS in `globals.css`): tick on `admin_verified`, X on `admin_not_verified`. `admin_verified` now waits for a **Continue** button (the 2.5s auto-advance from `4ee5629` is removed, which also cleared its render-time ref lint error) and its body drops "Taking you to the app…".

**Card screen changes sequenced (2026-09-27):** user saw the teams count → names change and the Super Admin tick "glitch". Cause: `LoginModal` tweens height (300ms) while new content swaps in instantly and the centred card grows both ways; the tick's spin/blur/bob ran during the card's open. Now `LoginModal` hides the new body (`data-swapping`, set on the DOM so it lands before paint) for 180ms when the measured height changes by ≥48px while open, then fades it in (220ms) over the resize's tail. Skipped for small changes (error lines) and Cal's iframe (`.t-demo-booking`); reduced motion never hides. `ResultMark` starts 320ms after mount (after the card's open) instead of next frame.

**Resume on the invite copy screen (2026-09-26):** new `GET /organizations/{org_id}/join-link` (`live_join_link` in `onboarding/service.py`, same role check as create; returns `{url: null}` when none is live). `InviteLinkStep` calls it on mount: a live link means the founder left before pressing Continue, so it opens on the copy screen with that link instead of "Ready to bring everyone in?" (making a new link would revoke the old one). Tests in `test_join_placement.py`. Local `knohow_test` DB was at 0016; upgraded to 0018.

**Delegation guide UI (2026-09-26):** After `admin_proof=verified`, `AppEntry` (was the landing sheet before the split below) shows [[FEAT-workspace-onboarding-flow]]’s Admin console step (`DelegationConnectStep`): client ID + scopes to paste, open Admin, check via `POST …/delegation/check`, or skip to app. Same step when Connect Workspace resumes for an already-proven Super Admin.

**Result screens' main buttons (2026-09-27):** in `sign-in-result.tsx`, `admin_error`'s "Try again" and the personal "What should we call your workspace?" Continue are now the black bottom-right `SetupAction`. The workspace name uses `SetupField` (inset 2.5%) and, like the other setup screens, Continue is never disabled: an empty name shakes the field. "Continue to the app" on `admin_not_verified` only shows when setup is already `done` (the check only starts from setup, so that's rare, e.g. reopening an old result URL).

**Delegation guide restyled (2026-09-27):** matches the Super Admin check screen: headings use the colourful `GoogleWord` ("Connect Knohow to Google.", "Knohow is connected to Google."), and **Open Google Admin** is the black bottom-right `SetupAction` with the Google G. "I've added it, check now" and "Skip for now" stay as white stacked choices above it (user-picked; the check button was later replaced by auto-check on return, see below).

**Manage accounts "Signed in" nudged right (2026-09-27):** in `manage-accounts-dialog.tsx` the note sits `-ml-2 -mr-3` (flush with the row's right edge, 4px gap) so ~20px more of the email shows (user). Long emails can still truncate.

**Drive consent 500 fixed (2026-09-27):** "Connect Google" for your own / a linked personal Drive crashed on Google's callback (missing `openid` scope → no `id_token`). Details in [[Known-Issues]]; retry the connect, it should land on `/workspace?drive_connected=1`.

**Open Google Admin prefills the dialog (2026-09-27):** `DelegationSetup.admin_console_url` (`backend/app/auth/delegation.py`) is now `…/ac/owl/domainwidedelegation?overwriteClientId=true&clientIdToAdd=…&clientScopeToAdd=…`, which opens Admin's "Add a new client ID" dialog already filled in. The admin only clicks Authorize. The parameters aren't in Google's docs (Google's own `create-service-account` tool uses them), so the copy fields stay as the fallback. `overwriteClientId=true` replaces the client's existing scopes with our full list, so re-running also fixes a grant that's missing scopes. Body copy now reads "Click **Open Google Admin**. Everything's filled in, so just click **Authorize**. When you come back, we'll check automatically." (user asked for copy reflecting the simpler flow, 2026-09-27). **Auto-check on return (user, 2026-09-27):** the "I've added it, check now" button is gone. Clicking Open Google Admin arms `POST …/delegation/check` on every `visibilitychange`→visible / window `focus` while the guide is showing. "Skip for now" stays. A failed check shows "Google hasn't authorized Knohow yet. Click Authorize in Google Admin and we'll check again when you're back." (or the missing-scopes line). If they authorized in Admin without using our button, only the scheduler's periodic check or a reload picks it up. **`SetupError` now inset `mx-[2.5%]`** (all setup screens) so error lines align with the white buttons and fields ([[UI-Consistency-Rules]] 6a). **Formatted errors (user, 2026-09-27: "not just a dump"):** `SetupError` takes an optional bold `title`, a bulleted `items` list and `children` as the next step (plain `children` still works as a one-liner everywhere else). The delegation step uses it: missing scopes show as "Google authorized some of Knohow, but not all of it." + bullets with readable names ("Google Drive", "Drive activity reports (read-only)", fallback strips the googleapis prefix) + "Open Google Admin again and click Authorize."; pending, load and check failures get a title + next-step line. Backend `/delegation/check` 502 no longer puts Google's raw exception in `detail`: it logs `delegation.check_failed` and returns "Google didn't answer. Try again in a moment." Test: `test_delegation_setup_guide_lists_client_id_and_every_scope`.

**Phase C proven locally (2026-09-26):** `delegation_grants` for `knohow.app` is `approved` (admin@knohow.app; drive + reports scopes). A delegated Drive call as that member succeeds (`about` + `files.list`, empty Drive). New `GET /organizations/{org}/drive-preview` (`backend/app/api/routes/drive_preview.py`) reads the caller's OWN 24 latest files live, stores nothing, never touches `FileIndex`. `/workspace` now renders `WorkspaceScreen` (file cards from that endpoint; empty/not-connected/error states). This is a connection proof, not the librarian (Phase D still unbuilt). Delegation copy fields got in-field copy icons. Folder component still to build: blue theme only, per user.

**Landing and app split (2026-09-26):** [[0022-landing-and-app-on-separate-origins]]. Prod: landing on knohow.app, sign-in + onboarding + app on app.knohow.app, routed by `src/proxy.ts` (renamed from `middleware.ts` per Next 16). Sign-in/onboarding moved out of `landing-hero.tsx` into `AppEntry` (`/entry`, the app origin's `/`) on a shared `SignInSheet`; the landing keeps Book a Demo and slides Log In up, then hands off. Locally the env vars stay unset, so one origin serves both (`/entry`). **To ship:** point both domains at Vercel, set `NEXT_PUBLIC_SITE_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN`, and on the backend `FRONTEND_ORIGIN=https://app.knohow.app` + `SITE_ORIGIN=https://knohow.app`.

**Home team card divider (2026-09-26):** per the user's reference, the card header is an inset panel (card `p-1`, panel radius 12px, card radius 16px = 12 + 4 so the curves are concentric). When the card is open, the panel's 1px `--app-border` ring is the divider, curving up at the corners, replacing the straight `border-t`. Header padding went 13px → 9px so nothing moves.

**Team names step layout (2026-09-27):** each team field now fills its row (`min-w-0 flex-1` wrapper), so it ends where the org name field does; gap between rows 8px → 12px, plus 12px more above Continue (`teams-step.tsx`). The circle is 48px (36 → 40 → 48 at the user's asks) and its column is `calc(48px + 5%)` with the icon centred in it; the field shrinks by that 5% from its left.

**Setup heading indent (2026-09-27):** `SetupHeading` + `SetupBody` (`setup/shell.tsx`) carry `pl-[5%]` (tried 10%, user pulled it back to 5%), so every setup screen's heading and sub-line start 5% of the card width in. Fields and buttons unchanged. The Google result panel (`sign-in-result.tsx`) now renders `SetupHeading`/`SetupBody` too (2026-09-27), so it has the indent and the 12px heading-to-sub-line gap. The Log In card still has its own heading styles.

**Org name field width (2026-09-27):** the org-name input (`org-name-step.tsx`) is inset `mx-[2.5%]` on each side, 5% narrower in total, centred. Only that screen; other setup fields unchanged. The white stacked setup buttons (`SETUP_CHOICE_CLASS` in `setup/shell.tsx`, every screen that uses it) got the same inset: `mx-[2.5%] w-[95%]`. So do setup's copy fields (delegation guide's Client ID / scopes group, and `SetupCopyLink`); `CopyField` itself has no inset, since it's app-wide. Same inset on the inline white buttons outside setup: Log In "Continue with Google" (`app-entry.tsx`), account picker "Continue with another account" + "Remove selected account(s)" (`account-picker.tsx`), and the personal "Workspace name" field (`sign-in-result.tsx`). Not the Book a Demo team-size grid (a grid, not a stack). Team name rows (`teams-step.tsx`) got `pr-[5%]` (2.5% twice, per user), so their fields end 2.5% further in than the org name field. Up/Down arrows move between team slots (blur commits the one left); at the first/last slot they do nothing special.

**Owner tooltip (2026-09-27):** the invite-owner screen's "owner" term uses the app's black `brand/tooltip` (portalled, arrow) instead of the browser `title`, widened for a sentence (`max-w-[18rem]`, 13px, roomier padding), with `cursor-help` and keyboard focus. The Connect step's "Super Admin" link still uses a plain `title`.

**Founder setup reorder (2026-09-27):** [[0023-founder-setup-google-check-before-owner]]. After the join link: Google check → "Do you sit at the top?" (sub-line: "Every organization on Knohow has one owner: the person in charge. Is that you?", user-picked 2026-09-27; Yes = pending owner claim via new `POST /organizations/{org_id}/owner-claim`; No → invite owner) → done. New setup step `connectWorkspace`; `done` recorded last. Owner + Super Admin definitions share `SetupTerm` (`setup/shell.tsx`). Backend 141 passed. An org saved at `inviteOwner` under the old order resumes past the check (the user's "Knohow" org did); it was rewound to `connectWorkspace` by hand 2026-09-27.

**Google check screen polish (2026-09-27):** heading's "Google" in the landing's letter colours (`GoogleWord`, new `brand/google-word.tsx`, which `deck.tsx` now imports `GOOGLE_LETTERS` from); **Check with Google** is the black right-aligned `SetupAction` pill with the Google G in front (new optional `icon` prop).

**Google check waits for a click again (2026-09-27):** user found the auto-start (`4ee5629`) only flashed the Connect screen. `ConnectWorkspaceStep` shows "Connect Knohow to Google." with a "Google Workspace Super Admin" `SetupTerm` in the body ("…whether you're a Google Workspace Super Admin for your company…") and a **Check with Google** button; an account Google already turned down still skips straight to the not-confirmed screen.

**Super Admin tooltip copy (2026-09-27, user-picked):** "The person with full control of your company's Google accounts, usually IT or whoever set up your company email. They can add people, reset passwords and connect apps like Knohow." (`SUPER_ADMIN_DEFINITION`, used on the Connect screen and the know-who screen).

**Setup action spacing (2026-09-27):** `SetupAction` (Continue, Check with Google, Send invite…) sits 32px below the content (was 24px); applies to every setup screen. The teams step keeps its extra 12px.

**Result mark restyle (2026-09-27):** `ResultMark` is centred above the heading (32px gap below it), 56px: a filled `#1c1917` circle with a white tick (verified) or X (not verified) drawn in by the same `.t-success-check` animation. Single-Continue result screens (verified, accounts linked, already linked) now use the black right-aligned `SetupAction` pill, like setup's Continue.

**Verified screen copy (2026-09-27, user-picked):** heading's "Google Workspace Super Admin" carries the Super Admin `SetupTerm` tooltip (`SUPER_ADMIN_DEFINITION` now exported from `setup/shell.tsx`); sub-line "Google confirmed you manage [org]'s Google accounts. That lets you connect your company's Drive to Knohow." (`organizationName` prop on `SignInResultPanel`).

**Drive connection step skips when already connected (2026-09-27):** `DelegationConnectStep` (from `0bf6017`) used to show "Knohow is connected to Google. Taking you to the app…" on load when `/delegation/setup` said `approved`, and never advanced (only `checkNow` set the timer). Now an approved status calls `onDone` straight away (next: the owner question), and nothing renders while that status loads. The post-`checkNow` "connected" screen still says "Taking you to the app…" though setup now goes to the owner question next.

**Own-Drive connection for everyone (2026-09-27):** [[0024-own-drive-consent-for-work-accounts]]. Workspace's "Connect your Google Drive" → own consent (`startDriveConsent`, `/auth/personal-oauth/start`), back to `/workspace?drive_connected=1`. Work accounts fall back to that consent until the Super Admin's company connection (delegation) is approved; delegation wins after. Distinct from setup's company-wide delegation step. Backend 145 passed.

**Linked personal Drive on Workspace (2026-09-27):** [[0025-linked-personal-drive-visible-to-owner]]. Each personal account linked to you gets a "Personal account" section on Workspace (files, or **Connect this Drive**), visible only to you, never indexed. New table `linked_drive_credentials` (migration `0019`, dev + test DBs upgraded), `/auth/linked-drive/start`, `/organizations/{org_id}/linked-drive-previews`. Backend 151 passed. Open: unlinking doesn't delete the stored consent yet.

**Home owner seat + setup finish (2026-09-27):** no owner → empty top card "No owner yet" with **Invite** (FormDialog, `kind: "owner"` invitation); never the viewer's name. Setup's finish closes the card, then goes to Home (prefetched). See [[Known-Issues]].

**Notifications + Home rework (2026-09-27):** [[0026-notifications-tasks-and-updates]]. Recent updates removed, Manage teams `lg` and enabled (opens an **empty** `sm` dialog, contents unspecified), all connectors pulse always, **New** chip on teams with unseen updates. Bell = tasks + unseen updates → Notifications dialog (`sm`): pending tasks (inline approve/decline join + owner claim; invite owner / Super Admin; connect company / own Drive) then team updates. New `GET /tasks`, `POST /owner-claim/decision`. `UpdatesProvider` shares the overview app-wide (Home no longer fetches its own). Change wording moved to `src/lib/change-text.ts`; invite form is `components/app/invite-dialog.tsx`. Backend 156 passed.

**Joining moved to Manage teams; Settings rename fixed (2026-09-27):** the Joining section (auto-approve Workspace accounts + join link / lifetime pills / Create new join link) left Settings for the Manage teams dialog as `src/components/app/joining-section.tsx` (`JoiningSection`, no "Joining" heading or hint and no row descriptions — just label + control rows, vertically centred, labels `font-medium` 0.9375rem. Copy (user asked "stronger and make more sense"): "Let people from your domain in automatically" · "Join link is open / is locked / No join link yet" · "New links expire after" · the button reads "New join link" (user dropped "Create" 2026-09-27; "Creating…" while busy), with an inline 16-unit SVG plus (2px bars, whole-pixel aligned, `transform-gpu`; Lucide's `Plus` rendered lopsided at 16px) before the label; it is `w-[45%] self-center` (user narrowed it eleven times by 2.5% per side, 2026-09-27; it sits in a stretching flex column, so padding changes had no visible effect) that scales slightly (1.1) on hover — user replaced the earlier 90° turn (300ms overshoot ease, CSS `group-hover`, off under reduced motion / while disabled); **Join link is a Lock / Unlock button** (light outline pill, `LockButton`; the icon shows the action, not the state — closed `Lock` beside "Lock", `LockOpen` beside "Unlock" (user 2026-09-27); icon + text red `#EA4335` for Lock, green `#34A853` for Unlock; in the row label only the keyword is coloured — "Join link is **locked**" (red) / "**open**" (green), rest ink (user 2026-09-27); Lock/Unlock and the lifetime dropdown share one `PILL` class (h-9, w-28 = 112px after six 2.5%-per-side trims from 160px, nowrap — "24 hours" / "No end date" overflow the dropdown at this width, centred, 13px medium) and the dropdown leads with a `CalendarDays` icon that tilts −12° and scales 1.1 on hover / while the menu is open (300ms overshoot, off under reduced motion); the user's hover icon-morph + scale micro-interaction was removed on request the same day — the icon just shows the state: `Lock` when locked, `LockOpen` when open), not a switch and not revoke: **locking keeps the same link** (user 2026-09-27: "doesnt need to make a new one just lock the old one"). Backend: `join_links.locked_at` (migration `0020_join_link_locked`), `set_join_link_locked` + `PATCH /organizations/{org}/join-link {locked}` (join-link roles; 400 when no live link), a locked link is refused at sign-up ("this invite link is locked") and its preview says "This invite link is locked / Ask whoever sent it to unlock it.", overview `join_link.locked` → `OrgOverview.joinLinkLocked`. Button disabled with no live link (Create new join link still makes one, unlocked). Tests in `test_team_setup.py`; suite 167 passed (local `knohow` and `knohow_test` DBs migrated); the lifetime is a row too ("How long should a new link last?" left, a compact Base UI `Menu` dropdown right — `LifetimeMenu`, profile-menu styling, positioner `z-[550]` so it opens above the dialog), replacing the pill row; reads `useUpdates().overview`, `refresh()`es after changes; the auto-approve switch saves on flip since that dialog has no Save — still owner-only, as the backend's `_require_owner` demands). Settings now holds just the org name (+ team join requests). **Bug:** the name field was `readOnly` and Save hidden unless `me.is_owner`, so with the owner seat an unconfirmed claim the founder couldn't rename, though the backend (`require_same_org_for_setup`) allows any approved member. Now owner, Super Admin or founding member can edit; a save calls the new `useSession().setOrganizationName` (sidebar/topbar follow without reload) and `useUpdates().refresh()`. **Auto-accept permission widened (user 2026-09-27):** the "Let people from your domain in automatically" switch was owner-only (frontend `me.is_owner`, backend `_require_owner`), so for a non-owner it sat disabled and "didn't do anything". It now follows the join-link rule — owner, verified Super Admin, team lead or founding member — via `_require_join_link_role` in `set_auto_accept_workspace_members` and `canEditAutoAccept = canManageJoinLink`; test `test_join_link_managers_who_arent_owner_can_flip_auto_accept`, 168 passed. **Settings matches Manage teams (user 2026-09-27):** Settings moved from `size="lg"` (max-w-2xl, the only app dialog that wide) to `sm` (max-w-md, like Notifications / Manage teams / accounts). Body re-laid like Manage teams: bold 1.0625rem headings ("Organization", "Team join requests"), no `DialogSection` hints or dividers, 20px (`gap-5`) between blocks; the name field lost its small "Name" label (aria-label kept) and now uses the setup/login input look (`t-input t-demo-input`, #d9d9de border → ink on focus, 10px radius via `var(--login-button-radius,10px)`). The observed-domain hint line is gone with the other hints. **Manage teams tabs (user 2026-09-27):** the dialog now has Notifications-style tabs (app `Button`s in a tablist, open one `default`/black, others `outline`, 40px below) — **Joining** (the `JoiningSection`) and **Teams** (deliberately blank for now). **Join Link block (user 2026-09-27):** the section now opens with a bold 1.0625rem "Join Link" heading (managers only), then the live link in the shared `CopyField` (copy icon inside, no label) beside a separate outline pill "New link"; the link box takes the input corner radius (10px) — `--login-button-radius` is only defined on `.t-login-modal`, so outside it `CopyField` drew square corners until it got a `var(--login-button-radius,10px)` fallback (the 16-unit SVG plus, scales on hover) that mints a new link and swaps it into the box; with no link a dashed "No join link yet" box stands in. The URL is loaded on mount from the existing `GET /organizations/{org}/join-link` (no backend change). The old full-width "New join link" button and the plain URL input below the rows are gone; the rows are now auto-accept · Join link is open/locked + Lock · New links expire after, spaced 20px apart (`gap-5`, up from 12px).

**Loading = turning mark (2026-09-27):** new `src/components/brand/loading-mark.tsx` (`LoadingMark`): `/knohow-mark.png` rotating +90° every 1s (450ms eased snap, then hold; still under reduced motion), `role="status"`. Used (a) in the Book a Demo booking slot while the Cal chunk loads **and** until Cal fires `linkReady`/`linkFailed` (Cal's own spinner stays hidden under it; the iframe fades in), and (b) in `AppSessionProvider`'s no-session screen (loading + "Taking you to sign in" redirect to the landing), replacing the text line. Field text selection (`.t-input`, `.t-demo-input` `::selection`) is warm ink at 14% instead of system blue.

**Book a Demo inset (2026-09-27):** the first screen's field grid, "Who's this for?"'s segment cards and Other input, and the team-size chip grid sit `mx-[2.5%]` (size step also got the `pl-[5%]` heading and `mt-8` action). Size chips carry a lucide icon left of the range, growing with it: 1 `User`, 2–5 `Users`, 6–20 `Store`, 21–50 `Building`, 51–100 `Building2`, 100+ `Landmark` (`DEMO_SIZE_ICONS`), 18px at stroke 2.4 so they match the bold label., matching the setup screens' content inset; both headings take `SetupHeading`'s `pl-[5%]`, and "Who's this for?"'s Skip/Continue sits `mt-8` (SetupAction's 32px) instead of `mt-3` (`demo-form.tsx`).

**Manage teams stack (2026-09-27):** with more than three teams, the button's icon stack adds a fourth 28px white circle holding only a lucide `Plus` (same overlap + `--app-active` ring), in `home-actions.tsx`. **Team cards got the same** (`MemberStack` in `home-screen.tsx`): up to three 20px `PersonAvatar`s overlapped (white ring) in front of "N members", plus a fourth `--app-active` circle with only a `Plus` past three. The three are chosen by `distinctColours` — members ≥2 steps apart on the 12-colour `PALETTE` wheel first, then merely different, then anyone — so who's shown changes, never a person's colour.

**Sidebar org name (2026-09-27):** the workspace name at the sidebar's foot is stacked one word per line, lines left-aligned with the block centred in the sidebar (no truncation) and is not rendered at all when the sidebar is collapsed (`sidebar.tsx`).

**Notifications tab counts (2026-09-27):** the Pending and Teams tab pills carry a red count badge pinned top-right like the bell's (same 15px size / 8.5px digits / white ring, `#FF3B30`, hidden at 0, `99+` cap). Pending = open tasks; Teams = update lines currently listed (so Clear / Clear all count it down). **Bell count = the two added up** (tasks + uncleared team update lines), not "unseen" any more (user 2026-09-27). The Clear state (localStorage `knohow:notifications-cleared[-teams]:<org>`) and `teamUpdates` moved from the dialog into `UpdatesProvider` so the bell and dialog share them; opening the bell still clears `unseen`, which now only drives Home's New chips. **Per-update red minus:** hovering/focusing a team update line cross-fades its time out and a red 18px circle-minus springs in in the same spot; pressing it removes that one update (`dismissUpdate`, ids in localStorage `knohow:notifications-dismissed:<org>`, capped at 500), and the Teams badge + bell count drop with it. **Same minus on setup's team naming** (`teams-step.tsx`): hovering/focusing a slot springs it in within the row's right 5% inset; it removes the slot (and `DELETE /organizations/{org}/teams/{id}` if already saved; backend refusal shows on that field with shake). Hidden when only one slot is left; `onMouseDown` preventDefault so pressing it doesn't blur-commit the field first.

**Bell counts live team updates (2026-09-27):** previously unseen was captured once per page load, so teammates' updates made while the tab was open never reached the bell. `UpdatesProvider` now re-reads overview + tasks every 30s and on tab focus/visibility; new events (deduped by event id across reads, excluding the viewer's own actions) are merged into `unseen`, so cleared badges stay cleared. `clearAll` (bell open / leaving Home) also stamps `dashboard-seen`, so a reload doesn't resurrect already-viewed updates.

**App dialogs: title only (2026-09-27):** `AppDialog` no longer takes a `description` (removed from Settings, Forget accounts, Invite); title 1.125rem → 1.2375rem → 1.36125rem → 1.4974rem (+10% three times). (A square `min-h` on `sm` dialogs was tried and reverted the same day.) Title indented `pl-[5%]`, body inset `px-[5%]` (both sides), matching the setup screens' headings; footer unchanged. Settings' "Only the owner can change some of these." note went with it. Invite dialog's field has 8px more above the label and below the input.

**One email check everywhere (2026-09-27):** `src/lib/email.ts` `emailError()` (needs `name@domain.tld`, no spaces; stricter than `type="email"`, which passes `name@company`). Used by the app Invite dialog (inline red message + red border), setup's Super Admin and owner email screens (shake + message) and Book a Demo's work email (custom validity, recomputed on change). Format only; Google proves the address at sign-in. Book a Demo's company website has the same kind of check (`src/lib/website.ts` `websiteError()`: optional http(s)://, a dotted domain with a 2+ letter ending, optional path), wired through the form's `FORMAT_CHECKS`.

**Tooltip restyle + field errors as tooltips (2026-09-27):** `brand/tooltip.tsx` now looks like Safari's form bubble (soft dark grey `#4a4a4d`, 12px radius, 13px medium white text; the arrow is one SVG triangle with a rounded tip overlapping the box by 1px, and the shadow is a `drop-shadow` filter over both so they read as one shape) for every tooltip. New `ErrorTip`: a field's error shown above it as that tooltip, open while there's a message. Used for **every field error** (app Invite dialog; setup org name, team names (anchored to the first empty / failed row), Super Admin and owner email, personal workspace name; all Book a Demo fields), and **clicking or tabbing into the field dismisses it** (`onDismiss`). Errors with no field (own teams, link lifetime, join wizard, Drive connection, loading failures) keep red `SetupError` text. App dialog forms are `noValidate`, so the browser's own bubble no longer appears.

**Dialogs open like Log In; Notifications tabs (2026-09-27):** every app dialog (`.app-modal`) now opens from a thin line across its middle, growing to full height on the card-resize curve at 500ms (`--modal-reveal-dur`, slowed from 300 the same day), and closes back into it: a `clip-path` inset reveal (open state `inset(-80px)` so the shadow isn't clipped), replacing scale+fade. The body (`DialogBody` in `app/dialog.tsx`) measures its content and tweens its height on `.t-resize` (300ms) when it changes, so a Notifications tab switch flips the tab at once and then the dialog resizes, like the Log In card between screens. Bottom **Close** buttons are black everywhere (Notifications, Manage teams, Settings; Settings now shows two black buttons to editors, Close + Save changes). Notifications: **Pending** / **Teams** tabs grouped left (outline, black when open), **Clear** on the right on Teams only (user's shake-on-hover trash button, red on a faint ink wash); Clear hides team updates up to that moment, stored per org in localStorage. Tabs sit 32px above the content; the Teams tab list is capped at 13rem (dialog ~30% shorter) and scrolls.
**Invite dialog field errors match Book a Demo (2026-09-27):** `invite-dialog.tsx` now uses `SetupField` + `shakeSetupField` / `clearSetupFieldError` (red border tween + shake), and like Book a Demo the error (border + ErrorTip) clears itself after a 3s hold; typing, clicking the field or closing clears it at once. Applies to bad-format and backend errors. `SetupField`'s radius is `var(--login-button-radius)`, defined only inside `.t-login-modal`, so outside the login sheet it resolves to square corners — the invite dialog passes `rounded-[10px]`; any other reuse outside login must too.
**Home chart fixes (2026-09-27):** owner centred over the real row width, connectors never clipped, cards drag freely (no clamp) — see [[Known-Issues]]. Clicking a control inside a card (caret, Invite) always selects it (black outline + connector); only a click on the card body toggles selection off. A click (not a pan) on empty canvas clears the selection. Connector pulses are **not** linked to updates (every edge `active`, ADR-0026); `EdgePulse` now phases every edge off one shared page clock (`epoch`) — the old per-edge restart re-synced all edges after a paused tab, so they drifted from one-by-one into firing together.
**Change wording (`src/lib/change-text.ts`):** `onboarding.team_lead_claimed` → "Team lead claimed"; the fallback for unmapped actions now capitalises its first letter (2026-09-27).
**Pending owner claim on Home (2026-09-27):** a joiner's "Yes, I'm the owner" is still only a claim (ADR-0021) — confirmed by the founder / a verified Super Admin from Notifications. While it waits, Home's owner card shows the claimant (avatar + name) with "Owner · awaiting confirmation" and no Invite. Overview now returns `pending_owner` `{id, email, display_name}` (only while `owner_member_id` is null; carried whole since the claimant may not be approved yet) → `OrgOverview.pendingOwner`. Test `test_overview_carries_the_pending_owner_until_confirmed`; backend 164 passed.
**Owner / Super Admin definition tooltips** (`SetupTerm`) now match the Log In sheet's tooltips (account picker, copy field): Satoshi, default padding/width, 6px offset, `?` help cursor kept (user wants it; linked terms get the pointer). `OwnerTerm` moved to `setup/shell.tsx`; the join form's "Are you the owner?" used a native `title` and now uses it too (2026-09-27).
**"Yes, …" / "No, …" choices** render through `ChoiceLabel` (`setup/shell.tsx`): the word before the comma bold, the rest medium (regular read as thin). Used in join (lead/owner), connect-workspace, invite-owner, and sign-in-result's personal-account choices (2026-09-27).
**Setup pill rows** (join "Which teams are you on?", own-team, invite-link) now use the setup controls' `mx-[2.5%]` inset instead of running flush to the card's padding (2026-09-27).
**Lead chip** in Home's member list now sits right after the name (6px gap), the same `Badge` as New, instead of pushed to the row's far right (2026-09-27).
**Topbar profile button** (avatar + name pill) has a thin grey outline (`border border-[var(--app-border)]`, like the search pill; 2026-09-27).
**Delegation loss is now detected (2026-09-27):** an approved company connection is re-checked (tasks fetch, throttled 1/min; scheduler every 5 min) and demoted to pending when Google refuses a token or the key is missing, so the "company Drive isn't connected" task comes back; Notifications re-fetches tasks on open. Details in [[Known-Issues]].
**Notifications Teams tab polish (2026-09-27, later):** top button is now **Clear all**, drawn like the unselected tab (white outline, red icon + label at 0.9375rem). Each team row gets its own smaller text-only **Clear** (1.6rem tall, 3.25rem wide, 0.75rem label, no bin icon; the times below share that width, left-aligned with 14px inset, so they start just inside where "Clear" starts) on the far right; per-team clears live in localStorage `knohow:notifications-cleared-teams:<org>` (JSON teamId → ISO), and a team's cutoff is the later of Clear all and its own. Team icon/name 30% then 5% larger (30px, 1.28rem); update lines indented 34px, a little left of the name (40px); ~62px between teams (was 12px). Pending tab is a two-column grid so every task's buttons start at the same x (Invite lines up with Connect), and the one-button tasks (Invite, Connect) share a fixed `w-[5.5rem]`; a **Tasks** label (shared `DialogSectionTitle`, the dim uppercase `DialogSection` heading style) sits over the first task, with the grid's 12px gap cancelled (`-mb-3`, 0px); what's left is the task row's own height, set by its 32px button; the grid runs 5% past the body's right inset (`-mr-[5%]`) so the buttons sit 5% further right. Tabs → content gap 40px (24px margin + 16px panel padding). Teams panel (`FadeScroll`) capped at 16.25rem (dialog ~10% taller), scrollbar pushed into a gutter right of the times (`-mr-8 pr-8`), and top/bottom edges fade via a mask only while there's more to scroll, so the edge under the tabs isn't a hard line.

Active work is on **`main`** (synced with origin after Phase 0).

## Windows dev machine + privacy fixes (2026-09-25, branch `fix/signin-and-privacy`)
**Second dev machine is Windows** (the setup notes below are the Mac). There, Postgres 16 is the EnterpriseDB **portable zip** at `%LOCALAPPDATA%\pgsql` (winget's installer needs a UAC prompt an agent can't approve). Trust auth, port 5432, role/DBs `knohow` + `knohow_test`, both at `0017`. It is **not a service**, so start it after a reboot:
`"%LOCALAPPDATA%\pgsql\bin\pg_ctl.exe" -D "%LOCALAPPDATA%\pgsql\data" -l "%LOCALAPPDATA%\pgsql\postgres.log" start`.
Backend: `backend\.venv\Scripts\uvicorn.exe app.main:app --port 8000 --reload` (venv is Python 3.13; suite passes on it). `backend/.env` has the real OAuth client (validated) and `GOOGLE_SERVICE_ACCOUNT_JSON=C:/Users/tolul/secrets/knohow-staging-95d725a75c83.json` (key `95d725a7…`, outside the repo; loads and parses through `load_service_account_info`). The Google redirect carries the real `client_id`. **Real sign-in not yet clicked through on Windows.** The OAuth client secret appeared in a chat photo 2026-09-25, so **rotate it**. The root `.env` gained `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000`.

**Privacy blockers (1), (2), (4) fixed** on that branch, uncommitted: detected files no longer enter `FileIndex`, DeepSearch no longer leaks unconfirmed files, and `personal` is now `private`. Details in [[Known-Issues]] → Recently resolved. **Consequence to know:** until the classification/confirmation flow ([[FEAT-drive-file-classification]]) is built, a file created outside Knohow never reaches `FileIndex`, `/files`, dashboards or other people's DeepSearch results. That is the agreed rule, not a bug.

**Proposal gap (2026-09-25):** the BCW proposal (`docs/business/`, dated 2026-09-08) promises seven features. Only the org chart and onboarding have frontend. `/workspace`, `/search`, `/offboarding` are empty states over existing backend engines. Nothing is deployed and Google's OAuth verification isn't submitted, so a BCW pilot means adding each person as a GCP test user. The proposal claims AES-256 at rest; the backend's token encryption is Fernet (AES-128), unreconciled.

**Proposal-ready plan (2026-09-26):** six blockers with evidence + phased work for Claude Code — [[Proposal-Ready-Plan]]. Order: host API (A) ∥ OAuth track (B) → prove delegation (C) → classification (D) → feature UIs (E); credibility/legal (F) continuous. Do not claim proposal-ready until C+D+E (and A+B for external users).

## Topbar bell is a real control now (2026-09-23; count real since 2026-09-27, see ADR-0026)

The topbar's "not wired yet" alerts button (`Button variant="secondary"` + `AppIcon name="bell"`) was
replaced by [`src/components/app/notification-bell.tsx`](../../src/components/app/notification-bell.tsx)
— a component the user brought in. It swings the bell from its hanging point when the count goes up
(spring, low damping, impulse scaled by how many arrived at once), drags a clapper behind it off the
swing's own velocity, and rolls the badge digits in per-place columns with a velocity-driven fade mask.
Reduced motion drops the ring, the roll and the badge's layout animation.

Three things changed on the way in:

- Imports retargeted from `motion/react` to `framer-motion` (already a dependency, same API) and the
  `asChild` / `@radix-ui/react-slot` path removed, so nothing new was installed. See [[Lessons-Learned]].
- `focus-visible:ring-ring` named a token this repo doesn't define, so it emitted nothing and the button
  had no focus state. Swapped for the app's own `outline-[#1c1917]` treatment. See [[Lessons-Learned]].
- Its default press is `active:scale-90`; the topbar overrides that to `active:translate-y-px`, the 1px
  nudge every other app control uses after the click-swallowing bug (see `button.tsx` and
  [[Lessons-Learned]]).

It kept the tooltip and `size={40}`, so the row's rhythm is unchanged. **The count is mocked at 0**:
`OrganizationChrome.unreadNotifications` in [`src/lib/organization.ts`](../../src/lib/organization.ts) is
a constant, because `/auth/me` carries no notification count and there is no notifications store in the
tree. That field is the seam a real source plugs into. Until then the badge never renders and the bell
never rings — set the constant to a non-zero number to see either.

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

## Signed-in app shell (2026-09-21 → 2026-09-23) — restructured 2026-09-23

The wall-of-text version of this section was hard to use as memory, and had gone stale in three places
(the profile menu, the board, and Manage accounts each got another pass after their entries were
written). Split into topics below; dates mark when each fact became true, not when the app shell
started.

### Shell, routes, chrome (2026-09-21)
Route group **`src/app/(app)/`**, persistent sidebar, one route per landing-deck feature. Decided by the
user picking: **sidebar + 7 routes** (ElevenLabs / banking references), **quiet neutral** look, **mocked
fixtures in `src/`** at the time (since replaced, see below), **shell + nav only this pass, then screen
by screen**. Empty states follow the **Sage_v1 pattern** — one canonical `EmptyState` (icon disc, title,
one line, optional single action) — rebuilt Knohow-native, no Sage code/deps/tokens (invariant 5). New
app-chrome tokens in `globals.css`. All screen copy is **draft**.

Wired in after the user reported clicking an account did nothing: a signed-in member whose setup is
finished lands on `APP_HOME`, not the landing page.

Sidebar sized off the **X** reference then cut down at the user's request; layout and type off
**Elera** (shared ground with no divider, `--app-ground: #f4f2ee`, sentence-case section labels, pill
active row, page name in `Topbar`). Icons were Google Material Symbols, self-hosted and subsetted — see
"Icons" below for what replaced most of them.

### Real data, no fixture (2026-09-21)
The app reads the backend, not a mock — [[0016-app-reads-the-backend-not-fixtures]]. `/auth/me` and the
overview endpoint are read in the browser (session cookies live on the backend's origin), fetched once
in `AppSessionProvider` and handed down by context; signed-out bounces to `/`. Invariant 2 still holds:
nothing in `src/` touches a Google API.

Teams and people have **seeded generative SVG identities** — [[0015-seeded-generative-identity-system]].
Team icons are abstract geometric compositions from a fixed vocabulary; the name is only a seed, never
read for meaning. People's avatars started as gradient fields and are now **fluid orbs** (see "Identity"
below).

### Home (was Dashboard, was /org-chart + /oversight)
Three renames in sequence, latest wins:
- **2026-09-21**: `GET /organizations/{org_id}/overview` (`org_overview` + `list_members`) assembles
  every answer setup collects in one round trip — [[0018-dashboard-reflects-onboarding]].
  `/org-chart` becomes a **graph**: owner on top, teams spread beneath on a dotted draggable canvas
  (`flow-canvas.tsx`, generic, from a component the user supplied).
- **2026-09-22**: `/org-chart` and `/oversight` merge into one screen —
  [[0019-dashboard-absorbs-chart-and-oversight]]. A caret on each team card enumerates its members
  inline; a team that changed since the viewer last opened it carries a badge and a pulse up to the
  owner. Changes read from the **audit log** (`app/activity/changes.py`); attribution to a team is four
  rules, anything unattributable stays org-wide. `org_members.dashboard_seen_at` (migration
  `0016_dashboard_seen`) stamps **after** the screen draws, never before.
- **2026-09-22**: the screen is renamed **Home** (not "Dashboard"): route `/home`, `HomeScreen` in
  `screens/home-screen.tsx`, `APP_HOME = "/home"`. The backend keeps `dashboard-seen` /
  `dashboard_seen_at` — renaming those is a migration, not a label.
- **2026-09-23**: the summary panel (org name, "signed in from…", stat pills) is **gone**. The
  organization's name moved to the sidebar foot. Home is the chart plus two buttons — see "Home's grid
  buttons" below.

**Sizing and fit:** canvas rows no longer stretch to fill the window — the owner/team gap caps at
`MAX_ROW_GAP` (240px), spare height stays empty. Owner and team cards run 30% bigger than the first pass
(`OWNER_W` 348, `TEAM_W` 302). Windows (any surface content sits on — the canvas, empty screens, the
loading placeholder) are `rounded-[32px]`, measured off a user-supplied reference rather than eyeballed.

**The chart is a board (2026-09-22–23).** Drag empty canvas to pan; pinch to zoom, 0.4×–2.5×
(`MIN_SCALE`/`MAX_SCALE` in `flow-canvas.tsx`), about the point under the fingers. A trackpad pinch
arrives as `ctrl+wheel`; because React's `onWheel` is passive it can't call `preventDefault`, so the
**whole browser window zoomed along with the board** until the listener was rebound natively
(`addEventListener("wheel", …, { passive: false })`) — see Lessons-Learned. Two-finger touch is tracked
through pointer events. The board also **fits itself** to the widest row's natural width when there are
more teams than fit on screen, down to the 0.4× floor, past which panning is the answer instead of
unreadable cards; it fits once per shape (row requirement × canvas width) and a manual zoom, once taken,
overrides the auto-fit permanently — a view that keeps correcting itself can't be steered. Card dragging
divides pointer deltas by the current scale so a card still tracks the cursor at any zoom.

**Recent updates & badges (2026-09-22).** `changesByTeam` (badges) empties every time the viewer opens
Home, because `dashboard_seen_at` stamps on every visit — fine for a badge, useless for a replay. A
second feed, `recent_changes` (last 7 days regardless of who has seen it), backs the chart's pulses and
the **New** chip on a card's name row (quiet grey, `rounded-[5px]`, matched to a user reference; sits
next to the label, not floated to the card's edge). "Recent updates" (top-right, on-canvas) plays the
**narrowest window that holds anything** — 1h → 6h → 12h → day → week → whole history
(`RECENT_WINDOWS`), recomputed on each press since it reads the clock. One pass: `pulseKey` remounts
every `EdgePulse`, the icon shows Pause while it travels and returns to Play when the last one lands
(driven by the run, not hover — an earlier version tied it to hover and it never left Play), and the
**icon only** turns `--app-play` (`#15803d`) for exactly that duration. Pulse dots are ink (`#1c1917`),
not `--app-change` blue — blue read as a status colour on the dotted grey canvas rather than something
moving.

### Home's grid buttons (2026-09-22–23)
Two `secondary`-variant buttons, absolute top-right of a wrapper around `FlowCanvas` (inside the canvas
they'd scroll away with the chart): **Recent updates** (above) and **Manage teams** (team marks
overlapped into a stack, **disabled on purpose** — the screen behind it isn't specced).

**Noted for Manage Teams v2 (2026-09-23, not built, not designed):** sub-teams — a team nested inside
another team, not just the flat owner→teams the chart currently draws. Nothing decided yet: whether a
sub-team is its own row on the chart or only visible from within Manage Teams, whether it can have its
own lead distinct from the parent team's, whether membership in a sub-team implies membership in the
parent, or how deep nesting is allowed to go. Recorded here so it isn't lost before Manage Teams itself
is specced; needs its own pass with the user before any of it is built.

**Noted (2026-09-23, not built):** a `-` control after each team box on the chart itself, for removing
a team without going into Manage Teams. Undecided: whether it's inline on the card (like the caret) or
only appears on hover, what happens to a team's members and its sub-teams (see above) when it's
removed, and whether removal needs a confirm dialog — `ConfirmDialog` already exists for exactly this
shape of decision.

**Noted (2026-09-23, not built):** a **Leader badge** in the team card's caret dropdown (the inline
member list). Today the lead is a plain text label — `{member.id === leaderId ? "Lead" : null}` in
`TeamDetail`, `home-screen.tsx` — not a badge. Undecided: whether it reuses `ChangeBadge`'s chip shape
or something new, and its colour/placement relative to the member's name.

Both rest at
`--app-active` rather than `secondary`'s default `--app-muted`, because the lighter fill disappeared
against the dotted canvas; hover is a 1.02 scale lift instead of a colour change, since the fill has
nowhere lighter to go.

### Dialogs, buttons, overlays (2026-09-21–22)
Settings is a **dialog**, not a route — [[0017-dialogs-over-settings-screens]], which records the
taxonomy borrowed from Sage_v1 (one shell; `size` sm/lg/xl; `kind` form/confirm; scale+fade entrance;
always-available safe exit). **Buttons have the matching taxonomy** — [[0020-button-taxonomy]]: one
`Button` (`src/components/app/button.tsx`) on `variant`
(`default`/`outline`/`secondary`/`ghost`/`destructive`/`link`) and `size`
(`default`/`xs`/`sm`/`lg`/`icon-*`), Sage's axis names on Knohow's own ink and rounding. `FormDialog`
now exists beside `ConfirmDialog`, both compositions of `AppDialog`.

**Overlay mechanics (2026-09-22):** `.app-modal` in globals.css is the Transitions.dev curve the user
supplied — scale 0.96→1, 250ms in / 150ms out, `cubic-bezier(0.22, 1, 0.36, 1)`, off under
`prefers-reduced-motion` — driven by Base UI's `data-starting-style`/`data-ending-style`, used by every
dialog and menu. The dialog is centred by a wrapper, not a translate, because scale and translate on one
element fight over the same `transform` property. Layers: **menus 450 · dialogs 500 · tooltips 600**,
z-index on the **positioner**, never the popup (a positioner with no z-index lands in the body's default
layer regardless of its child's).

**Press feedback (2026-09-22, revised 2026-09-23).** Every app control first got the landing's
`active:scale-95`. That turned out to **intermittently swallow clicks**: a `click` only fires when
pointerdown and pointerup share a target, and a button shrinking under the pointer can finish a press
outside its own (now smaller) box — worse on small icon buttons. All app buttons and the sidebar/topbar
rows now press with `active:translate-y-px` (matching Sage's own buttons) instead of a scale, which
keeps the hit area under the finger. See Lessons-Learned.

**Manage accounts dialog (2026-09-22, redesigned 2026-09-23):** matches the Log In picker's remove
screen exactly rather than approximating it — `size="sm"` (was `lg`; the login modal is 420px, and a
wide/short box read as a different kind of surface), `28px` corners to match the login modal's computed
radius, **tick-then-forget-once** (was one Forget button per row — removing three accounts meant three
confirmations of one decision), rows with **no outline/card**, just a `--app-active` fill when picked
and `--app-muted` on hover (a border per row fought the branch lines, the only structure that means
anything here). Linked personal addresses branch under their org on a continuous trunk — org rows are
**forgotten**, linked addresses are only **hidden** (no row of their own to forget).

### Icons and micro-interactions (2026-09-22)
`AppIcon` resolves a name against three sets in turn — `APP_ICONS` (subsetted Material Symbols),
`CODICONS` (inlined VS Code paths), `LUCIDE` — so `NAV_ICONS` stays a flat route→name map. The sidebar
toggle kept **Sage's codicon pair** (`layout-sidebar-left`/`-off`) after a lucide `panel-left` pair was
tried (to match the sidebar's own icon set) and rejected — this control is Sage's, and its two states
must differ by a whole filled pane, not an arrow (Material's `left_panel_close`/`-open` failed the same
test first). The bell beside it is lucide, since Sage has no equivalent.

Every nav row's icon morphs on hover, one pattern in `nav-morph.tsx` (`NAV_MORPH`, `AnimatePresence`
`popLayout`, scale 0.5↔1, spring 600/25, pattern supplied by the user): Home's house lights its doorway,
Workspace's folder opens, Ownership's shield gains its check, Sharing's link becomes a send,
Offboarding's user gains an X. **No row changes colour** — red on Offboarding was tried and taken back
out. Settings turns its gear 180° on hover (spring 400/25, travel not swap — a gear's own affordance is
rotation). Help swaps `CircleHelp` for `MessageCircleQuestion`. The profile menu's own rows carry the
same family: "Add another account" (plus → person-plus), "Manage accounts" (people → cog), and every
caret (switch-accounts submenu, team card expand) leans the way it points on hover instead of swapping,
since a caret has nothing to become.

Resting icons are lucide so the still icon is the same drawing that animates, at `NAV_STROKE` 1.75 to
sit with 400-weight labels. Rows are `px-4`/`gap-3`; the sidebar's scroll area is `.app-scroll-plain` so
macOS's always-on scrollbar stops painting a divider down its right edge.

### Sidebar: rail, foot, gutters (2026-09-22–23)
Collapse is a **rail**, not a disappearance: `RAIL_W` 64px, icons only, centred, labels moved into
right-side tooltips, section captions dropped, lockup reduced to the bare `LogoMark` at 18px (measured
off a reference: mark is ~0.29 of the rail's width). One `Row` component renders every nav entry in both
states. The sidebar **no longer resizes** — the drag handle and stored width are gone; two fixed widths,
208 and 64, is what visibility toggles between.

The sidebar foot has moved through three states: the person's avatar+name+org (original) → nothing
(2026-09-22, person moved to the topbar's profile chip) → **the organization's name alone**
(2026-09-23), 1.40625rem (50% bigger than body text), persisting into the collapsed rail at 0.75rem
centred — which org you're in is the one thing a 64px rail can't say by shape otherwise. The sidebar no
longer reads the session at all for its own sake — only for that one name.

**Gutter balance (2026-09-23):** the page's left padding (`AppPage`, was `px-6` then `px-2`) is now
**zero**. The sidebar column already ends with its own 12px gutter (the space right of a nav pill), so
any left padding on the page was *added* to that, putting the window further from the pills than the
pills sit from the sidebar's left edge — the row read as pushed right. With the page's left gutter at
zero, the window sits exactly 12px from the pills, matching the 12px on their other side; the right
gutter is `pr-3` to keep the page symmetric. `Topbar` uses the same `pr-3 pl-0` so the panel toggle lines
up with the window's left edge and the profile chip with its right.

### Topbar & New (2026-09-21–22)
Topbar matches the reference — panel toggle, page name/greeting, then search, alerts, New, person.
**Alerts** still not wired. **New** creates Doc · Sheet · Slide · Upload when built
([[FEAT-doc-creation-auto-share]]); the control already shows that set as a fanned icon stack
(white-rimmed squircles, Google product marks from `public/create/`, Upload a matching tile) in front of
the label instead of a plus.

Home's title is a **rotating greeting** (`src/lib/greeting.ts`, `pickGreeting`), not the screen's name:
playful, time-of-day/weekday/season-aware, short UI lines, every line includes the first name and
weights toward favourites. Fresh on every load/refresh and again after `GREETING_IDLE_MS` (10 min) of
idle (pointer/keyboard), avoiding an immediate repeat. Computed from the **browser's** clock, so it only
resolves after hydration. Weather-flavoured lines wait on a real weather signal — none wired yet.

### Profile menu (2026-09-22, extended through 2026-09-23)
`profile-menu.tsx`: a Base UI `Menu` anchored under the topbar chip, aligned to its right edge so it
opens leftward. Holds: the account block (orb, name, email — not a row, nothing to switch to from
*itself*), **Settings** (moved out of the sidebar, gear turn came with it), **Help** (`Menu.LinkItem` on
a `Link`, since it's a route — still also in the sidebar), and **Log out** ("…of all accounts" only when
more than one account is remembered, counting linked personal addresses even though the backend carries
them on an org row).

The account block is a **submenu trigger** opening "Switch accounts" to its left. Its list **branches**
like the Log In picker and Manage accounts do (fixed 2026-09-23 — it was flat, "You forgot the branching
look"): linked personal addresses hang under their organization's row on a continuous trunk, at a
smaller scale (28px orb) so the nesting reads without needing the line. "Add another account" and
"Manage accounts" sit below the tree.

**Switching is instant (2026-09-22):** `POST /auth/switch` issues session cookies for any account
**remembered on this device** — the device cookie is the credential, the endpoint refuses anything not
in this browser's list, and a linked personal address (no member row) still goes through Google.
"Add another account" is **identity linking** (`GET /auth/link-account/start`), not signup, and its
callback returns to `/home` instead of the landing.

Three dead ends closed in this flow, in order found:
1. **No session** → the route now redirects to sign-in instead of answering 401 to a top-level
   navigation (which lands on a raw JSON error page).
2. **No member row** for the address picked at Google (an ordinary personal Gmail) → attached to the
   person via `attach_pending_personal_email` instead of 404ing. This is the mirror of Log In's "yes, I
   have an organization account" — a question worth asking someone arriving cold, not someone already
   signed in saying "this is also me". **Identity only, deliberately**: no Drive grant, because
   `OAuthCredential` hangs off member rows and a linked address has none — scanning a linked personal
   account is a separate step, still to be specced.
3. **A stale hide** — Manage accounts' "Forget" on a linked address writes a per-device hide (it has no
   row to delete). Re-linking the same address didn't clear that hide, so a freshly linked account
   stayed invisible in both the picker and the profile menu. Linking now calls `unhide_email` on the
   device it was linked from — proving an address at Google is a louder statement than an earlier hide.

### Identity (2026-09-22–23)
Person avatars are **fluid orbs** (`FluidOrb`, `src/components/identity/fluid-orb.tsx`, a WebGL shader
the user supplied verbatim): one colour per identity via `personColor`, reusing the old gradient's seed
so nobody's colour changed in the swap. A context budget (10 live orbs, then the gradient fallback) and
a fade-out handoff from the gradient once the orb reports it's painted — both detailed in
Lessons-Learned. **The Log In account picker's avatars were still the old initial-on-a-tint circles**
until 2026-09-23 ("still use the old type of pictures") — swapped to the same `PersonAvatar` everywhere
it draws a row (picker, remove screen, remove screen's linked-address children), seeded by **address**
even on an org row, so the orb recognised in the picker is the one seen in the app afterwards.
`avatarTint`/`avatarLetter` are gone.

### Workspace (2026-09-23)
`/workspace`'s empty state has a primary action button, **"Connect your Google Drive"** (user copy).
`EmptyScreen` gained an optional `action` prop forwarding to `EmptyState`'s existing slot. **Not wired**
— no handler, no backend call; `src/` stays mocked per [[0001-mocked-data-first-prototype]].

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
- **`knohow` cleared again 2026-09-26** at the user's request (same truncate, every table but
  `alembic_version`, which stays at `0016_dashboard_seen`). Removed 1 org, 1 member, 6 teams, 1 join
  link, 14 audit entries and the remembered-account rows; no `oauth_credentials` existed. `knohow_test`
  not touched. Next sign-in starts setup from scratch.
- **`knohow` cleared again 2026-09-27** (Mac, user: "clear my db"): same truncate over 24 tables,
  `alembic_version` kept at `0018_team_join_requests`. Removed 1 org, 1 member, 1 team, 1 org chart,
  1 membership, 1 join link, 1 person, 1 remembered account, 7 audit entries. `knohow_test` not touched.
  Cleared once more the same day: 1 org, 1 member, 1 org chart, 1 person, 1 remembered account,
  3 audit entries.
  Cleared a third time that day (25 tables, at `0019_linked_drive_credentials`): 1 org, 1 member, 5 teams,
  3 memberships, 1 join link, 1 delegation grant, 1 linked personal email, 18 audit entries.
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
**Superseded directionally by 2026-09-26** ([[0021-founder-not-owner-leads-self-claim]]): founder is not
asked to self-declare as org owner as the grant of ownership; owner is invited/claimed separately; Super
Admin is Google-checked, not Yes/No/I don't know. Live UI may still show the old questions until rebuilt.
Historical: Owner question was **"Are you the owner of the organization?"** … Super Admin Yes / No / I don't know.

## Org setup + join link (superseded 2026-09-26)
The 2026-09-20 write-up below is **historical**. Current locked rules: [[0021-founder-not-owner-leads-self-claim]]
and [[FEAT-workspace-onboarding-flow]] → "Locked org model". In particular: **founder ≠ owner**; leads
**self-claim**; join is a request **only if a lead exists**; **team leads** may reissue the org-wide link.

<details><summary>2026-09-20 notes (superseded — do not implement)</summary>

**Setup is the next onboarding step for both flows** (Workspace and personal) and is where the org chart
is created. User's shape: create the groups, send **one deep link**, people sign in through it, join the
org, pick a team, enter the app. Then locked in [[0014-org-setup-and-join-link]] (now superseded):
- ~~First person owns the org outright~~ → **founder only** (0021).
- Chart at setup = **teams only, no named seats** (still true).
- ~~Team leads named by owner at approval~~ → **first lead claim wins**; request only if lead exists (0021).
- Link **domain-locked**, expiry, revocable (still true); **team leads** may reissue (0021).
- Resume / save-as-you-go (still true; resume path built 2026-09-21).
- Copy approved 2026-09-21 — will need revision where it assumes founder=owner or always-request.

</details>

## ⏭ Next + a standing reminder (2026-09-21)

**✅ Done 2026-09-21, repeated 2026-09-23, repeated 2026-09-26 (user: "clear the db!").** `knohow`
dropped and rebuilt on the Windows portable Postgres: 25 tables, at `0018_team_join_requests (head)`,
**zero rows** — no org, member, team or remembered account. Next sign-in with Google creates the org
fresh and runs setup from the start.

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

**Sidebar starts collapsed (2026-09-27):** `AppShell` opens on the icon rail (`RAIL_W`). The topbar panel toggle opens/closes it for good (no timer, cancels a pending collapse). Clicking the rail expands it and collapses it 4s later (`PEEK_MS`); clicking a nav option (a link) in the open sidebar also collapses it 4s later (user, same day). Clicks elsewhere in the open sidebar do nothing.

**Expired join link gets the X (2026-09-27):** the login card's "This link has expired" state now shows `ResultMark kind="cross"` (exported from `setup/sign-in-result.tsx`) above the heading, the same component and placement (centred, `mb-8`, drawn in after 320ms) as the Google result screens' tick/X.

**Manage teams → Teams tab built (2026-09-27):** `components/app/team-members-section.tsx`, drawn like Notifications' Teams tab (reuses its exported `FadeScroll` + `TEAM_CLEAR_WIDTH`): team icon + name only (no Clear), members listed under it (display name, else email), with Home's **Lead** chip after the lead's name (chip moved to shared `components/app/badge.tsx`). A `--app-border` hairline sits between teams, centred in the 62px gap. An empty team shows Home's "Nobody is in this team yet." (dim, where the member rows go). A **Super Admin** chip (same `Badge`, after Lead) marks `isSuperAdmin` members, in Manage teams and on Home's org chart member lists (user asked for "Admin"; copy rule says Super Admin). A Super Admin viewing their own row gets no Remove Member, and neither does a team lead (not also owner / Super Admin) on any Super Admin's row (`me.is_team_lead`, any team) (frontend only; the kebab disappears if they also lead that team). Hovering/focusing a member springs in an 18px **horizontal kebab** in the minus's spot, grey (`--app-active`) not red, nothing shown at rest; it stays up while its menu is open. Menu (lifetime-menu style): **Make Team Lead** (normal, hidden for the current lead) → `POST /organizations/{org}/teams/{team}/leader`; **Remove Member** (red) → `DELETE /organizations/{org}/memberships/{member}?team_id=` (removes from that team only). Helpers `assignTeamLead` / `removeFromTeam` in `lib/organization.ts`; success calls `useUpdates().refresh()`, failure shows a red line. **Open:** those backend routes only check same-org + approved, so any approved member can reassign leads or remove people; no confirm step on Remove.

**Home team cards no longer list updates (2026-09-27):** expanding a team card showed a leftover change list under the members (e.g. "Someone left · Name 1m") that survived ADR-0026. Removed from `TeamDetail`; updates live only in Notifications and the card only carries **New**.

**Joins/leaves name the person (2026-09-27):** the change feed (`backend/app/activity/changes.py`) now sends `subject_member_id` (membership.removed → target; membership.upserted → `details.user_id`), carried as `ChangeEvent.subjectMemberId`. `describeChange` reads "Ada Lovelace left" / "Ada Lovelace joined" instead of "Someone left/joined", appends "· actor" only when the actor is someone else, and falls back to "Someone …" if the person isn't in the overview. Backend 168 passed.

**New link shows a tick (2026-09-27):** in Manage teams → Joining, after a join link is made the button's plus becomes a tick for 1.5s (`created` in `joining-section.tsx`), the same timing as the copy field's Copy → Check.

**Settings Save changes is outline (2026-09-27):** drawn like an unselected Manage teams tab (`variant="outline"`); Close stays black.

**Workspace file cards (2026-09-27):** the "Connected to Google Drive" heading and "Reading as …" intro are gone; the screen opens straight on the file grid. Docs / Sheets / Slides cards show Google's product mark (`public/create/*.png`, the New fan's) at 40px in place of the white tile + line icon, with the name and "Doc · Edited …" beside it as before. Other types (folder, form, PDF, image, video, file) keep the line icon on a white tile, since there's no Google mark for them in the repo. The linked personal account section's heading/intro was left as is.
