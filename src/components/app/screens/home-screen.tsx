"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { Badge } from "@/components/app/badge";
import { Button } from "@/components/app/button";
import { CaretIcon } from "@/components/app/nav-morph";
import { ManageTeamsButton } from "@/components/app/screens/home-actions";
import { AppPage } from "@/components/app/shell";
import { EmptyState } from "@/components/app/empty-state";
import {
  FlowCanvas,
  type FlowEdge,
  type FlowNode,
} from "@/components/app/flow-canvas";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { InviteDialog } from "@/components/app/invite-dialog";
import { ResultMark } from "@/components/setup/sign-in-result";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";
import { personColor } from "@/lib/identity/composition";
import { PALETTE } from "@/lib/identity/palette";
import { type OverviewMember } from "@/lib/organization";
import { LIMITED_ACCESS_MESSAGE } from "@/lib/backend";
import { appEntryUrl } from "@/lib/origins";
import { cn } from "@/lib/utils";

/** Home (`/home`, renamed from "Dashboard" by the user 2026-09-22): the org
 *  chart and oversight in one screen.
 *
 *  The owner sits at the top and the teams spread beneath them, which is the
 *  chart. Every connector pulses, all the time, on its own: the pulses are
 *  the chart being alive, not a report of changes (user 2026-09-27). What
 *  changed lives in Notifications; a team with updates you haven't seen
 *  carries a quiet "New" beside its name until you've looked.
 *
 *  `/org-chart` and `/oversight` are gone; this replaced both.
 *
 *  Everything here is real. Changes come from the backend's audit-log feed,
 *  measured against when this person last opened Home; they drive the New
 *  chips, not the pulses. */

const OWNER_NODE = "owner";
/** Both cards run 30% bigger than the first pass (user 2026-09-22) — width,
 *  padding, avatar and type all scaled together, so a card grows rather than
 *  just getting wider around the same contents. */
const OWNER_W = 348;
const TEAM_W = 302;

