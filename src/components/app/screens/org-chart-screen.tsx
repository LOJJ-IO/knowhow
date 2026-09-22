"use client";

import { useEffect, useMemo, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { AppPage } from "@/components/app/shell";
import { EmptyState } from "@/components/app/empty-state";
import { FlowCanvas, type FlowEdge, type FlowNode } from "@/components/app/flow-canvas";
import { useSession } from "@/components/app/session";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";
import { fetchOrgOverview, type OrgOverview } from "@/lib/organization";
import { cn } from "@/lib/utils";

/** The org chart, drawn as a graph: the owner at the top, the teams spread
 *  beneath them forming the breadth of it (user 2026-09-21).
 *
 *  Everything on it is real: the owner comes from the org chart row setup
 *  created, the teams from the teams that were named, the counts from the
 *  memberships people picked on "Which teams are you in?". Cards drag; the
 *  connectors follow. */

const OWNER_NODE = "owner";
const OWNER_W = 260;
const TEAM_W = 216;

export function OrgChartScreen() {
  const { chrome, me } = useSession();
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchOrgOverview(chrome.organizationId)
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [chrome.organizationId]);

  const owner = overview?.members.find(
    (member) => member.id === overview.ownerMemberId,
  );

  const { nodes, edges } = useMemo(() => {
    if (!overview) return { nodes: [] as FlowNode[], edges: [] as FlowEdge[] };
    const teams = overview.teams;
    return {
      nodes: [
        { id: OWNER_NODE, row: 0, x: 0.5, w: OWNER_W },
        // Evenly spread across the row: (i + 1) / (n + 1) leaves a margin at
        // both ends, so the breadth reads as balanced rather than edge to edge.
        ...teams.map((team, i) => ({
          id: team.id,
          row: 1,
          x: (i + 1) / (teams.length + 1),
          w: TEAM_W,
        })),
      ],
      edges: teams.map((team) => ({ from: OWNER_NODE, to: team.id })),
    };
  }, [overview]);

  if (error)
    return (
      <AppPage>
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-[16px] bg-white">
          <EmptyState
            icon="account_tree"
            title="Couldn't load your org chart"
            description={error}
          />
        </div>
      </AppPage>
    );

  if (!overview)
    return (
      <AppPage>
        <div className="min-h-[18rem] flex-1 rounded-[16px] bg-[var(--app-ground)]" />
      </AppPage>
    );

  if (overview.teams.length === 0)
    return (
      <AppPage>
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-[16px] bg-white">
          <EmptyState
            icon="account_tree"
            title="No teams yet"
            description="Your teams and their leads live here. Ownership and access follow this chart, so it is worth keeping it the way the company actually works."
          />
        </div>
      </AppPage>
    );

  const ownerName = owner?.displayName ?? owner?.email ?? chrome.viewer.name;
  const ownerEmail = owner?.email ?? chrome.viewer.email;

  return (
    <AppPage>
      <FlowCanvas
        nodes={nodes}
        edges={edges}
        renderNode={(node, { selected }) => {
          if (node.id === OWNER_NODE)
            return (
              <Card selected={selected}>
                <PersonAvatar
                  identity={ownerEmail}
                  label={ownerName}
                  size={40}
                />
                <span className="min-w-0 text-left">
                  <span
                    className={`${sohne.className} block truncate text-[0.9375rem] leading-[1.35] tracking-tight text-[#1c1917]`}
                  >
                    {ownerName}
                  </span>
                  <span
                    className={`${satoshi.className} block truncate text-[0.75rem] leading-[1.4] text-[var(--app-dim)]`}
                  >
                    {owner?.id === me.id ? "Owner · you" : "Owner"}
                  </span>
                </span>
              </Card>
            );

          const team = overview.teams.find((t) => t.id === node.id);
          if (!team) return null;
          const lead = overview.members.find((m) => m.id === team.leaderId);
          return (
            <Card selected={selected}>
              <TeamIcon name={team.name} size={40} />
              <span className="min-w-0 text-left">
                <span
                  className={`${sohne.className} block truncate text-[0.9375rem] leading-[1.35] tracking-tight text-[#1c1917]`}
                >
                  {team.name}
                </span>
                <span
                  className={`${satoshi.className} block truncate text-[0.75rem] leading-[1.4] text-[var(--app-dim)]`}
                >
                  {team.memberIds.length === 1
                    ? "1 member"
                    : `${team.memberIds.length} members`}
                  {lead ? ` · ${lead.displayName ?? lead.email}` : ""}
                </span>
              </span>
            </Card>
          );
        }}
      />
    </AppPage>
  );
}

/** One card on the canvas. Selection is a ring rather than a fill, so a
 *  selected card doesn't change weight against the dots. */
function Card({
  selected,
  children,
}: {
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-[14px] bg-white p-2.5 transition-shadow duration-150",
        selected
          ? "shadow-[0_0_0_1.5px_#1c1917,0_2px_10px_rgba(0,0,0,0.05)]"
          : "shadow-[0_0_0_1px_var(--app-border),0_1px_3px_rgba(0,0,0,0.04)]",
      )}
    >
      {children}
    </div>
  );
}
