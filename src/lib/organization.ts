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
