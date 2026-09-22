"use client";

import { useEffect, useMemo, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { AppPage } from "@/components/app/shell";
import { EmptyState } from "@/components/app/empty-state";
import {
  FlowCanvas,
  type FlowEdge,
  type FlowNode,
} from "@/components/app/flow-canvas";
import { useSession } from "@/components/app/session";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";
import {
  fetchOrgOverview,
  markDashboardSeen,
  type ChangeEvent,
  type OrgOverview,
  type OverviewMember,
} from "@/lib/organization";
import { cn } from "@/lib/utils";

/** Home (`/home`, renamed from "Dashboard" by the user 2026-09-22): the org
 *  chart and oversight in one screen.
 *
 *  The owner sits at the top and the teams spread beneath them, which is the
 *  chart. What has *happened* in each team is carried on the same cards — a
 *  badge, a lit border, and a pulse travelling up its connector — which is the
 *  oversight. Two screens' worth of information, one place to look, because
 *  the question "what changed?" is always asked about a particular team.
 *
 *  `/org-chart` and `/oversight` are gone; this replaced both.
 *
 *  Everything here is real. Changes come from the backend's audit-log feed,
 *  measured against when this person last opened Home, and a
 *  connector only pulses for a team that actually changed. Quiet is the
 *  correct state when nothing has happened. */

const OWNER_NODE = "owner";
/** Both cards run 30% bigger than the first pass (user 2026-09-22) — width,
 *  padding, avatar and type all scaled together, so a card grows rather than
 *  just getting wider around the same contents. */
const OWNER_W = 348;
const TEAM_W = 302;

export function HomeScreen() {
  const { chrome, me } = useSession();
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchOrgOverview(chrome.organizationId)
      .then((result) => {
        if (cancelled) return;
        setOverview(result);
        // Stamp only after this visit has its data: clearing first would erase
        // the badges in the very render meant to show them.
        void markDashboardSeen(chrome.organizationId);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [chrome.organizationId]);

  const owner = overview?.members.find((m) => m.id === overview.ownerMemberId);
  const membersById = useMemo(
    () => new Map((overview?.members ?? []).map((m) => [m.id, m])),
    [overview],
  );

  const { nodes, edges } = useMemo(() => {
    if (!overview) return { nodes: [] as FlowNode[], edges: [] as FlowEdge[] };
    const teams = overview.teams;
    return {
      nodes: [
        { id: OWNER_NODE, row: 0, x: 0.5, w: OWNER_W },
        // (i + 1) / (n + 1) leaves a margin at both ends, so the breadth reads
        // as balanced rather than edge to edge.
        ...teams.map((team, i) => ({
          id: team.id,
          row: 1,
          x: (i + 1) / (teams.length + 1),
          w: TEAM_W,
        })),
      ],
      edges: teams.map((team) => ({
        from: OWNER_NODE,
        to: team.id,
        // Only a team that actually changed gets a pulse.
        active: (overview.changesByTeam[team.id]?.count ?? 0) > 0,
      })),
    };
  }, [overview]);

  if (error)
    return (
      <AppPage>
        <Panel>
          <EmptyState
            icon="monitoring"
            title="Couldn't load your organization"
            description={error}
          />
        </Panel>
      </AppPage>
    );

  if (!overview)
    return (
      <AppPage>
        <div className="min-h-[18rem] flex-1 rounded-[16px] bg-white" />
      </AppPage>
    );

  const people = new Set(
    overview.members.map((m) => m.personId ?? `account:${m.id}`),
  ).size;
  const changedTeams = Object.keys(overview.changesByTeam).length;

  return (
    <AppPage>
      {/* The chart takes whatever height is left after the summary row, so it
          fits the window rather than huddling at the top of a scrolling page
          (user 2026-09-22). */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Panel className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <h2
              className={`${sohne.className} m-0 truncate text-[1.25rem] leading-[1.3] tracking-tight text-[#1c1917]`}
            >
              {overview.name}
            </h2>
            <p
              className={`${satoshi.className} m-0 mt-1 truncate text-[0.875rem] leading-[1.4] text-[var(--app-dim)]`}
            >
              {overview.observedDomain
                ? `Signed in from ${overview.observedDomain}`
                : "No Workspace domain on this organization"}
              {overview.setupCompleted ? " · setup complete" : ""}
            </p>
          </div>
          <div className={`${satoshi.className} flex shrink-0 flex-wrap gap-2`}>
            <Stat label="Teams" value={overview.teams.length} />
            <Stat label="People" value={people} />
            <Stat
              label="Waiting"
              value={overview.pendingMembers}
              tone={overview.pendingMembers ? "waiting" : undefined}
            />
            <Stat
              label="Changed"
              value={changedTeams}
              tone={changedTeams ? "active" : undefined}
            />
          </div>
        </Panel>

        {overview.teams.length === 0 ? (
          <Panel className="flex min-h-0 flex-1 items-center justify-center">
            <EmptyState
              icon="account_tree"
              title="No teams yet"
              description="Your teams and their leads live here. Ownership and access follow this chart, so it is worth keeping it the way the company actually works."
            />
          </Panel>
        ) : (
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            spread
            renderNode={(node, { selected }) => {
              if (node.id === OWNER_NODE) {
                const name =
                  owner?.displayName ?? owner?.email ?? chrome.viewer.name;
                return (
                  <Card selected={selected}>
                    <div className="flex items-center gap-[13px] p-[13px]">
                      <PersonAvatar
                        identity={owner?.email ?? chrome.viewer.email}
                        label={name}
                        size={52}
                      />
                      <span className="min-w-0 text-left">
                        <CardTitle>{name}</CardTitle>
                        <CardMeta>
                          {owner?.id === me.id ? "Owner · you" : "Owner"}
                        </CardMeta>
                      </span>
                    </div>
                  </Card>
                );
              }

              const team = overview.teams.find((t) => t.id === node.id);
              if (!team) return null;
              const change = overview.changesByTeam[team.id];
              const lead = team.leaderId
                ? membersById.get(team.leaderId)
                : undefined;
              const open = expanded.includes(team.id);

              return (
                <Card selected={selected} changed={Boolean(change)}>
                  <div className="flex items-center gap-[13px] p-[13px]">
                    <TeamIcon name={team.name} size={52} />
                    <span className="min-w-0 flex-1 text-left">
                      <CardTitle>
                        {team.name}
                        {change ? <ChangeBadge count={change.count} /> : null}
                      </CardTitle>
                      <CardMeta>
                        {team.memberIds.length === 1
                          ? "1 member"
                          : `${team.memberIds.length} members`}
                        {lead ? ` · ${lead.displayName ?? lead.email}` : ""}
                      </CardMeta>
                    </span>
                    {/* data-ui keeps the canvas from treating this as a drag. */}
                    <button
                      data-ui
                      type="button"
                      aria-expanded={open}
                      aria-label={
                        open
                          ? `Hide ${team.name} members`
                          : `Show ${team.name} members`
                      }
                      onClick={() =>
                        setExpanded((current) =>
                          current.includes(team.id)
                            ? current.filter((id) => id !== team.id)
                            : [...current, team.id],
                        )
                      }
                      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--app-dim)] transition-[background-color,color,transform] duration-150 active:scale-95 hover:bg-[var(--app-muted)] hover:text-[#1c1917]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className={cn(
                          "size-5 transition-transform duration-200",
                          open && "rotate-180",
                        )}
                        aria-hidden
                      >
                        <path
                          d="m6 9 6 6 6-6"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  {open ? (
                    <TeamDetail
                      members={team.memberIds
                        .map((id) => membersById.get(id))
                        .filter((m): m is OverviewMember => Boolean(m))}
                      leaderId={team.leaderId}
                      events={change?.events ?? []}
                      membersById={membersById}
                    />
                  ) : null}
                </Card>
              );
            }}
          />
        )}
      </div>
    </AppPage>
  );
}

