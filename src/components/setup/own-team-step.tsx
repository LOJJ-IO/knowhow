"use client";

import { useEffect, useState } from "react";
import { SetupAction, SetupBody, SetupError, SetupHeading } from "./shell";
import type { SetupTeam } from "./types";
import { ChoicePill } from "@/components/ui/choice-pill";
import { TeamIcon } from "@/components/identity/team-icon";
import { backendError, backendFetch, type Me } from "@/lib/backend";

const NONE = "none";

/** "Which teams are you in?" — the teams just named, now the thing you click.
 *  Several are allowed (user: "i could also be in more than one team"), and
 *  picking a pill is not a commitment — Continue is. */
export function OwnTeamStep({
  me,
  teams,
  onDone,
}: {
  me: Me;
  teams: SetupTeam[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [known, setKnown] = useState<SetupTeam[]>(teams);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Resuming setup lands here with nothing carried over from the screen
  // before, so the list has to be able to stand on its own.
  useEffect(() => {
    if (teams.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await backendFetch(`/org-chart/${me.organization_id}`);
        if (!res.ok) throw new Error(await backendError(res));
        const chart = await res.json();
        if (cancelled) return;
        setKnown(
          (chart.teams ?? []).map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          })),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.organization_id, teams.length]);

  /** "Not in any" is the opposite of picking teams, so the two can't hold at
   *  once, either way round. */
  function toggle(value: string) {
    setError("");
    setSelected((current) => {
      if (value === NONE) return current.includes(NONE) ? [] : [NONE];
      const withoutNone = current.filter((v) => v !== NONE);
      return withoutNone.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value];
    });
  }

  async function submit() {
    if (busy) return;
    if (selected.length === 0 || selected.includes(NONE)) {
      onDone();
      return;
    }
    setBusy(true);
    setError("");
    try {
      // One membership row per team: the backend upserts per (team, member),
      // so there is no batch endpoint to reach for.
      for (const teamId of selected) {
        const res = await backendFetch(
          `/organizations/${me.organization_id}/memberships`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              member_id: me.id,
              team_id: teamId,
              // Being in a team isn't authority: whether they own the org is
              // settled by the owner question, not by this membership.
              role: "member",
            }),
          },
        );
        if (!res.ok) throw new Error(await backendError(res));
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div>
      <SetupHeading>Which teams are you in?</SetupHeading>
      <SetupBody>Pick as many as apply.</SetupBody>
      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        {known.map((team) => (
          <ChoicePill
            key={team.id}
            label={team.name}
            leading={<TeamIcon name={team.name} size={24} />}
            selected={selected.includes(team.id)}
            onClick={() => toggle(team.id)}
          />
        ))}
        <ChoicePill
          label={"I\u2019m not in any"}
          selected={selected.includes(NONE)}
          onClick={() => toggle(NONE)}
        />
      </div>
      <SetupError>{error}</SetupError>
      <SetupAction label="Continue" onClick={() => void submit()} />
    </div>
  );
}
