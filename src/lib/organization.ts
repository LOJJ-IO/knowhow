/** The signed-in organization, read from the backend.
 *
 *  Not mocked (user 2026-09-21): `/auth/me` and `/org-chart/{org_id}` are the
 *  real FastAPI service talking to the real Postgres. Google itself is still
 *  only reached *through* that backend — nothing here calls a Google API, per
 *  [[0001-mocked-data-first-prototype]] and [[0008-continue-with-google-via-backend]].
 *
 *  Every read takes `organizationId` as a required argument. The backend
 *  checks that the session belongs to that org (`require_same_org`), so this
 *  is a discipline the server actually enforces, not a convention. */

import { backendError, backendFetch, type Me } from "@/lib/backend";

export type OrganizationChrome = {
  organizationId: string;
  name: string;
  domain: string | null;
  viewer: { name: string; email: string; isOwner: boolean };
};

/** What the chrome needs, out of what `/auth/me` already returned. No second
 *  request: the session response carries all of it. */
export function chromeFromMe(me: Me): OrganizationChrome {
  return {
    organizationId: me.organization_id,
    name: me.organization_name,
    domain: me.organization_domain,
    viewer: {
      // Google doesn't always give a name. The address is the fallback, never
      // an invented display name.
      name: me.display_name ?? me.email,
      email: me.email,
      isOwner: me.is_owner,
    },
  };
}

export type OrgTeam = {
  id: string;
  name: string;
  memberCount: number;
  leaderId: string | null;
  parentTeamId: string | null;
  autoOwnEnabled: boolean;
};

/** The org's teams, from `GET /org-chart/{org_id}`. That endpoint is
 *  field-complete rather than shaped for a screen, so the mapping to what a
 *  screen needs happens here, once. */
export async function fetchOrgTeams(organizationId: string): Promise<OrgTeam[]> {
  const res = await backendFetch(`/org-chart/${organizationId}`);
  if (!res.ok) throw new Error(await backendError(res));
  const chart = (await res.json()) as {
    teams?: {
      id: string;
      name: string;
      team_leader_id: string | null;
      parent_team_id: string | null;
      auto_own_enabled: boolean;
      memberships?: unknown[];
    }[];
  };
  return (chart.teams ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    memberCount: team.memberships?.length ?? 0,
    leaderId: team.team_leader_id,
    parentTeamId: team.parent_team_id,
    autoOwnEnabled: team.auto_own_enabled,
  }));
}

/** Everything onboarding produced, in one read.
 *
 *  Onboarding asks a long series of questions and each answer lands somewhere
 *  different — the org's name, who owns it, the teams that were named, who is
 *  in them, the join link, the people waiting for approval, a person's several
 *  linked addresses. `GET /organizations/{org_id}/overview` assembles all of
 *  it server-side so the dashboard is one request, not five. */
export type OverviewMember = {
  id: string;
  email: string;
  displayName: string | null;
  standing: "approved" | "auto_affiliated";
  /** Shared by one human's several addresses — how onboarding's "add another
   *  account" shows up. Null when the account was never linked. */
  personId: string | null;
  isSuperAdmin: boolean;
  teamIds: string[];
  /** Org-wide roles, which have no team: top_leader, authorized_user. */
  orgWideRoles: string[];
};

export type OverviewTeam = {
  id: string;
  name: string;
  leaderId: string | null;
  autoOwnEnabled: boolean;
  memberIds: string[];
};

/** One thing that happened, from the audit log. `action` is the raw action
 *  type (`org_chart.team.edited`, `transfer_batch.executed`, …) — deliberately
 *  not an enum here, because the backend's feed counts any action type,
 *  including ones added after this was written. */
export type ChangeEvent = {
  id: string;
  action: string;
  actorMemberId: string | null;
  at: string;
};

export type TeamChanges = {
  count: number;
  latestAt: string;
  events: ChangeEvent[];
};

