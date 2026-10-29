---
type: decision
status: active
tags: [area/onboarding, area/security, area/backend, area/frontend, multi-tenant]
created: 2026-10-16
updated: 2026-10-16
related: ["[[0021-founder-not-owner-leads-self-claim]]", "[[0034-club-orgs-invite-only-members-own-club-account-optional]]", "[[0006-observed-domain-tenant-identity]]", "[[0013-sign-in-is-to-an-organization]]", "[[0026-notifications-tasks-and-updates]]", "[[0009-contractor-work-created-as-the-org]]", "[[Current-Context]]"]
---

# ADR-0035: Teams get an outside link any Google account can use; the owner and Super Admins are told and can remove

## Status
`active`. Asked for by Tolu (git `tolulase007`) on 2026-10-16. **Built the same day** (local, uncommitted, not deployed). Amends [[0021-founder-not-owner-leads-self-claim]]: the **org-wide** join link stays locked to the domain, and a separate **per-team** link now lets people from outside in.

## Context
Tolu: nonprofits want people in their org who don't have the org's email (volunteers on Gmail, partners on other domains). Until now the only ways in were the org-wide join link, which is locked to the org's Google domain (ADR-0021, which rejected "Link open to any Google account" as a way around the domain check), and a club's link (ADR-0034, clubs only). A company or nonprofit org had no way to bring in someone without its email.

Tolu's request: a team lead can add people from outside the org to a team, with a toggle for "ask permission before they're let in" or "anyone with the link can join". The overall Super Admin is told about each new person and can kick them out. A Super Admin can add outside people the same way.

## Decision
Answers Tolu gave on 2026-10-16 are marked *(Tolu)*.

- **Per-team outside link** (`team_outside_links`). One live link per team, and a new one revokes the old. Same lifetime choices as the join link (24h / 7d / 30d / no end date). It is served on the same `/join/{token}` page; the token decides which kind of link it is.
- **Who makes it:** that team's lead, the owner, a verified Super Admin, or the founder (the same group that can manage the join link under ADR-0021, narrowed to the team for leads).
- **"Ask me before they join"** (`teams.outside_ask_first`), **on by default** *(Tolu)*. It's stored on the team, so a new link keeps the setting. On: the newcomer waits as a `TeamJoinRequest` for the team lead to approve, with the owner and Super Admin as backup as usual. Off: anyone with the link goes straight onto the team.
- **Where it lives:** both places *(Tolu: "maybe both for convenience")*. In Manage teams, each team's "…" menu has **Add people from outside**, which opens its own dialog. The Joining tab has an **Outside link** section with a team picker.
- **Any Google account** (Gmail or another Workspace domain) can join. People already in other orgs get their own membership here, like clubs. An outsider is `PERSONAL_OAUTH`, because delegation only reaches the org's own domain (`_domain_delegated_client` refuses any other domain). Someone on the org's own domain who uses the link isn't treated as an outsider. The link fixes the team, so newcomers skip the team-pick wizard.
- **Who's told:** the owner **and** every verified Super Admin, always *(Tolu)*. Pending task `outside_joined` ("{name} joined {team} from outside.", **Remove** / **Keep**). It appears once the person is actually on a team; while they're still waiting, the join request is the task. Keep clears it for everyone.
- **Remove = out of the organization** *(Tolu)*. They come off every team, pending requests and sharing-rule mentions are cleared, and Knohow takes back their access to every org file it indexes that they don't own, using each file owner's Drive connection. `org_members.removed_at` is set: their sessions get a 401, sign-in and the account picker skip them, they drop out of member lists, and no link lets them back in (a "You were removed from this organization" screen). Files they own stay theirs.

## Alternatives considered
- **Open the org-wide join link to any account.** Rejected: it would undo ADR-0021's domain lock for everyone, not just the teams that want outsiders.
- **Invite by email instead of a link.** Not what was asked ("anyone with link can join"). Knohow also sends no email yet.
- **Only one placement** (the team menu, or under Join Link). Tolu chose both.
- **Tell only verified Super Admins.** Rejected *(Tolu)*: clubs and unverified companies have none, and the notice would go nowhere.
- **Remove from the team only.** Rejected *(Tolu)*: the person would stay in the org.
- **Reuse `offboard_member` for removal.** Rejected: for a personal account with no handover it would list the person's whole Gmail Drive as "stuck" files, and it doesn't take back access to the org's files.

## Consequences
- Migration `0026_outside_links`: the `team_outside_links` table, `teams.outside_ask_first`, and `org_members.joined_from_outside_at` / `outside_reviewed_at` / `removed_at`.
- `removed_at` is a general "no longer in this org" state, but only outsiders can be given it today (`remove_outside_member`). Offboarding still only takes people off teams.
- **There's no way to let a removed person back in yet.** Their email is blocked from the org until someone clears `removed_at` in the database.
- Taking back file access makes one Drive `permissions.list` call per indexed org file, run synchronously. Fine for small orgs; slow for a large index.
- Outsiders connect their own Drive (`own_drive` task) like any personal account. Every Gmail outsider counts against the unverified-app test-user cap until Google verifies the `drive` scope (same gate as ADR-0034).
- No "Outside" badge on member rows yet. Nobody asked for one, and the project rules say not to invent visual changes.

## Implementation (2026-10-16)
- Backend: `app/members/outside.py` (link management, `join_through_outside_link`, `outside_join_tasks`, keep / remove), `app/api/routes/outside.py` (`GET/POST/PATCH /organizations/{org}/teams/{team}/outside-link`, `POST /organizations/{org}/outside-members/{member}/keep|remove`), `complete_signup` and `resolve_join_link_preview` check for an outside token first, the `removed` sign-in error code, and removed members filtered out in `members_for_email`, `get_current_member`, `/auth/refresh`, `/auth/switch`, `list_members`, governance `_people` and `list_remembered_orgs`.
- Frontend: `outside-link-section.tsx` (`OutsideLinkPanel`, `OutsideLinkSection`, `useCanManageOutsideLink`); `NewLinkButton`, `Row`, `LifetimeMenu`, `PILL` and `MIN_CREATING_MS` exported from `joining-section.tsx`; the team menu in `team-members-section.tsx`; the dialog in `screens/home-actions.tsx`; the `outside_joined` task in `tasks.ts`, `notifications-dialog.tsx` and `updates.tsx`; the `removed` screen in `sign-in-result.tsx`.
- Tests: `tests/test_outside_links.py` (10).

## Related
[[0021-founder-not-owner-leads-self-claim]] (amended) · [[0034-club-orgs-invite-only-members-own-club-account-optional]] · [[0006-observed-domain-tenant-identity]] · [[0026-notifications-tasks-and-updates]] · [[0009-contractor-work-created-as-the-org]] (contractors still use the sponsored path described there)
