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
import { AppDialog, DialogSectionTitle } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { TeamIcon } from "@/components/identity/team-icon";
import { startDriveConsent } from "@/lib/backend";
import { describeChange, relativeTime } from "@/lib/change-text";
import { appEntryUrl } from "@/lib/origins";
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
  const {
    overview,
    tasks,
    teamUpdates,
    clearTeamUpdates,
    clearTeamUpdate: clearTeam,
    dismissUpdate,
    refresh,
    reloadTasks,
  } = useUpdates();
  useEffect(() => {
    if (open) reloadTasks();
  }, [open, reloadTasks]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"pending" | "teams">("pending");

  const membersById = useMemo(
    () => new Map((overview?.members ?? []).map((m) => [m.id, m])),
    [overview],
  );

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
              ["pending", "Pending", tasks.length],
              [
                "teams",
                "Teams",
                teamUpdates.reduce(
                  (sum, row) => sum + row.changes.events.length,
                  0,
                ),
              ],
            ] as const
          ).map(([value, label, count]) => (
            <Button
              key={value}
              role="tab"
              aria-selected={tab === value}
              variant={tab === value ? "default" : "outline"}
              onClick={() => setTab(value)}
              className="relative"
            >
              {label}
              {count > 0 ? (
                // The bell's badge (notification-bell.tsx at its 40px size):
                // red, top-right, ringed in the surface it sits on.
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-1.5 -right-1.5 z-10 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-[#FF3B30] px-[3.5px] text-[8.5px] font-semibold leading-none tracking-tight text-white tabular-nums ring-2 ring-white"
                >
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Button>
          ))}
        </div>
        {tab === "teams" && teamUpdates.length > 0 ? (
          <ClearButton onClick={clearTeamUpdates} />
        ) : null}
      </div>

      {tab === "pending" ? (
        // A grid, so every row's buttons share one column and start at the
        // same x (user 2026-09-27). It runs 5% past the body's right inset,
        // which moves the buttons 5% right.
        <div
          role="tabpanel"
          className="-mr-[5%] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pt-4"
        >
          {tasks.length === 0 ? (
            <Quiet>Nothing needs you right now.</Quiet>
          ) : (
            <>
              {/* Label over the first task (user 2026-09-27). */}
              <DialogSectionTitle className="col-span-2 -mb-3">
                Tasks
              </DialogSectionTitle>
              {tasks.map((task) => (
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
                    onInvite(
                      task.kind === "no_owner" ? "owner" : "super_admin",
                    );
                  }}
                />
              ))}
            </>
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
                <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-[34px]">
                  {changes.events.slice(0, 5).map((event) => (
                    <li
                      key={event.id}
                      className={`${satoshi.className} group flex items-center gap-3 text-[0.875rem]`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[#1c1917]">
                        {describeChange(event, membersById)}
                      </span>
                      {/* Hovering (or focusing) the row swaps the time for a
                          red minus that removes just this update (user
                          2026-09-27). */}
                      <span
                        className={`${TEAM_CLEAR_WIDTH} relative flex shrink-0 items-center pl-3.5`}
                      >
                        <span className="text-[var(--app-dim)] transition-[opacity,transform] duration-150 ease-out group-focus-within:-translate-y-1 group-focus-within:opacity-0 group-hover:-translate-y-1 group-hover:opacity-0 motion-reduce:transform-none">
                          {relativeTime(event.at)}
                        </span>
                        <button
                          type="button"
                          aria-label="Remove this update"
                          onClick={() => dismissUpdate(event.id)}
                          className="absolute left-3.5 grid size-[18px] cursor-pointer scale-50 place-items-center rounded-full bg-[#EA4335] opacity-0 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] outline-none group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100 hover:bg-[#d93025] focus-visible:ring-2 focus-visible:ring-[#EA4335]/40 active:scale-90 motion-reduce:scale-100"
                        >
                          <span className="h-[2px] w-2 rounded-full bg-white" />
                        </button>
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

/** The per-team Clear and the times under it share this width, so the times
 *  start where "Clear" starts (user 2026-09-27). */
export const TEAM_CLEAR_WIDTH = "w-[3.25rem]";

/** The Teams panel's scroll area. `-mr-8 pr-8` pushes the scrollbar into a
 *  gutter past the times; the top and bottom edges fade (a mask) only while
 *  there is more to scroll that way, so the edge under the tabs is soft. */
export function FadeScroll({ children }: { children: React.ReactNode }) {
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
        small ? `h-[1.6rem] ${TEAM_CLEAR_WIDTH}` : "h-10 px-4"
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
