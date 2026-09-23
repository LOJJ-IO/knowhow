"use client";

import { useEffect, useMemo, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { Button } from "@/components/app/button";
import {
  ManageTeamsButton,
  ReplayUpdatesButton,
} from "@/components/app/screens/home-actions";
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

type RecentWindow = { label: string | null; teamIds: Set<string> };

const NO_RECENT: RecentWindow = { label: null, teamIds: new Set() };

/** The narrowest window that holds something, and which teams changed in it. */
function recentWindow(overview: OrgOverview | null): RecentWindow {
  if (!overview) return NO_RECENT;
  const now = Date.now();
  for (const [hours, label] of RECENT_WINDOWS) {
    const cutoff = now - hours * 3600_000;
    const teamIds = new Set(
      // The week-long feed, not the since-you-last-looked one: the latter is
      // empty on every visit after the first, which is why the chart had no
      // pulses at all (user 2026-09-22).
      Object.entries(overview.recentChangesByTeam)
        .filter(([, change]) =>
          change.events.some((event) => Date.parse(event.at) >= cutoff),
        )
        .map(([teamId]) => teamId),
    );
    if (teamIds.size) return { label, teamIds };
  }
  return NO_RECENT;
}

/** Widening spans, in hours, with the words the button uses for them. */
const RECENT_WINDOWS: [number, string][] = [
  [1, "last hour"],
  [6, "last 6 hours"],
  [12, "last 12 hours"],
  [24, "last day"],
  [24 * 7, "last week"],
  [24 * 365 * 20, "whole history"],
];

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
  /** The pulses run on their own; this stops them, and bumping `replay`
   *  restarts every one of them from the top. */
  const [playing, setPlaying] = useState(true);
  const [replay, setReplay] = useState(0);
  /** True while a replay is actually travelling, which is what the button's
   *  green is tied to. */
  const [running, setRunning] = useState(false);

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

  /** What "recent" means today. The button plays the **last hour**; when
   *  nothing happened in it, the window widens — 6 hours, 12, a day, a week —
   *  and stops at the first span that holds something (user 2026-09-22). A
   *  replay of an empty hour would say nothing; a replay of everything ever
   *  would say too much.
   *
   *  Computed when the data arrives and again on each press, not in a memo:
   *  it reads the clock, and a memo that reads the clock is a memo that lies
   *  as soon as time passes.
   */
  const [replayWindow, setReplayWindow] = useState<RecentWindow | null>(null);
  /** The window the chart is currently showing: the one the last press chose,
   *  or the narrowest non-empty one for the data on screen. `useSyncExternal`
   *  isn't needed — reading the clock during render is fine here because the
   *  result is only ever a starting point, and a press recomputes it. */
  const recent = replayWindow ?? recentWindow(overview);

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
        // Only a team that changed **inside the window being played**.
        active: recent.teamIds.has(team.id),
      })),
    };
  }, [overview, recent]);

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
        <div className="min-h-[18rem] flex-1 rounded-[32px] bg-white" />
      </AppPage>
    );

  return (
    <AppPage>
      {/* The chart takes whatever height is left after the summary row, so it
          fits the window rather than huddling at the top of a scrolling page
          (user 2026-09-22). */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Nothing names the organization here any more: its name moved to
            the foot of the sidebar (user 2026-09-22), and the stat pills and
            the "signed in from…" line went with the panel they sat on. The
            screen is the chart, and these are the two things you can do to
            it. */}
        {overview.teams.length === 0 ? (
          <Panel className="flex min-h-0 flex-1 items-center justify-center">
            <EmptyState
              icon="account_tree"
              title="No teams yet"
              description="Your teams and their leads live here. Ownership and access follow this chart, so it is worth keeping it the way the company actually works."
            />
          </Panel>
        ) : (
          // The controls sit *on* the grid, in its top right corner (user
          // 2026-09-22), not in a band above it. The wrapper is what they are
          // positioned against: putting them inside the canvas itself would
          // let them scroll away with the chart.
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <ManageTeamsButton teams={overview.teams} />
              <ReplayUpdatesButton
                playing={playing}
                running={running}
                windowLabel={recent.label}
                onToggle={() => {
                  if (playing) {
                    setPlaying(false);
                    setRunning(false);
                    return;
                  }
                  // Play means play it again, from the beginning.
                  // Re-read the clock: an hour may have passed since the
                  // screen loaded.
                  const window_ = recentWindow(overview);
                  setReplayWindow(window_);
                  setPlaying(true);
                  setReplay((n) => n + 1);
                  setRunning(true);
                  // One pass: each edge is staggered by 900ms and a pulse
                  // travels for 680. When the last one lands the button
                  // drops its green and its Pause (user 2026-09-22).
                  window.setTimeout(
                    () => {
                      setRunning(false);
                      setPlaying(false);
                    },
                    Math.max(window_.teamIds.size - 1, 0) * 900 + 1200,
                  );
                }}
              />
            </div>
            <FlowCanvas
              nodes={nodes}
              edges={
                playing ? edges : edges.map((e) => ({ ...e, active: false }))
              }
              pulseKey={replay}
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
                // Flagged by the same feed that pulses: what moves on the
                // chart and what is marked on the card agree.
                const updated = recent.teamIds.has(team.id);
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
                          <span className="truncate">{team.name}</span>
                          {change ? <ChangeBadge count={change.count} /> : null}
                          {updated ? <NewBadge /> : null}
                        </CardTitle>
                        <CardMeta>
                          {team.memberIds.length === 1
                            ? "1 member"
                            : `${team.memberIds.length} members`}
                          {lead ? ` · ${lead.displayName ?? lead.email}` : ""}
                        </CardMeta>
                      </span>
                      {/* data-ui keeps the canvas from treating this as a drag. */}
                      <Button
                        data-ui
                        variant="ghost"
                        size="icon-sm"
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
                        className="size-9"
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
                      </Button>
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
          </div>
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

/** "New", on the right of a team's name, when that team has moved inside the
 *  window Home is playing (user 2026-09-22, following a reference).
 *
 *  Quiet on purpose: a muted chip in the app's own grey rather than a colour.
 *  The count badge beside it is the loud one — it says *you* haven't seen
 *  this — while this says only that something happened recently, which is a
 *  weaker claim and should look like one.
 *
 *  Sits **next to the name**, not out at the card's edge, and its corners are
 *  5px rather than fully round: both measured off the user's reference
 *  (2026-09-22 — a 194×56 chip in a 2× capture traces to a ~4.5px arc). */
function NewBadge() {
  return (
    <span
      className={`${satoshi.className} inline-flex shrink-0 items-center rounded-[5px] bg-[var(--app-muted)] px-1.5 py-[0.15rem] text-[0.6875rem] font-medium text-[var(--app-dim)]`}
    >
      New
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

/** A window: the surface a screen's content sits on. 32px corners, measured
 *  off the reference the user supplied (2026-09-22) rather than eyeballed —
 *  tracing its corner arc gives a radius of ~55px in the image, and its type
 *  sizes put that image at ~1.6×, so ~34px, called 32.
 *
 *  The canvas, the empty screens and the loading placeholder are the same
 *  window and carry the same radius, whether or not they happen to be white.
 *  Cards *on* a window keep their own, smaller radius. */
function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-[32px] bg-white", className)}>
      {children}
    </section>
  );
}
