"use client";

import { useEffect, useState } from "react";
import { OrgNameStep } from "./org-name-step";
import { TeamsStep } from "./teams-step";
import { OwnTeamStep } from "./own-team-step";
import { InviteLinkStep } from "./invite-link-step";
import { InviteOwnerStep } from "./invite-owner-step";
import { ConnectWorkspaceStep } from "./connect-workspace-step";
import type { SetupTeam } from "./types";
import {
  backendError,
  backendFetch,
  recordSetupStep,
  type Me,
} from "@/lib/backend";

type SetupStep =
  | "orgName"
  | "teams"
  | "ownTeam"
  | "inviteLink"
  | "inviteOwner"
  | "connectWorkspace"
  | "done";

const LEGACY_STEPS = new Set([
  "owner",
  "knowOwnerEmail",
  "ownerEmail",
  "superAdmin",
  "adminCheck",
]);

function initialStep(me: Me, startAt?: SetupStep): SetupStep {
  if (startAt) return startAt;
  const raw = me.setup_step;
  if (!raw || LEGACY_STEPS.has(raw)) return "orgName";
  if (
    raw === "orgName" ||
    raw === "teams" ||
    raw === "ownTeam" ||
    raw === "inviteLink" ||
    raw === "connectWorkspace" ||
    raw === "inviteOwner"
  )
    return raw;
  return "orgName";
}

/** Founder setup per ADR-0021, in ADR-0023's order: name → teams → own teams
 *  → join link → Google check (connect Workspace) → "Do you sit at the top?"
 *  → invite owner. Founder is never assumed to be owner; a Yes is a claim. */
export function OrgSetupForm({
  me,
  onDone,
  startAt,
  connectInitialPhase = "check",
}: {
  me: Me;
  onDone: () => void;
  startAt?: SetupStep;
  connectInitialPhase?: "check" | "knowWho";
}) {
  const [step, setStep] = useState<SetupStep>(() => initialStep(me, startAt));
  const [orgName, setOrgName] = useState(me.organization_name);
  const [teams, setTeams] = useState<SetupTeam[]>([]);
  const [chartReady, setChartReady] = useState(!me.needs_org_setup);
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    if (chartReady) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await backendFetch(
          `/organizations/${me.organization_id}/org-chart`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              is_owner: false,
              is_super_admin: false,
              owner_email: null,
              super_admin_email: null,
            }),
          },
        );
        if (!res.ok) throw new Error(await backendError(res));
        if (!cancelled) {
          setChartReady(true);
          void recordSetupStep("orgName");
        }
      } catch (e) {
        if (!cancelled)
          setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chartReady, me.organization_id, me.needs_org_setup]);

  if (bootError)
    return (
      <p className="m-0 px-[5%] text-[0.95rem] text-[#EA4335]" aria-live="polite">
        {bootError}
      </p>
    );

  if (!chartReady)
    return (
      <p className="m-0 px-[5%] text-[0.95rem] text-[#1c1917]/70">Getting ready…</p>
    );

  if (step === "orgName")
    return (
      <OrgNameStep
        me={me}
        onDone={(name) => {
          setOrgName(name);
          void recordSetupStep("teams");
          setStep("teams");
        }}
      />
    );

  if (step === "teams")
    return (
      <TeamsStep
        me={me}
        orgName={orgName}
        onDone={(created) => {
          setTeams(created);
          void recordSetupStep("ownTeam");
          setStep("ownTeam");
        }}
      />
    );

  if (step === "ownTeam")
    return (
      <OwnTeamStep
        me={me}
        teams={teams}
        onDone={() => {
          void recordSetupStep("inviteLink");
          setStep("inviteLink");
        }}
      />
    );

  if (step === "inviteLink")
    return (
      <InviteLinkStep
        me={me}
        onDone={() => {
          void recordSetupStep("connectWorkspace");
          setStep("connectWorkspace");
        }}
      />
    );

  // The Google check leaves for Google and comes back through AppEntry, which
  // resumes here or on the owner question (ADR-0023).
  if (step === "connectWorkspace")
    return (
      <ConnectWorkspaceStep
        me={me}
        initialPhase={connectInitialPhase}
        onDone={() => {
          void recordSetupStep("inviteOwner");
          setStep("inviteOwner");
        }}
      />
    );

  if (step === "inviteOwner")
    return (
      <InviteOwnerStep
        me={me}
        onDone={() => {
          void recordSetupStep("done");
          onDone();
        }}
      />
    );

  return null;
}
