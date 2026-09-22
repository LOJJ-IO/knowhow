"use client";

import { useEffect, useRef, useState } from "react";
import {
  SetupAction,
  SetupBody,
  SetupError,
  SetupField,
  SetupHeading,
} from "./shell";
import type { SetupTeam } from "./types";
import { DragStepper } from "@/components/ui/drag-stepper";
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
  async function commit(index: number) {
    const name = (names[index] ?? "").trim();
    const existing = saved[index];
    if (!name || existing?.name === name) return;
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
      setSaved((current) => {
        const next = [...current];
        next[index] = { id: team.id, name: team.name };
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      <div ref={slotsRef} className="mt-6 flex flex-col gap-2">
        {names.map((name, i) => (
          <SetupField
            key={i}
            aria-label={`Team ${i + 1}`}
            value={name}
            onChange={(e) => {
              setError("");
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
        ))}
      </div>
      <SetupError>{error}</SetupError>
      <SetupAction
        label="Continue"
        onClick={() => {
          void (async () => {
            for (let i = 0; i < names.length; i += 1) await commit(i);
            setSaved((current) => {
              onDone(current.filter((t): t is SetupTeam => t !== null));
              return current;
            });
          })();
        }}
      />
    </div>
  );
}
