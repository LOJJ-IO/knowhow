"use client";

import { useEffect, useRef, useState } from "react";
import {
  SetupAction,
  SetupBody,
  SetupError,
  SetupField,
  SetupHeading,
  clearSetupFieldError,
  shakeSetupField,
} from "./shell";
import type { SetupTeam } from "./types";
import { DragStepper } from "@/components/ui/drag-stepper";
import { TeamIcon } from "@/components/identity/team-icon";
import { backendError, backendFetch, type Me } from "@/lib/backend";

/** How many teams, then what they are called — two screens, one decision
 *  each (user, 2026-09-21).
 *
 *  The count comes first so the next screen lays out exactly that many slots
 *  and finishing is unambiguous. A growing list leaves "am I done yet?"
 *  hanging over every row; a fixed set of slots doesn't.
 *
 *  Each name is written to the backend as it is committed, so a founder who
 *  closes the tab comes back to what they already typed. */
export function TeamsStep({
  me,
  orgName,
  onDone,
}: {
  me: Me;
  orgName: string;
  onDone: (teams: SetupTeam[]) => void;
}) {
  const [phase, setPhase] = useState<"count" | "names">("count");
  const [count, setCount] = useState(3);
  const [names, setNames] = useState<string[]>([]);
  const [saved, setSaved] = useState<(SetupTeam | null)[]>([]);
  const [error, setError] = useState("");
  const slotsRef = useRef<HTMLDivElement>(null);

  // Whatever was saved on an earlier visit is already the answer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await backendFetch(`/org-chart/${me.organization_id}`);
        if (!res.ok) throw new Error(await backendError(res));
        const chart = await res.json();
        if (cancelled) return;
        const existing: SetupTeam[] = (chart.teams ?? []).map(
          (t: { id: string; name: string }) => ({ id: t.id, name: t.name }),
        );
        if (existing.length) {
          setCount(existing.length);
          setNames(existing.map((t) => t.name));
          setSaved(existing);
          setPhase("names");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.organization_id]);

  function startNaming() {
    setNames((current) =>
      Array.from({ length: count }, (_, i) => current[i] ?? ""),
    );
    setSaved((current) =>
      Array.from({ length: count }, (_, i) => current[i] ?? null),
    );
    setPhase("names");
    window.setTimeout(
      () => slotsRef.current?.querySelector("input")?.focus(),
      0,
    );
  }

  /** Commits one slot. Renames what's already there rather than making a
   *  second team, so editing a slot can't quietly duplicate it. */
  /** Returns the committed team so callers can finish without calling
   *  onDone inside a setState updater (that re-entered React during render). */
  async function commit(index: number): Promise<SetupTeam | null> {
    const name = (names[index] ?? "").trim();
    const existing = saved[index];
    if (!name || existing?.name === name) return existing ?? null;
    setError("");
    try {
      const res = existing
        ? await backendFetch(
            `/organizations/${me.organization_id}/teams/${existing.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            },
          )
        : await backendFetch(`/organizations/${me.organization_id}/teams`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
      if (!res.ok) throw new Error(await backendError(res));
      const team = await res.json();
      const savedTeam: SetupTeam = { id: team.id, name: team.name };
      setSaved((current) => {
        const next = [...current];
        next[index] = savedTeam;
        return next;
      });
      return savedTeam;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  if (phase === "count")
    return (
      <div>
        <SetupHeading>How many teams are in {orgName}?</SetupHeading>
        <SetupBody>Set the number. You can change this later.</SetupBody>
        <div className="mt-6">
          <DragStepper
            value={count}
            min={1}
            max={20}
            label="teams"
            onChange={setCount}
          />
        </div>
        <SetupError>{error}</SetupError>
        <SetupAction label="Continue" onClick={startNaming} />
      </div>
    );

  return (
    <div>
      <SetupHeading>What are they called?</SetupHeading>
      <SetupBody>Name each one. You can change them later.</SetupBody>
      {/* Each slot carries the team's generated icon, seeded from the name as
          it is typed: the identity appears with the team rather than being
          assigned later, and it is the same icon the app will show. Nothing
          is read out of the name — it is only a seed. */}
      <div ref={slotsRef} className="mt-6 flex flex-col gap-2">
        {names.map((name, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {name.trim() ? (
              <TeamIcon name={name} size={36} />
            ) : (
              <span
                aria-hidden
                className="size-9 shrink-0 rounded-full border border-dashed border-[#d9d9de]"
              />
            )}
            <SetupField
              aria-label={`Team ${i + 1}`}
              value={name}
              onChange={(e) => {
                setError("");
                clearSetupFieldError(e.currentTarget);
                setNames((current) => {
                  const next = [...current];
                  next[i] = e.target.value;
                  return next;
                });
              }}
              onBlur={() => void commit(i)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                // Commits this slot and moves to the next. Never advances the
                // screen — that is Continue's job, and only Continue's.
                e.preventDefault();
                void commit(i);
                const inputs = slotsRef.current?.querySelectorAll("input");
                (inputs?.[i + 1] as HTMLInputElement | undefined)?.focus();
              }}
            />
          </div>
        ))}
      </div>
      <SetupError>{error}</SetupError>
      <SetupAction
        label="Continue"
        onClick={() => {
          void (async () => {
            const inputs = slotsRef.current?.querySelectorAll("input");
            let incomplete = false;
            for (let i = 0; i < names.length; i += 1) {
              if ((names[i] ?? "").trim()) continue;
              shakeSetupField(inputs?.[i] as HTMLInputElement | undefined ?? null);
              incomplete = true;
            }
            if (incomplete) {
              setError("Name every team.");
              return;
            }
            const next: (SetupTeam | null)[] = [...saved];
            for (let i = 0; i < names.length; i += 1) {
              const team = await commit(i);
              if (team) next[i] = team;
            }
            onDone(next.filter((t): t is SetupTeam => t !== null));
          })();
        }}
      />
    </div>
  );
}
