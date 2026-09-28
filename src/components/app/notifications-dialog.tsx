"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/app/button";
import { AppDialog } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { TeamIcon } from "@/components/identity/team-icon";
import { startDriveConsent } from "@/lib/backend";
import { describeChange, relativeTime } from "@/lib/change-text";
import { appEntryUrl } from "@/lib/origins";
import type { TeamChanges } from "@/lib/organization";
import {
  decideJoinRequest,
  decideOwnerClaim,
  type Task,
  type TaskPerson,
} from "@/lib/tasks";

/** Notifications (user 2026-09-27, ADR-0026): what you need to do, then what
 *  changed in your teams. The Accounts dialog's shape (`size="sm"`).
 *
 *  Tasks are acted on right here where they can be (join requests, an owner
 *  claim); the rest open the place that does them (the invite form, Google's
 *  Drive consent, the company connection). */
export function NotificationsDialog({
  open,
  onOpenChange,
  newTeamIds,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Teams whose updates were unseen when the dialog opened. */
  newTeamIds: Set<string>;
  onInvite: (kind: "owner" | "super_admin") => void;
}) {
  const { chrome } = useSession();
  const { overview, tasks, refresh, reloadTasks } = useUpdates();
  useEffect(() => {
    if (open) reloadTasks();
  }, [open, reloadTasks]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"pending" | "teams">("pending");
  /** When this person last pressed Clear: team updates up to then are gone
   *  from the Teams tab. Per viewer, on this browser (a convenience, not a
   *  record), so it lives in localStorage. */
  const clearedKey = `knohow:notifications-cleared:${chrome.organizationId}`;
  const [clearedAt, setClearedAt] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(clearedKey);
    } catch {
      return null;
    }
  });

  /** Per-team Clear: when each team was last cleared on its own. */
  const teamClearedKey = `knohow:notifications-cleared-teams:${chrome.organizationId}`;
  const [teamClearedAt, setTeamClearedAt] = useState<Record<string, string>>(
    () => {
      try {
        return JSON.parse(window.localStorage.getItem(teamClearedKey) ?? "{}");
      } catch {
        return {};
      }
    },
  );

  const membersById = useMemo(
    () => new Map((overview?.members ?? []).map((m) => [m.id, m])),
    [overview],
  );
  /** The last week, newest team first. */
  const teamUpdates = useMemo(() => {
    if (!overview) return [];
    return Object.entries(overview.recentChangesByTeam)
      .map(([teamId, changes]) => {
        const cutoff = [clearedAt, teamClearedAt[teamId]]
          .filter((at): at is string => Boolean(at))
          .sort()
          .at(-1);
        return {
          team: overview.teams.find((t) => t.id === teamId),
          changes: {
            ...changes,
            events: cutoff
              ? changes.events.filter((e) => e.at > cutoff)
              : changes.events,
          },
        };
      })
      .filter((row) => row.changes.events.length > 0)
      .filter(
        (
          row,
        ): row is {
          team: NonNullable<typeof row.team>;
          changes: TeamChanges;
        } => Boolean(row.team),
      )
      .sort((a, b) => b.changes.latestAt.localeCompare(a.changes.latestAt));
  }, [overview, clearedAt, teamClearedAt]);

  function clearTeam(teamId: string) {
    const next = { ...teamClearedAt, [teamId]: new Date().toISOString() };
    setTeamClearedAt(next);
    try {
      window.localStorage.setItem(teamClearedKey, JSON.stringify(next));
    } catch {
      // Private window or blocked storage: cleared for this visit only.
    }
  }

  function clearTeamUpdates() {
    const now = new Date().toISOString();
    setClearedAt(now);
    try {
      window.localStorage.setItem(clearedKey, now);
    } catch {
      // Private window or blocked storage: cleared for this visit only.
    }
  }

  async function act(id: string, run: () => Promise<void>) {
    setBusy(id);
    setError("");
    try {
      await run();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Notifications"
      size="sm"
      footer={<Button onClick={() => onOpenChange(false)}>Close</Button>}
    >
      {/* Two tabs, grouped, styled like the footer's buttons: the open one
          is black (user 2026-09-27). Clear sits on the right, Teams only. */}
      {/* 40px between the tabs and what they show (user 2026-09-27): 24px
          here, 16px as the panel's top padding, where scrolled rows fade. */}
      <div className="mb-6 flex items-center gap-2">
        <div role="tablist" className="flex items-center gap-2">
          {(
            [
              ["pending", "Pending"],
              ["teams", "Teams"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              role="tab"
              aria-selected={tab === value}
              variant={tab === value ? "default" : "outline"}
              onClick={() => setTab(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        {tab === "teams" && teamUpdates.length > 0 ? (
          <ClearButton onClick={clearTeamUpdates} />
        ) : null}
      </div>

      {tab === "pending" ? (
        // A grid, so every row's buttons share one column and start at the
        // same x (user 2026-09-27).
        <div
          role="tabpanel"
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pt-4"
        >
          {tasks.length === 0 ? (
            <Quiet>Nothing needs you right now.</Quiet>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={`${task.kind}-${task.id}`}
                task={task}
                busy={busy === task.id}
                onApprove={(approve) =>
                  act(task.id, () =>
                    task.kind === "join_request"
                      ? decideJoinRequest(
                          chrome.organizationId,
                          task.id,
                          approve,
                        )
                      : decideOwnerClaim(chrome.organizationId, approve),
                  )
                }
                onInvite={() => {
                  onOpenChange(false);
                  onInvite(task.kind === "no_owner" ? "owner" : "super_admin");
                }}
              />
            ))
          )}
          {error ? (
            <p
              aria-live="polite"
              className={`${satoshi.className} col-span-2 m-0 text-[0.8125rem] text-[#EA4335]`}
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        // The Teams tab scrolls inside a capped height (made 10% taller
        // overall, user 2026-09-27). Its scrollbar sits in a gutter right of
        // the times, and rows fade out under the tabs instead of cutting off.
        <FadeScroll>
          {teamUpdates.length === 0 ? (
            <Quiet>No team updates this week.</Quiet>
          ) : (
            teamUpdates.map(({ team, changes }) => (
              <div key={team.id} className="flex flex-col gap-1.5">
                {/* Icon and name 30% then 5% larger (22 → 30px,
                    0.9375 → 1.28rem). */}
                <div className="flex items-center gap-2.5">
                  <TeamIcon name={team.name} size={30} />
                  <span
                    className={`${satoshi.className} truncate text-[1.28rem] font-medium text-[#1c1917]`}
                  >
                    {team.name}
                  </span>
                  {newTeamIds.has(team.id) ? <NewChip /> : null}
                  <ClearButton small onClick={() => clearTeam(team.id)} />
                </div>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-[40px]">
                  {changes.events.slice(0, 5).map((event) => (
                    <li
                      key={event.id}
                      className={`${satoshi.className} flex items-baseline gap-3 text-[0.875rem]`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[#1c1917]">
                        {describeChange(event, membersById)}
                      </span>
                      <span className="shrink-0 text-[var(--app-dim)]">
                        {relativeTime(event.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </FadeScroll>
      )}
    </AppDialog>
  );
}

function nameOf(person: TaskPerson | null) {
  return person?.displayName ?? person?.email ?? "Someone";
}

function TaskRow({
  task,
  busy,
  onApprove,
  onInvite,
}: {
  task: Task;
  busy: boolean;
  onApprove: (approve: boolean) => void;
  onInvite: () => void;
}) {
  const decide = (yes: string) => (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => onApprove(false)}
      >
        Decline
      </Button>
      <Button size="sm" disabled={busy} onClick={() => onApprove(true)}>
        {yes}
      </Button>
    </>
  );

  const [text, actions] = (() => {
    switch (task.kind) {
      case "join_request":
        return [
          `${nameOf(task.person)} wants to join ${task.team.name ?? "a team"}.`,
          decide("Approve"),
        ];
      case "owner_claim":
        return [
          `${nameOf(task.person)} says they’re the owner.`,
          decide("Confirm"),
        ];
      case "no_owner":
        return [
          "Nobody sits at the top yet.",
          <Button key="i" size="sm" variant="outline" onClick={onInvite}>
            Invite
          </Button>,
        ];
      case "no_super_admin":
        return [
          "No Google Workspace Super Admin yet.",
          <Button key="i" size="sm" variant="outline" onClick={onInvite}>
            Invite
          </Button>,
        ];
      case "company_drive":
        return [
          "The Company Drive isn’t connected.",
          <Button
            key="c"
            size="sm"
            variant="outline"
            onClick={() =>
              window.location.assign(appEntryUrl("?connect=workspace"))
            }
          >
            Connect
          </Button>,
        ];
      case "own_drive":
        return [
          "Your Drive isn’t connected.",
          <Button
            key="c"
            size="sm"
            variant="outline"
            onClick={startDriveConsent}
          >
            Connect
          </Button>,
        ];
    }
  })();

  return (
    <>
      <span
        className={`${satoshi.className} min-w-0 text-[0.9375rem] leading-[1.4] text-[#1c1917]`}
      >
        {text}
      </span>
      <span className="flex items-center gap-1.5">{actions}</span>
    </>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={`${satoshi.className} col-span-2 m-0 text-[0.9375rem] text-[var(--app-dim)]`}
    >
      {children}
    </p>
  );
}

function NewChip() {
  return (
    <span
      className={`${satoshi.className} inline-flex shrink-0 items-center rounded-[5px] bg-[var(--app-muted)] px-1.5 py-[0.15rem] text-[0.6875rem] font-medium text-[var(--app-dim)]`}
    >
      New
    </span>
  );
}

/** The Teams panel's scroll area. `-mr-8 pr-8` pushes the scrollbar into a
 *  gutter past the times; the top and bottom edges fade (a mask) only while
 *  there is more to scroll that way, so the edge under the tabs is soft. */
function FadeScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  const fade = 28;
  const mask = `linear-gradient(to bottom, ${
    edges.top ? `transparent 0, #000 ${fade}px` : "#000 0"
  }, ${edges.bottom ? `#000 calc(100% - ${fade}px), transparent 100%` : "#000 100%"})`;

  return (
    <div
      ref={ref}
      role="tabpanel"
      onScroll={measure}
      className="-mr-8 max-h-[16.25rem] overflow-y-auto pt-4 pr-8"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <div className="flex flex-col gap-[3.871rem]">{children}</div>
    </div>
  );
}

/** Clear, after the user's shake-on-hover delete button (2026-09-27), drawn
 *  like the unselected tab (the `outline` button: white, hairline border) with
 *  the red kept for the icon and label. `small` is the per-team one: text
 *  only, 20% smaller (0.75rem label, 1.6rem tall). */
function ClearButton({
  onClick,
  small = false,
}: {
  onClick: () => void;
  small?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      className={`${satoshi.className} relative ml-auto flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--app-border)] bg-white transition-colors duration-150 hover:border-[#d9d9de] ${
        small ? "h-[1.6rem] px-2.5" : "h-10 px-4"
      }`}
    >
      {small ? null : (
        <span className="relative flex shrink-0 items-center justify-center">
          <motion.span
            className="flex"
            animate={{
              y: hovered ? [0, -2, 0, -2, 0] : 0,
              rotate: hovered ? [0, -10, 10, -10, 0] : 0,
            }}
            transition={{ duration: 0.4 }}
          >
            <Trash2 className="size-4 text-[#EA4335]" />
          </motion.span>
        </span>
      )}
      <span
        className={`${small ? "text-[0.75rem]" : "ml-2 text-[0.9375rem]"} font-medium tracking-tight text-[#EA4335]`}
      >
        {small ? "Clear" : "Clear all"}
      </span>
    </motion.button>
  );
}
