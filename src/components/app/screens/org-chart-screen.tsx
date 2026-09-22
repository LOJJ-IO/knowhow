"use client";

import { useEffect, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { AppPage } from "@/components/app/shell";
import { EmptyState } from "@/components/app/empty-state";
import { useSession } from "@/components/app/session";
import { TeamIcon } from "@/components/identity/team-icon";
import { fetchOrgTeams, type OrgTeam } from "@/lib/organization";

/** The org's teams, read from the backend.
 *
 *  First screen wired to real data rather than a fixture: `GET
 *  /org-chart/{org_id}` through `fetchOrgTeams`, scoped by the session's
 *  `organizationId`. Each team carries its generated icon, seeded from its
 *  name, so the identity a founder saw while naming teams in setup is the
 *  same one they see here. */
export function OrgChartScreen() {
  const { chrome } = useSession();
  const [teams, setTeams] = useState<OrgTeam[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchOrgTeams(chrome.organizationId)
      .then((result) => {
        if (!cancelled) setTeams(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setTeams([]);
      });
    return () => {
      cancelled = true;
    };
  }, [chrome.organizationId]);

  if (teams === null)
    return (
      <AppPage>
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-[16px] bg-white" />
      </AppPage>
    );

  if (teams.length === 0)
    return (
      <AppPage>
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-[16px] bg-white">
          <EmptyState
            icon="account_tree"
            title={error ? "Couldn't load your teams" : "No teams yet"}
            description={
              error ||
              "Your teams and their leads live here. Ownership and access follow this chart, so it is worth keeping it the way the company actually works."
            }
          />
        </div>
      </AppPage>
    );

  return (
    <AppPage>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 p-0">
        {teams.map((team) => (
          <li
            key={team.id}
            className="flex items-center gap-3 rounded-[16px] bg-white px-4 py-3.5"
          >
            <TeamIcon name={team.name} size={44} />
            <div className="min-w-0">
              <p
                className={`${sohne.className} m-0 truncate text-[1rem] leading-[1.35] tracking-tight text-[#1c1917]`}
              >
                {team.name}
              </p>
              <p
                className={`${satoshi.className} m-0 truncate text-[0.8125rem] text-[var(--app-dim)]`}
              >
                {team.memberCount === 1 ? "1 member" : `${team.memberCount} members`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </AppPage>
  );
}
