"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/app/button";
import { AppDialog } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";
import { removeTeam, type OverviewTeam } from "@/lib/organization";

/** The warning behind Manage teams' Remove team (Ronald, 2026-10-05). An empty
 *  team just goes. A team with people asks what happens to them first: move
 *  everyone to another team, or offboard everyone, with their files going to
 *  someone outside the team. Rows are the New file dialog's picker rows.
 *  Opened in a swap with Manage teams, so the two never overlap. */
export function RemoveTeamDialog({
  team,
  open,
  swap,
  onOpenChange,
}: {
  /** Kept by the caller after close, so the title doesn't blank mid-fade. */
  team: OverviewTeam | null;
  open: boolean;
  swap?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { chrome } = useSession();
  const { overview, refresh } = useUpdates();
  const [then, setThen] = useState<"move" | "offboard" | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [filesTo, setFilesTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const people = team?.memberIds.length ?? 0;
  const otherTeams = (overview?.teams ?? []).filter((t) => t.id !== team?.id);
  // Their files go to someone who stays: anyone not in this team.
  const takers = (overview?.members ?? []).filter(
    (m) => m.standing === "approved" && !team?.memberIds.includes(m.id),
  );
  const ready =
    people === 0 ||
    (then === "move" && moveTo !== null) ||
    (then === "offboard" && filesTo !== null);

  async function remove() {
    if (!team || !ready) return;
    setBusy(true);
    setError("");
    try {
      await removeTeam(
        chrome.organizationId,
        team.id,
        people === 0
          ? null
          : then === "move"
            ? { moveToTeamId: moveTo! }
            : { offboardToUserId: filesTo! },
      );
      refresh();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppDialog
      open={open}
      swap={swap}
      onOpenChange={onOpenChange}
      title={`Remove ${team?.name ?? "this team"}?`}
      kind={people === 0 ? "confirm" : "form"}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)} autoFocus={open}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy || !ready} onClick={() => void remove()}>
            Remove team
          </Button>
        </>
      }
    >
      <div className={`${satoshi.className} flex flex-col gap-5 py-2`}>
        {people === 0 ? (
          <p className="m-0 text-[0.9375rem] leading-[1.5] text-[#1c1917]">
            Its folder goes too. Its files stay as company files.
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-1">
              <span className="text-[0.875rem] font-medium text-[#1c1917]">
                {people === 1 ? "1 person is" : `${people} people are`} in it. What happens to them?
              </span>
              <ul className="m-0 flex list-none flex-col p-0">
                {row("move", then === "move", () => setThen("move"), null, "Move everyone to another team")}
                {row("offboard", then === "offboard", () => setThen("offboard"), null, "Offboard everyone")}
              </ul>
            </section>
            {then === "move" ? (
              <section className="flex flex-col gap-1">
                <span className="text-[0.875rem] font-medium text-[#1c1917]">Which team?</span>
                <ul className="m-0 flex list-none flex-col p-0">
                  {otherTeams.map((t) =>
                    row(t.id, moveTo === t.id, () => setMoveTo(t.id), <TeamIcon name={t.name} size={30} />, t.name),
                  )}
                </ul>
              </section>
            ) : null}
            {then === "offboard" ? (
              <section className="flex flex-col gap-1">
                <span className="text-[0.875rem] font-medium text-[#1c1917]">Who gets their files?</span>
                <ul className="m-0 flex list-none flex-col p-0">
                  {takers.map((m) =>
                    row(
                      m.id,
                      filesTo === m.id,
                      () => setFilesTo(m.id),
                      <PersonAvatar identity={m.email} label={m.displayName ?? m.email} size={30} />,
                      m.displayName ?? m.email,
                    ),
                  )}
                </ul>
              </section>
            ) : null}
          </>
        )}
        {error ? <p className="m-0 text-[0.8125rem] text-[#EA4335]">{error}</p> : null}
      </div>
    </AppDialog>
  );
}

function row(key: string, on: boolean, onClick: () => void, icon: ReactNode, label: string) {
  return (
    <li key={key}>
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={onClick}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2 py-2 text-left text-[0.9375rem] text-[#1c1917] outline-none hover:bg-[var(--app-muted)] focus-visible:ring-2 focus-visible:ring-[#1c1917]/15 ${on ? "bg-[var(--app-muted)]" : ""}`}
      >
        {icon}
        <span className="min-w-0 flex-1">{label}</span>
        <span
          aria-hidden
          className={`grid size-5 shrink-0 place-items-center rounded-full border ${on ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-[#d9d9de]"}`}
        >
          {on ? <Check size={12} strokeWidth={3} /> : null}
        </span>
      </button>
    </li>
  );
}
