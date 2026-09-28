"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useSession } from "@/components/app/session";
import {
  fetchOrgOverview,
  markDashboardSeen,
  type OrgOverview,
  type TeamChanges,
} from "@/lib/organization";
import { fetchTasks, type Task } from "@/lib/tasks";

/** The org's overview, the updates this person hasn't seen, and their
 *  pending tasks: one fetch for the whole app, read by Home (cards, New
 *  badges) and the topbar bell (count, Notifications) (ADR-0026).
 *
 *  "Unseen" is what changed since they last opened the app. The backend's
 *  mark is stamped once this visit has its data, so a refresh starts clean;
 *  within the visit, opening the bell clears everything, expanding a team
 *  clears that team, and leaving Home clears the rest (user 2026-09-27). */
type Updates = {
  overview: OrgOverview | null;
  error: string;
  /** Team id → changes this person hasn't seen yet. */
  unseen: Record<string, TeamChanges>;
  tasks: Task[];
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
        // Only the first load decides what's unseen; a refresh after acting
        // on a task mustn't bring cleared badges back.
        if (version === 0) {
          setUnseen(result.changesByTeam);
          // Stamp after this visit has its data, so the next visit's
          // "since you looked" starts clean.
          void markDashboardSeen(chrome.organizationId);
        }
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
  }, [chrome.organizationId, awaitingApproval, version]);

  const clearAll = useCallback(() => setUnseen({}), []);
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