export function HomeScreen() {
  const { me } = useSession();
  const { overview, error, signedOut, unseen, clearAll, clearTeam, refresh } =
    useUpdates();
  const [expanded, setExpanded] = useState<string[]>([]);

  // Leaving Home counts as having seen its updates (user 2026-09-27).
  useEffect(() => clearAll, [clearAll]);
  /** Which team's caret the pointer is on. */
  const [caret, setCaret] = useState<string | null>(null);

  /** Joined through the link but not approved yet. The founder is never in
   *  this state, and the org's data stays closed to everyone in it. */
  const awaitingApproval =
    me.standing !== "approved" && !me.is_founding_member;

  const owner = overview?.members.find((m) => m.id === overview.ownerMemberId);
  const [invitingOwner, setInvitingOwner] = useState(false);
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
      // Every connector pulses, independent of updates (user 2026-09-27).
      edges: teams.map((team) => ({ from: OWNER_NODE, to: team.id, active: true })),
    };
  }, [overview]);

  if (awaitingApproval)
    return (
      <AppPage>
        <Panel>
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="max-w-md rounded-[16px] bg-[#44403c] px-5 py-4 text-center text-[0.9375rem] text-white">
              {LIMITED_ACCESS_MESSAGE}
            </p>
          </div>
        </Panel>
      </AppPage>
    );

  // Shaped like the sign-in card's failure screens (the drawn X, a plain
  // heading, one next step), not a raw error (user 2026-09-27). Only when
  // there's nothing to show: a failed background re-read keeps the chart.
  if (signedOut || (error && !overview))
    return (
      <AppPage>
        <Panel className="flex flex-1 items-center justify-center p-6">
          <div className="flex max-w-[26rem] flex-col items-center text-center">
            <ResultMark kind="cross" />
            <h2
              className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
            >
              {signedOut
                ? "You’ve been signed out"
                : "We couldn’t load your organization"}
            </h2>
            <p
              className={`${sohne.className} mt-3 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
            >
              {signedOut
                ? "Log in again to pick up where you left off."
                : "Nothing changed. Try again in a moment."}
            </p>
            <Button
              size="lg"
              className="mt-8"
              onClick={() =>
                signedOut ? window.location.assign(appEntryUrl()) : refresh()
              }
            >
              {signedOut ? "Log in again" : "Try again"}
            </Button>
          </div>
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
            </div>
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              spread
              renderNode={(node, { selected }) => {
                if (node.id === OWNER_NODE) {
                  // Nobody owns the org yet: an empty seat, never the
                  // viewer's name (user 2026-09-27: a founder who said "No"
                  // was shown at the top).
                  const claimant = overview.pendingOwner;
                  // Someone claimed the seat: shown in it, marked as waiting
                  // on the founder / a Super Admin, and no Invite (user
                  // 2026-09-27).
                  if (!owner && claimant) {
                    const claimantName =
                      claimant.displayName ?? claimant.email;
                    return (
                      <Card selected={selected}>
                        <div className="flex items-center gap-[13px] p-[9px]">
                          <PersonAvatar
                            identity={claimant.email}
                            label={claimantName}
                            size={52}
                          />
                          <span className="min-w-0 text-left">
                            <CardTitle>{claimantName}</CardTitle>
                            <CardMeta>Owner · awaiting confirmation</CardMeta>
                          </span>
                        </div>
                      </Card>
                    );
                  }
                  if (!owner)
                    return (
                      <Card selected={selected}>
                        <div className="flex items-center gap-[13px] p-[9px]">
                          <span
                            aria-hidden
                            className="size-[52px] shrink-0 rounded-full border border-dashed border-[#d9d9de]"
                          />
                          <span className="min-w-0 flex-1 text-left">
                            <CardTitle>No owner yet</CardTitle>
                            <CardMeta>Owner</CardMeta>
                          </span>
                          {/* data-ui keeps the canvas from treating this as a drag. */}
                          <Button
                            data-ui
                            variant="outline"
                            size="sm"
                            onClick={() => setInvitingOwner(true)}
                          >
                            Invite
                          </Button>
                        </div>
                      </Card>
                    );
                  const name = owner.displayName ?? owner.email;
                  return (
                    <Card selected={selected}>
                      <div className="flex items-center gap-[13px] p-[9px]">
                        <PersonAvatar
                          identity={owner.email}
                          label={name}
                          size={52}
                        />
                        <span className="min-w-0 text-left">
                          <CardTitle>{name}</CardTitle>
                          <CardMeta>
                            {owner.id === me.id ? "Owner · you" : "Owner"}
                          </CardMeta>
                        </span>
                      </div>
                    </Card>
                  );
                }

                const team = overview.teams.find((t) => t.id === node.id);
                if (!team) return null;
                const open = expanded.includes(team.id);

                return (
                  <Card selected={selected}>
                    {/* An inset panel, so the line under it curves up at the
                        corners with the card (like the reference) instead of
                        cutting straight across. Drawn as a shadow so opening
                        doesn't shift anything by a pixel. */}
                    <div
                      className={cn(
                        "flex items-center gap-[13px] rounded-[var(--card-inner-radius)] p-[9px] transition-shadow duration-200",
                        open && "shadow-[0_0_0_1px_var(--app-border)]",
                      )}
                    >
                      <TeamIcon name={team.name} size={52} />
                      <span className="min-w-0 flex-1 text-left">
                        <CardTitle>
                          <span className="truncate">{team.name}</span>
                          {unseen[team.id] ? <NewBadge /> : null}
                        </CardTitle>
                        <span className="flex min-w-0 items-center gap-2">
                          <MemberStack
                            members={team.memberIds
                              .map((id) => membersById.get(id))
                              .filter((m): m is OverviewMember => Boolean(m))}
                          />
                          <CardMeta>
                            {team.memberIds.length === 1
                              ? "1 member"
                              : `${team.memberIds.length} members`}
                          </CardMeta>
                        </span>
                      </span>
                      {/* data-ui keeps the canvas from treating this as a drag. */}
                      <Button
                        data-ui
                        variant="ghost"
                        size="icon-sm"
                        aria-expanded={open}
                        onMouseEnter={() => setCaret(team.id)}
                        onMouseLeave={() => setCaret(null)}
                        aria-label={
                          open
                            ? `Hide ${team.name} members`
                            : `Show ${team.name} members`
                        }
                        onClick={() => {
                          // Looking inside a team counts as seeing its news.
                          clearTeam(team.id);
                          setExpanded((current) =>
                            current.includes(team.id)
                              ? current.filter((id) => id !== team.id)
                              : [...current, team.id],
                          );
                        }}
                        className="size-9"
                      >
                        {/* Leans down under the pointer; turns over while the
                            members are showing. */}
                        <span
                          className={cn(
                            "inline-flex transition-transform duration-200",
                            open && "rotate-180",
                          )}
                        >
                          <CaretIcon
                            open={caret === team.id}
                            direction="down"
                            size={20}
                          />
                        </span>
                      </Button>
                    </div>

                    {open ? (
                      <TeamDetail
                        members={team.memberIds
                          .map((id) => membersById.get(id))
                          .filter((m): m is OverviewMember => Boolean(m))}
                        leaderId={team.leaderId}
                      />
                    ) : null}
                  </Card>
                );
              }}
            />
          </div>
        )}
      </div>
      <InviteDialog
        kind="owner"
        open={invitingOwner}
        onOpenChange={setInvitingOwner}
      />
    </AppPage>
  );
}

/** What the caret opens: who is in the team. What changed in it lives in
 *  Notifications only; the card just carries New (user 2026-09-27). The
 *  canvas measures node heights, so opening this re-routes the connectors on
 *  its own. */
function TeamDetail({
  members,
  leaderId,
}: {
  members: OverviewMember[];
  leaderId: string | null;
}) {
  return (
    <div className="px-[9px] pt-[13px] pb-[9px]">
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
              {/* Lead sits right after the name, like New after a team's
                  (user 2026-09-27). */}
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                  className={`${satoshi.className} min-w-0 truncate text-[1.0625rem] leading-[1.4] text-[#1c1917]`}
                >
                  {member.displayName ?? member.email}
                </span>
                {member.id === leaderId ? <Badge>Lead</Badge> : null}
                {member.isSuperAdmin ? <Badge>Super Admin</Badge> : null}
              </span>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}

/** "New", beside a team's name, while it has updates you haven't seen
 *  (user 2026-09-27; the chip from 2026-09-22, removed in 4ee5629 and back).
 *  A muted chip in the app's grey with 5px corners, measured off the user's
 *  reference then. "Lead" beside a member's name is the same chip. */
function NewBadge() {
  return <Badge>New</Badge>;
}

/** A card on the canvas. Resting, or selected (you clicked it). Change
 *  news is a "New" chip beside the team's name, not the card border. */
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
        // Outer radius = inner panel radius + the 4px inset, so the two
        // curves stay parallel.
        "flex flex-col rounded-[calc(var(--card-inner-radius)+4px)] bg-white p-1 transition-shadow duration-200 [--card-inner-radius:12px]",
        selected
          ? "shadow-[0_0_0_1.5px_#1c1917,0_2px_10px_rgba(0,0,0,0.05)]"
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

/** A team card's people, overlapped in front of its member count like Manage
 *  teams' stack (user 2026-09-27): three at most, then a fourth circle with
 *  only a plus. The three are picked so no two share or neighbour a colour on
 *  the palette wheel; a person's colour is theirs everywhere, so it's who is
 *  shown that changes, never their colour. */
function MemberStack({ members }: { members: OverviewMember[] }) {
  if (members.length === 0) return null;
  const shown = distinctColours(members, 3);
  return (
    <span className="flex shrink-0 items-center">
      {shown.map((member, i) => (
        <PersonAvatar
          key={member.id}
          identity={member.email}
          label={member.displayName ?? member.email}
          size={20}
          className={i === 0 ? "" : "-ml-1.5 ring-2 ring-white"}
        />
      ))}
      {members.length > 3 ? (
        <span
          aria-hidden
          className="-ml-1.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--app-active)] text-[#1c1917] ring-2 ring-white"
        >
          <Plus className="size-3" strokeWidth={2.5} />
        </span>
      ) : null}
    </span>
  );
}

/** Up to `count` members whose avatar colours are furthest apart: first
 *  people at least two steps apart on the wheel, then merely different, then
 *  whoever is left. */
function distinctColours(members: OverviewMember[], count: number) {
  const size = PALETTE.length;
  const hue = (m: OverviewMember) =>
    PALETTE.indexOf(personColor(m.email) as (typeof PALETTE)[number]);
  const apart = (a: number, b: number) => {
    const d = Math.abs(a - b) % size;
    return Math.min(d, size - d);
  };
  const picked: OverviewMember[] = [];
  for (const minGap of [2, 1, 0]) {
    for (const member of members) {
      if (picked.length === count) return picked;
      if (picked.includes(member)) continue;
      if (picked.every((p) => apart(hue(p), hue(member)) >= minGap)) {
        picked.push(member);
      }
    }
  }
  return picked;
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
