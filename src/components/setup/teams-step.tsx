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
import { ErrorTip } from "@/components/brand/tooltip";
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
  /** Which team field the error is about, so it sits above that field. */
  const [errorAt, setErrorAt] = useState<number | null>(null);
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
      setErrorAt(index);
      shakeSetupField(
        (slotsRef.current?.querySelectorAll("input")[index] as
          | HTMLInputElement
          | undefined) ?? null,
      );
      return null;
    }
  }

  /** Removes one slot, deleting its team if it was already saved. */
  async function remove(index: number) {
    const existing = saved[index];
    if (existing) {
      setError("");
      try {
        const res = await backendFetch(
          `/organizations/${me.organization_id}/teams/${existing.id}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error(await backendError(res));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setErrorAt(index);
        shakeSetupField(
          (slotsRef.current?.querySelectorAll("input")[index] as
            | HTMLInputElement
            | undefined) ?? null,
        );
        return;
      }
    }
    if (errorAt === index) {
      setError("");
      setErrorAt(null);
    }
    setNames((current) => current.filter((_, i) => i !== index));
    setSaved((current) => current.filter((_, i) => i !== index));
    setCount((c) => Math.max(1, c - 1));
  }

  if (phase === "count")
    return (
      <div>
        <SetupHeading>How many teams are in {orgName}?</SetupHeading>
        <SetupBody>Set the number. You can change this later.</SetupBody>
        <div className="mx-[2.5%] mt-6">
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
      <div ref={slotsRef} className="mt-6 flex flex-col gap-3 pb-3">
        {names.map((name, i) => (
          <div key={i} className="group relative flex items-center gap-2.5 pr-[5%]">
            {/* The icon's column is the icon plus 5% of the row; the field
                gives that 5% up from its left edge (user, 2026-09-27). */}
            <div className="flex w-[calc(3rem+5%)] shrink-0 justify-center">
              {name.trim() ? (
                <TeamIcon name={name} size={48} />
              ) : (
                <span
                  aria-hidden
                  className="size-12 shrink-0 rounded-full border border-dashed border-[#d9d9de]"
                />
              )}
            </div>
            <ErrorTip
              message={errorAt === i ? error : null}
              onDismiss={() => {
                setError("");
                setErrorAt(null);
                slotsRef.current
                  ?.querySelectorAll("input")
                  .forEach((input) => clearSetupFieldError(input));
              }}
              className="min-w-0 flex-1"
            >
              <SetupField
                aria-label={`Team ${i + 1}`}
                value={name}
                onChange={(e) => {
                  setError("");
                  setErrorAt(null);
                  clearSetupFieldError(e.currentTarget);
                  setNames((current) => {
                    const next = [...current];
                    next[i] = e.target.value;
                    return next;
                  });
                }}
                onBlur={() => void commit(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    // Moving off a slot blurs it, and blur commits.
                    const inputs = slotsRef.current?.querySelectorAll("input");
                    const target = inputs?.[
                      i + (e.key === "ArrowUp" ? -1 : 1)
                    ] as HTMLInputElement | undefined;
                    if (!target) return;
                    e.preventDefault();
                    target.focus();
                    return;
                  }
                  if (e.key !== "Enter") return;
                  // Commits this slot and moves to the next. Never advances the
                  // screen — that is Continue's job, and only Continue's.
                  e.preventDefault();
                  void commit(i);
                  const inputs = slotsRef.current?.querySelectorAll("input");
                  (inputs?.[i + 1] as HTMLInputElement | undefined)?.focus();
                }}
              />
            </ErrorTip>
            {/* Hovering (or focusing) a slot springs in a red minus in the
                row's right inset that removes it, like a Notifications update
                (user 2026-09-27). Never on the last slot. */}
            {names.length > 1 ? (
              <button
                type="button"
                aria-label={`Remove team ${i + 1}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void remove(i)}
                className="absolute right-[calc(2.5%-9px)] grid size-[18px] cursor-pointer scale-50 place-items-center rounded-full bg-[#EA4335] opacity-0 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] outline-none group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100 hover:bg-[#d93025] focus-visible:ring-2 focus-visible:ring-[#EA4335]/40 active:scale-90 motion-reduce:scale-100"
              >
                <span className="h-[2px] w-2 rounded-full bg-white" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {/* Only an error that isn't about one field (loading the teams). */}
      <SetupError>{errorAt === null ? error : ""}</SetupError>
      <SetupAction
        label="Continue"
        onClick={() => {
          void (async () => {
            const inputs = slotsRef.current?.querySelectorAll("input");
            let firstEmpty: number | null = null;
            for (let i = 0; i < names.length; i += 1) {
              if ((names[i] ?? "").trim()) continue;
              shakeSetupField(
                (inputs?.[i] as HTMLInputElement | undefined) ?? null,
              );
              firstEmpty ??= i;
            }
            if (firstEmpty !== null) {
              setError("Name every team.");
              setErrorAt(firstEmpty);
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