export type OrgOverview = {
  organizationId: string;
  name: string;
  observedDomain: string | null;
  autoAcceptWorkspaceMembers: boolean;
  /** Null once setup finished; otherwise the step it stopped on. */
  setupStep: string | null;
  setupCompleted: boolean;
  ownerMemberId: string | null;
  /** An owner named during setup who hasn't signed in yet. */
  nominatedSuperAdminEmail: string | null;
  teams: OverviewTeam[];
  members: OverviewMember[];
  joinLinkActive: boolean;
  openInvitations: number;
  pendingMembers: number;
  /** What changed since this viewer last opened the dashboard, keyed by team
   *  id. A team with no entry has no news. */
  changesByTeam: Record<string, TeamChanges>;
  /** Changes that belong to the organization rather than to a team. */
  organizationChanges: ChangeEvent[];
  /** Null when they have never opened it — then everything counts as new. */
  viewerLastSeenAt: string | null;
};

type OverviewResponse = {
  organization: {
    id: string;
    name: string;
    observed_domain: string | null;
    auto_accept_workspace_members: boolean;
    setup_step: string | null;
    setup_completed_at: string | null;
  };
  owner_member_id: string | null;
  nominated_super_admin_email: string | null;
  teams: {
    id: string;
    name: string;
    team_leader_id: string | null;
    auto_own_enabled: boolean;
    member_ids: string[];
  }[];
  members: {
    id: string;
    email: string;
    display_name: string | null;
    standing: "approved" | "auto_affiliated";
    person_id: string | null;
    is_super_admin: boolean;
    team_ids: string[];
    org_wide_roles: string[];
  }[];
  join_link: { active: boolean };
  open_invitations: number;
  pending_members: number;
  changes: {
    teams: Record<
      string,
      {
        count: number;
        latest_at: string;
        events: { id: string; action: string; actor_member_id: string | null; at: string }[];
      }
    >;
    organization: { id: string; action: string; actor_member_id: string | null; at: string }[];
    total: number;
  };
  viewer_last_seen_at: string | null;
};

export async function fetchOrgOverview(
  organizationId: string,
): Promise<OrgOverview> {
  const res = await backendFetch(`/organizations/${organizationId}/overview`);
  if (!res.ok) throw new Error(await backendError(res));
  const body = (await res.json()) as OverviewResponse;
  return {
    organizationId: body.organization.id,
    name: body.organization.name,
    observedDomain: body.organization.observed_domain,
    autoAcceptWorkspaceMembers: body.organization.auto_accept_workspace_members,
    setupStep: body.organization.setup_step,
    setupCompleted: body.organization.setup_completed_at !== null,
    ownerMemberId: body.owner_member_id,
    nominatedSuperAdminEmail: body.nominated_super_admin_email,
    teams: body.teams.map((team) => ({
      id: team.id,
      name: team.name,
      leaderId: team.team_leader_id,
      autoOwnEnabled: team.auto_own_enabled,
      memberIds: team.member_ids,
    })),
    members: body.members.map((member) => ({
      id: member.id,
      email: member.email,
      displayName: member.display_name,
      standing: member.standing,
      personId: member.person_id,
      isSuperAdmin: member.is_super_admin,
      teamIds: member.team_ids,
      orgWideRoles: member.org_wide_roles,
    })),
    joinLinkActive: body.join_link.active,
    openInvitations: body.open_invitations,
    pendingMembers: body.pending_members,
    changesByTeam: Object.fromEntries(
      Object.entries(body.changes?.teams ?? {}).map(([teamId, change]) => [
        teamId,
        {
          count: change.count,
          latestAt: change.latest_at,
          events: change.events.map(toChangeEvent),
        },
      ]),
    ),
    organizationChanges: (body.changes?.organization ?? []).map(toChangeEvent),
    viewerLastSeenAt: body.viewer_last_seen_at,
  };
}

function toChangeEvent(event: {
  id: string;
  action: string;
  actor_member_id: string | null;
  at: string;
}): ChangeEvent {
  return {
    id: event.id,
    action: event.action,
    actorMemberId: event.actor_member_id,
    at: event.at,
  };
}

/** Tells the backend the dashboard has been seen, so the next visit's badges
 *  only cover what happened after this one. Called **after** the dashboard is
 *  drawn — clearing before would erase the badges in the same render that was
 *  meant to show them. Best-effort: failing costs a stale badge, never the
 *  screen. */
export async function markDashboardSeen(organizationId: string): Promise<void> {
  try {
    await backendFetch(`/organizations/${organizationId}/dashboard-seen`, {
      method: "POST",
    });
  } catch {
    // Nothing to recover.
  }
}
