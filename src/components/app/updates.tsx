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
import {
  fetchOrgOverview,
  markDashboardSeen,
  type ChangeEvent,
  type OrgOverview,
  type TeamChanges,
} from "@/lib/organization";
import { fetchTasks, type Task } from "@/lib/tasks";

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
  const [unseen, setUnseen] = useState<Record<string, TeamChanges>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [version, setVersion] = useState(0);
  /** Every change event already counted or passed over, across reads. */
  const knownIds = useRef(new Set<string>());

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
        for (const [teamId, changes] of Object.entries(result.changesByTeam)) {
          for (const event of changes.events) {
            if (known.has(event.id)) continue;
            known.add(event.id);
            if (event.actorMemberId === me.id) continue;
            (fresh[teamId] ??= []).push(event);
          }
        }
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
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    fetchTasks(chrome.organizationId)
      .then((result) => {
        if (!cancelled) setTasks(result);
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
      .then(setTasks)
      .catch(() => {});
  }, [chrome.organizationId, awaitingApproval]);

  return (
    <UpdatesContext.Provider
      value={{
        overview,
        error,
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
      {children}
    </UpdatesContext.Provider>
  );
}
