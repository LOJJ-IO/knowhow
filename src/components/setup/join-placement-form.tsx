"use client";

import { useEffect, useState } from "react";
import {
  SETUP_CHOICE_CLASS,
  SetupAction,
  SetupBody,
  SetupChoices,
  SetupError,
  SetupHeading,
} from "./shell";
import { ChoicePill } from "@/components/ui/choice-pill";
import { TeamIcon } from "@/components/identity/team-icon";
import { backendError, backendFetch, type Me } from "@/lib/backend";

type Team = { id: string; name: string; team_leader_id: string | null };

type Phase = "teams" | "leads" | "owner";

/** After Google from an org join link: pick teams, claim lead or request,
 *  optionally claim owner (ADR-0021). */
export function JoinPlacementForm({
  me,
  onDone,
}: {
  me: Me;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [leadClaims, setLeadClaims] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leadIndex, setLeadIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingTeams(true);
      try {
        const res = await backendFetch(`/org-chart/${me.organization_id}`);
        if (!res.ok) throw new Error(await backendError(res));
        const chart = await res.json();
        if (cancelled) return;
        setTeams(
          (chart.teams ?? []).map(
            (t: { id: string; name: string; team_leader_id: string | null }) => ({
              id: t.id,
              name: t.name,
              team_leader_id: t.team_leader_id,
            }),
          ),
        );
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingTeams(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.organization_id]);

  const selectedTeams = teams.filter((t) => selected.includes(t.id));
  const leadQuestions = selectedTeams.filter((t) => !t.team_leader_id);
  const currentLeadTeam = leadQuestions[leadIndex];

  function toggleTeam(id: string) {
    setError("");
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  async function submit(finalClaimOwner: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${me.organization_id}/join-placement`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teams: selected.map((team_id) => ({
              team_id,
              claim_lead: Boolean(leadClaims[team_id]),
            })),
            claim_owner: finalClaimOwner,
          }),
        },
      );
      if (!res.ok) throw new Error(await backendError(res));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function afterTeams() {
    if (leadQuestions.length > 0) {
      setLeadIndex(0);
      setPhase("leads");
      return;
    }
    if (me.owner_claim_available) {
      setPhase("owner");
      return;
    }
    void submit(false);
  }

  function afterLead(claim: boolean) {
    if (!currentLeadTeam) return;
    setLeadClaims((c) => ({ ...c, [currentLeadTeam.id]: claim }));
    if (leadIndex + 1 < leadQuestions.length) {
      setLeadIndex((i) => i + 1);
      return;
    }
    if (me.owner_claim_available) {
      setPhase("owner");
      return;
    }
    void submit(false);
  }

  if (phase === "leads" && currentLeadTeam)
    return (
      <div>
        <SetupHeading>Are you the lead for {currentLeadTeam.name}?</SetupHeading>
        <SetupBody>
          If you&rsquo;re just on the team, say no. More leads can be added
          later.
        </SetupBody>
        <SetupChoices>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => afterLead(true)}
          >
            Yes, I&rsquo;m the lead
          </button>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => afterLead(false)}
          >
            No, just on the team
          </button>
        </SetupChoices>
        <SetupError>{error}</SetupError>
      </div>
    );

  if (phase === "owner")
    return (
      <div>
        <SetupHeading>Are you the owner of this organization?</SetupHeading>
        <SetupBody>
          The{" "}
          <span
            className="underline decoration-[#1c1917]/40 underline-offset-2"
            title="The person at the top of your company's org chart in Knohow — not the same as Google Super Admin."
          >
            owner
          </span>{" "}
          sits at the top of the chart. You can skip if you&rsquo;re not sure.
        </SetupBody>
        <SetupChoices>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => {
              void submit(true);
            }}
          >
            Yes, I&rsquo;m the owner
          </button>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => void submit(false)}
          >
            Skip for now
          </button>
        </SetupChoices>
        <SetupError>{error}</SetupError>
      </div>
    );

  if (loadingTeams)
    return (
      <div>
        <SetupHeading>Which teams are you on?</SetupHeading>
        <SetupBody>Loading the teams for {me.organization_name}…</SetupBody>
      </div>
    );

  return (
    <div>
      <SetupHeading>Which teams are you on?</SetupHeading>
      <SetupBody>
        {teams.length > 0
          ? "Pick one or more. Teams that already have a lead will ask them to approve you."
          : "No teams have been set up yet. You can continue and join one later."}
      </SetupBody>
      {teams.length > 0 ? (
        <div className="mx-[2.5%] mt-6 flex flex-wrap gap-2">
          {teams.map((t) => (
            <ChoicePill
              key={t.id}
              label={t.name}
              selected={selected.includes(t.id)}
              leading={<TeamIcon name={t.name} size={22} />}
              onClick={() => toggleTeam(t.id)}
            />
          ))}
        </div>
      ) : null}
      <SetupError>{error}</SetupError>
      {error && teams.length === 0 ? (
        <SetupAction
          label="Try again"
          onClick={() => {
            setError("");
            setLoadingTeams(true);
            void (async () => {
              try {
                const res = await backendFetch(
                  `/org-chart/${me.organization_id}`,
                );
                if (!res.ok) throw new Error(await backendError(res));
                const chart = await res.json();
                setTeams(
                  (chart.teams ?? []).map(
                    (t: {
                      id: string;
                      name: string;
                      team_leader_id: string | null;
                    }) => ({
                      id: t.id,
                      name: t.name,
                      team_leader_id: t.team_leader_id,
                    }),
                  ),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setLoadingTeams(false);
              }
            })();
          }}
        />
      ) : (
        <SetupAction
          label={
            selected.length === 0
              ? teams.length === 0
                ? "Continue"
                : "Not on a team yet"
              : "Continue"
          }
          onClick={() => {
            if (selected.length === 0) void submit(false);
            else afterTeams();
          }}
        />
      )}
    </div>
  );
}
