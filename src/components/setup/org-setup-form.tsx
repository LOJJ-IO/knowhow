"use client";

import { useEffect, useRef, useState } from "react";
import {
  SETUP_CHOICE_CLASS,
  SetupAction,
  SetupBody,
  SetupChoices,
  SetupError,
  SetupField,
  SetupHeading,
  clearSetupFieldError,
  shakeSetupField,
} from "./shell";
import { OrgNameStep } from "./org-name-step";
import { TeamsStep } from "./teams-step";
import { OwnTeamStep } from "./own-team-step";
import { InviteLinkStep } from "./invite-link-step";
import type { SetupTeam } from "./types";
import {
  backendError,
  backendFetch,
  recordSetupStep,
  startAdminProof,
  type Me,
} from "@/lib/backend";

type SetupStep =
  | "owner"
  | "knowOwnerEmail"
  | "ownerEmail"
  | "superAdmin"
  | "orgName"
  | "teams"
  | "ownTeam"
  | "inviteLink"
  | "adminCheck"
  | "done";

/** First sign-in for a new organization: who owns it, what it's called, its
 *  teams, and the link that brings everyone else in.
 *
 *  This file is the order of the screens and nothing else — each screen owns
 *  its own behaviour, and all of them compose `./shell`. */
export function OrgSetupForm({ me, onDone }: { me: Me; onDone: () => void }) {
  // Resume where they stopped; "owner" only when setup hasn't started.
  const [step, setStep] = useState<SetupStep>(
    (me.setup_step as SetupStep | null) ?? "owner",
  );
  const [isOwner, setIsOwner] = useState(true);
  // What they said to the Super Admin question, so the Google check at the
  // end can speak to it. Null when setup resumed past that question.
  const [superAdminAnswer, setSuperAdminAnswer] = useState<
    "no" | "unsure" | null
  >(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  // Starts as whatever the org is called now (its domain, until the naming
  // screen replaces it) so the teams heading always has something to say.
  const [orgName, setOrgName] = useState(me.organization_name);
  const [teams, setTeams] = useState<SetupTeam[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const ownerEmailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "ownerEmail") ownerEmailRef.current?.focus();
  }, [step]);

  async function answerSuperAdmin(answer: "yes" | "no" | "unsure") {
    const isSuperAdmin = answer === "yes";
    setSubmitting(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${me.organization_id}/org-chart`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_owner: isOwner,
            is_super_admin: isSuperAdmin,
            owner_email: isOwner || !ownerEmail ? null : ownerEmail,
          }),
        },
      );
      if (!res.ok) throw new Error(await backendError(res));
      if (isSuperAdmin) {
        // "Yes" is only a claim — Google confirms it before Knohow treats
        // them as Super Admin.
        startAdminProof();
        return;
      }
      // "No" and "I don't know" carry straight on. Proving admin is not a
      // gate on setting up an organization, so it waits until the end.
      setSuperAdminAnswer(answer);
      void recordSetupStep("orgName");
      setStep("orgName");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "owner")
    return (
      <div>
        <SetupHeading>Are you the owner of the organization?</SetupHeading>
        <SetupChoices>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => {
              setIsOwner(true);
              setOwnerEmail("");
              setStep("superAdmin");
            }}
          >
            Yes
          </button>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => {
              setIsOwner(false);
              setStep("knowOwnerEmail");
            }}
          >
            No
          </button>
        </SetupChoices>
      </div>
    );

  if (step === "knowOwnerEmail")
    return (
      <div>
        <SetupHeading>Do you know the owner&rsquo;s email?</SetupHeading>
        <SetupChoices>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => setStep("ownerEmail")}
          >
            Yes
          </button>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => {
              setOwnerEmail("");
              setStep("superAdmin");
            }}
          >
            No
          </button>
        </SetupChoices>
      </div>
    );

  function validateOwnerEmail() {
    const input = ownerEmailRef.current;
    if (!input?.checkValidity()) {
      shakeSetupField(input);
      setError(input?.validationMessage || "Enter a work email.");
      return false;
    }
    clearSetupFieldError(input);
    setError("");
    return true;
  }

  if (step === "ownerEmail")
    return (
      <div>
        <SetupHeading>Owner&rsquo;s work email</SetupHeading>
        <div className="mt-6">
          <SetupField
            inputRef={ownerEmailRef}
            type="email"
            required
            aria-label="Owner's work email"
            value={ownerEmail}
            onChange={(e) => {
              setOwnerEmail(e.target.value);
              clearSetupFieldError(ownerEmailRef.current);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (validateOwnerEmail()) setStep("superAdmin");
            }}
          />
        </div>
        <SetupError>{error}</SetupError>
        <SetupAction
          label="Continue"
          onClick={() => {
            if (validateOwnerEmail()) setStep("superAdmin");
          }}
        />
      </div>
    );

  if (step === "superAdmin")
    return (
      <div>
        <SetupHeading>Are you a Google Workspace Super Admin?</SetupHeading>
        <SetupChoices>
          {[
            { label: "Yes", value: "yes" as const },
            { label: "No", value: "no" as const },
            { label: "I don’t know", value: "unsure" as const },
          ].map((answer) => (
            <button
              key={answer.label}
              type="button"
              className={SETUP_CHOICE_CLASS}
              onClick={() => {
                if (submitting) return;
                void answerSuperAdmin(answer.value);
              }}
            >
              {answer.label}
            </button>
          ))}
        </SetupChoices>
        <SetupError>{error}</SetupError>
      </div>
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
          // Setup is finished at the link; the Google check that follows is
          // an offer, not a step, so closing on it must not reopen setup.
          void recordSetupStep("done");
          if (me.is_super_admin || me.admin_proof_attempted) onDone();
          else setStep("adminCheck");
        }}
      />
    );

  // "No": they've told us they aren't the admin, so don't send them to a
  // Google check that can only fail. Their admin connects Knohow later.
  if (step === "adminCheck" && superAdminAnswer === "no")
    return (
      <div>
        <SetupHeading>Your admin connects Knohow to Google.</SetupHeading>
        <SetupBody>
          Only a Google Workspace Super Admin can do this. You can invite
          yours from the app later.
        </SetupBody>
        <SetupChoices>
          <button type="button" className={SETUP_CHOICE_CLASS} onClick={onDone}>
            Done
          </button>
        </SetupChoices>
      </div>
    );

  if (step === "adminCheck" && superAdminAnswer === "unsure")
    return (
      <div>
        <SetupHeading>Not sure if you&rsquo;re the admin?</SetupHeading>
        <SetupBody>
          Google can check for you. If you&rsquo;re not, nothing changes and
          you can invite your admin later.
        </SetupBody>
        <SetupChoices>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={startAdminProof}
          >
            Check with Google
          </button>
        </SetupChoices>
      </div>
    );

  if (step === "adminCheck")
    return (
      <div>
        <SetupHeading>Connect Knohow to Google.</SetupHeading>
        <SetupBody>
          Only a Workspace admin can do this. Google will check whether
          that&rsquo;s you, and ask for one extra permission.
        </SetupBody>
        <SetupChoices>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={startAdminProof}
          >
            Check with Google
          </button>
        </SetupChoices>
      </div>
    );

  // "done" — the signed-in screen isn't designed yet (user will describe it).
  return null;
}
