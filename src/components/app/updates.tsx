"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useSession } from "@/components/app/session";
import { AvatarColorsProvider } from "@/components/identity/avatar-colors";
import {
  fetchOrgOverview,
  markDashboardSeen,
  type ChangeEvent,
  type OrgOverview,
  type TeamChanges,
} from "@/lib/organization";
import { fetchTasks, type Task } from "@/lib/tasks";
import { Toast } from "@base-ui/react/toast";
import { OPEN_NOTIFICATIONS_EVENT } from "@/components/app/app-toasts";

const POLL_MS = 30_000;

export type TeamUpdate = { team: OrgOverview["teams"][number]; changes: TeamChanges };

/** The org's overview, the updates this person hasn't seen, and their
 *  pending tasks: one fetch for the whole app, read by Home (cards, New
 *  badges) and the topbar bell (count, Notifications) (ADR-0026).
 *
 *  "Unseen" is what changed since they last opened the app, plus what
 *  teammates change while it's open (polled). The backend's mark is stamped
 *  once this visit has its data and again when everything is cleared;
 *  within the visit, opening the bell clears everything, expanding a team
 *  clears that team, and leaving Home clears the rest (user 2026-09-27). */
type Updates = {
  overview: OrgOverview | null;
  error: string;
  /** The overview came back 401: the session ended while the app was open. */
  signedOut: boolean;
  /** Team id → changes this person hasn't seen yet. */
  unseen: Record<string, TeamChanges>;
  tasks: Task[];
  /** The last week's team updates this person hasn't cleared, newest team
   *  first: Notifications' Teams tab and the bell's count. */
  teamUpdates: TeamUpdate[];
  clearTeamUpdates: () => void;
  clearTeamUpdate: (teamId: string) => void;
  /** Removes one update (its red minus in Notifications). */
  dismissUpdate: (eventId: string) => void;
  clearAll: () => void;
  clearTeam: (teamId: string) => void;
  /** Re-read tasks and the overview after acting on a task. */
  refresh: () => void;
  /** Re-read tasks only (Notifications opening: state can change on
   *  Google's side, e.g. the company connection being removed). */
  reloadTasks: () => void;
};

const UpdatesContext = createContext<Updates | null>(null);