/** What the caret opens: who is in the team, then what changed in it. The
 *  canvas measures node heights, so opening this re-routes the connectors on
 *  its own. */
function TeamDetail({
  members,
  leaderId,
  events,
  membersById,
}: {
  members: OverviewMember[];
  leaderId: string | null;
  events: ChangeEvent[];
  membersById: Map<string, OverviewMember>;
}) {
  return (
    <div className="border-t border-[var(--app-border)] px-[13px] py-[13px]">
      {members.length === 0 ? (
        <p
          className={`${satoshi.className} m-0 px-1 text-[0.975rem] leading-[1.5] text-[var(--app-dim)]`}
        >
          Nobody is in this team yet.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-2">
              <PersonAvatar
                identity={member.email}
                label={member.displayName ?? member.email}
                size={29}
              />
              <span
                className={`${satoshi.className} min-w-0 flex-1 truncate text-[1.0625rem] leading-[1.4] text-[#1c1917]`}
              >
                {member.displayName ?? member.email}
              </span>
              {member.id === leaderId ? (
                <span
                  className={`${satoshi.className} shrink-0 text-[0.875rem] text-[var(--app-dim)]`}
                >
                  Lead
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {events.length > 0 ? (
        <ul className="m-0 mt-2.5 flex list-none flex-col gap-1 border-t border-[var(--app-border)] p-0 pt-2.5">
          {events.map((event) => (
            <li
              key={event.id}
              className={`${satoshi.className} flex items-baseline gap-2 text-[0.975rem] leading-[1.5]`}
            >
              <span className="min-w-0 flex-1 truncate text-[#1c1917]">
                {describe(event, membersById)}
              </span>
              <span className="shrink-0 text-[var(--app-dim)]">
                {relative(event.at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Audit action types read as machine strings. This turns the ones the app
 *  actually produces into a sentence, and falls back to a tidied version of
 *  the raw type for anything new — a feed that counts every action type must
 *  not render blanks for the ones it hasn't met yet. */
const ACTIONS: Record<string, string> = {
  "org_chart.team.created": "Team created",
  "org_chart.team.edited": "Team renamed",
  "org_chart.team.deleted": "Team deleted",
  "org_chart.team.leader_assigned": "Lead assigned",
  "org_chart.membership.upserted": "Someone joined",
  "org_chart.membership.removed": "Someone left",
  "org_chart.member_offboarded": "Member offboarded",
  "offboard.completed": "Offboarding completed",
  "transfer_batch.created": "Transfer planned",
  "transfer_batch.executed": "Ownership moved",
  "transfer_batch.reversed": "Transfer reversed",
  "sharing.file_created_handled": "Document created",
  "sharing.suggested_share_created": "Access suggested",
  "sharing.suggested_share_confirmed": "Access granted",
  "sharing.reassignment_requested": "Ownership requested",
  "sharing.reassignment_confirmed": "Ownership reassigned",
};

function describe(
  event: ChangeEvent,
  membersById: Map<string, OverviewMember>,
): string {
  const what =
    ACTIONS[event.action] ??
    event.action.split(".").slice(-1)[0].replace(/_/g, " ");
  const actor = event.actorMemberId
    ? membersById.get(event.actorMemberId)
    : undefined;
  const who = actor?.displayName ?? actor?.email;
  return who ? `${what} · ${who}` : what;
}

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** A card on the canvas. Three states, deliberately distinguishable at a
 *  glance: resting, selected (you clicked it), and changed (it has news). */
function Card({
  selected,
  changed = false,
  children,
}: {
  selected: boolean;
  changed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[14px] bg-white transition-shadow duration-200",
        selected
          ? "shadow-[0_0_0_1.5px_#1c1917,0_2px_10px_rgba(0,0,0,0.05)]"
          : changed
            ? "shadow-[0_0_0_1.5px_var(--app-change),0_2px_12px_rgba(37,99,235,0.10)]"
            : "shadow-[0_0_0_1px_var(--app-border),0_1px_3px_rgba(0,0,0,0.04)]",
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={`${sohne.className} flex items-center gap-1.5 truncate text-[1.21875rem] leading-[1.35] tracking-tight text-[#1c1917]`}
    >
      {children}
    </span>
  );
}

function CardMeta({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={`${satoshi.className} block truncate text-[0.975rem] leading-[1.4] text-[var(--app-dim)]`}
    >
      {children}
    </span>
  );
}

function ChangeBadge({ count }: { count: number }) {
  return (
    <span
      className={`${satoshi.className} inline-flex h-[1.125rem] shrink-0 items-center rounded-full bg-[var(--app-change)] px-1.5 text-[0.6875rem] font-medium text-white`}
      aria-label={`${count} ${count === 1 ? "change" : "changes"} since you last looked`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-[16px] bg-white", className)}>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "waiting" | "active";
}) {
  return (
    <span className="flex items-baseline gap-1.5 rounded-full bg-[var(--app-muted)] px-3 py-1.5">
      <span
        className={cn(
          "text-[0.9375rem] font-medium",
          tone === "waiting"
            ? "text-[#92400e]"
            : tone === "active"
              ? "text-[var(--app-change)]"
              : "text-[#1c1917]",
        )}
      >
        {value}
      </span>
      <span className="text-[0.8125rem] text-[var(--app-dim)]">{label}</span>
    </span>
  );
}