export function useUpdates(): Updates {
  const updates = useContext(UpdatesContext);
  if (!updates) throw new Error("useUpdates must be used inside UpdatesProvider");
  return updates;
}

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const { me, chrome } = useSession();
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [unseen, setUnseen] = useState<Record<string, TeamChanges>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [version, setVersion] = useState(0);
  /** Every change event already counted or passed over, across reads. */
  const knownIds = useRef(new Set<string>());
  /** Tasks already seen, so only ones that arrive mid-visit toast. Null
   *  until the first read: what was already waiting never toasts. */
  const knownTasks = useRef<Set<string> | null>(null);
  const toastManager = Toast.useToastManager();
  // A ref, so raising a toast never re-runs the fetch effect.
  const toastsRef = useRef(toastManager);
  useEffect(() => {
    toastsRef.current = toastManager;
  });

  /** Joined through the link but not approved yet: the org's data stays
   *  closed to them, so there is nothing to fetch. */
  const awaitingApproval =
    me.standing !== "approved" && !me.is_founding_member;

  useEffect(() => {
    if (awaitingApproval) return;
    let cancelled = false;
    fetchOrgOverview(chrome.organizationId)
      .then((result) => {
        if (cancelled) return;
        setError("");
        setOverview(result);
        const known = knownIds.current;
        if (version === 0) {
          setUnseen(result.changesByTeam);
          for (const changes of Object.values(result.changesByTeam)) {
            for (const event of changes.events) known.add(event.id);
          }
          // Stamp after this visit has its data, so the next visit's
          // "since you looked" starts clean.
          void markDashboardSeen(chrome.organizationId);
          return;
        }
        // Later reads return everything since that stamp: only events not
        // seen before are new, so cleared badges stay cleared. The person's
        // own actions never notify them.
        const fresh: Record<string, ChangeEvent[]> = {};
        /** Team changes about this person: the only team news that toasts. */
        const aboutYouLines: string[] = [];
        for (const [teamId, changes] of Object.entries(result.changesByTeam)) {
          for (const event of changes.events) {
            if (known.has(event.id)) continue;
            known.add(event.id);
            if (event.actorMemberId === me.id) continue;
            (fresh[teamId] ??= []).push(event);
            if (event.subjectMemberId === me.id) {
              const team = result.teams.find((t) => t.id === teamId)?.name;
              const line = aboutYou(event.action, team);
              if (line) aboutYouLines.push(line);
            }
          }
        }
        if (aboutYouLines.length === 1)
          toastsRef.current.add({ description: aboutYouLines[0] });
        else if (aboutYouLines.length > 1)
          toastsRef.current.add({ description: `${aboutYouLines.length} changes to your teams.` });
        if (Object.keys(fresh).length === 0) return;
        setUnseen((current) => {
          const next = { ...current };
          for (const [teamId, events] of Object.entries(fresh)) {
            const prior = next[teamId];
            const latestAt = events.reduce(
              (latest, e) => (e.at > latest ? e.at : latest),
              prior?.latestAt ?? "",
            );
            next[teamId] = {
              count: (prior?.count ?? 0) + events.length,
              latestAt,
              events: [...events, ...(prior?.events ?? [])],
            };
          }
          return next;
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        if ((e as { status?: number }).status === 401) setSignedOut(true);
      });
    fetchTasks(chrome.organizationId)
      .then((result) => {
        if (cancelled) return;
        setTasks(result);
        // New Pending tasks toast, collapsed into one; never the first read.
        const keys = result.map((t) => `${t.kind}:${t.id}`);
        const known = knownTasks.current;
        knownTasks.current = new Set(keys);
        if (!known) return;
        const arrived = result.filter((t) => !known.has(`${t.kind}:${t.id}`));
        if (arrived.length === 0) return;
        toastsRef.current.add({
          description:
            arrived.length === 1
              ? taskLine(arrived[0])
              : `${arrived.length} new things in Pending.`,
          actionProps: {
            children: "View",
            onClick: () =>
              window.dispatchEvent(new Event(OPEN_NOTIFICATIONS_EVENT)),
          },
        });
      })
      .catch(() => {
        // The bell just shows no tasks; the app itself is unaffected.
      });
    return () => {
      cancelled = true;
    };
    // `version` is the refresh trigger; reading it for the first-load check
    // is deliberate.
  }, [chrome.organizationId, awaitingApproval, version, me.id]);

  // Teammates act while this tab is open: re-read on a timer and whenever
  // the tab comes back, so the bell counts their updates without a reload.
  useEffect(() => {
    if (awaitingApproval) return;
    const poll = () => {
      if (document.visibilityState === "visible") setVersion((v) => v + 1);
    };
    const id = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("focus", poll);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("focus", poll);
    };
  }, [awaitingApproval]);

  const clearAll = useCallback(() => {
    setUnseen({});
    // Seen now, so a reload doesn't bring these back.
    if (!awaitingApproval) void markDashboardSeen(chrome.organizationId);
  }, [chrome.organizationId, awaitingApproval]);
  const clearTeam = useCallback(
    (teamId: string) =>
      setUnseen((current) => {
        if (!(teamId in current)) return current;
        const next = { ...current };
        delete next[teamId];
        return next;
      }),
    [],
  );
  /** When this person last pressed Clear all: team updates up to then are
   *  gone from Notifications and the bell. Per viewer, on this browser (a
   *  convenience, not a record), so it lives in localStorage. */
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

  /** Single updates removed with their minus. */
  const dismissedKey = `knohow:notifications-dismissed:${chrome.organizationId}`;
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(dismissedKey) ?? "[]"));
    } catch {
      return new Set();
    }
  });

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
            events: changes.events.filter(
              (e) => (!cutoff || e.at > cutoff) && !dismissedIds.has(e.id),
            ),
          },
        };
      })
      .filter((row) => row.changes.events.length > 0)
      .filter((row): row is TeamUpdate => Boolean(row.team))
      .sort((a, b) => b.changes.latestAt.localeCompare(a.changes.latestAt));
  }, [overview, clearedAt, teamClearedAt, dismissedIds]);

  const dismissUpdate = useCallback(
    (eventId: string) => {
      setDismissedIds((current) => {
        const next = new Set(current).add(eventId);
        try {
          // Only the last week is ever listed, so older ids don't need to
          // pile up forever.
          window.localStorage.setItem(dismissedKey, JSON.stringify([...next].slice(-500)));
        } catch {
          // Private window or blocked storage: dismissed for this visit only.
        }
        return next;
      });
    },
    [dismissedKey],
  );

  const clearTeamUpdates = useCallback(() => {
    const now = new Date().toISOString();
    setClearedAt(now);
    try {
      window.localStorage.setItem(clearedKey, now);
    } catch {
      // Private window or blocked storage: cleared for this visit only.
    }
  }, [clearedKey]);

  const clearTeamUpdate = useCallback(
    (teamId: string) => {
      setTeamClearedAt((current) => {
        const next = { ...current, [teamId]: new Date().toISOString() };
        try {
          window.localStorage.setItem(teamClearedKey, JSON.stringify(next));
        } catch {
          // Private window or blocked storage: cleared for this visit only.
        }
        return next;
      });
    },
    [teamClearedKey],
  );

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const reloadTasks = useCallback(() => {
    if (awaitingApproval) return;
    fetchTasks(chrome.organizationId)
      .then((result) => {
        setTasks(result);
        // Seen in Notifications already: don't toast these later.
        const known = knownTasks.current;
        if (known) for (const t of result) known.add(`${t.kind}:${t.id}`);
      })
      .catch(() => {});
  }, [chrome.organizationId, awaitingApproval]);

  return (
    <UpdatesContext.Provider
      value={{
        overview,
        error,
        signedOut,
        unseen,
        tasks,
        teamUpdates,
        clearTeamUpdates,
        clearTeamUpdate,
        dismissUpdate,
        clearAll,
        clearTeam,
        refresh,
        reloadTasks,
      }}
    >
      {/* Avatar colours are spread across the org's teams, so they come
          from the same overview. */}
      <AvatarColorsProvider
        teams={overview?.teams}
        members={overview?.members}
      >
        {children}
      </AvatarColorsProvider>
    </UpdatesContext.Provider>
  );
}

/** A new Pending task, as one toast line. */
function taskLine(task: Task): string {
  const name = (p: { displayName: string | null; email: string } | null) =>
    p?.displayName ?? p?.email ?? "Someone";
  switch (task.kind) {
    case "join_request":
      return `${name(task.person)} wants to join ${task.team.name ?? "a team"}.`;
    case "owner_claim":
      return `${name(task.person)} says they’re the owner.`;
    default:
      return "Something new needs you in Pending.";
  }
}

/** A team change about this person, as one toast line. */
function aboutYou(action: string, team: string | undefined): string | null {
  const where = team ?? "a team";
  if (action === "org_chart.membership.upserted") return `You were added to ${where}.`;
  if (action === "org_chart.membership.removed") return `You were removed from ${where}.`;
  if (action === "org_chart.team.leader_assigned") return `You’re now the lead of ${where}.`;
  return null;
}
