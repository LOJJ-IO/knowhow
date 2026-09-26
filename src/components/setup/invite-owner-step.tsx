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
import { backendError, backendFetch, type Me } from "@/lib/backend";

/** Invite the person at the top of the org chart. Founder ≠ owner (ADR-0021):
 *  this is a nomination, not the founder claiming the seat. */
export function InviteOwnerStep({
  me,
  onDone,
}: {
  me: Me;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"ask" | "email">("ask");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "email") emailRef.current?.focus();
  }, [phase]);

  async function sendInvite() {
    const input = emailRef.current;
    if (!input?.checkValidity()) {
      shakeSetupField(input);
      setError(input?.validationMessage || "Enter a work email.");
      return;
    }
    clearSetupFieldError(input);
    setSubmitting(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${me.organization_id}/invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "owner", email: email.trim() }),
        },
      );
      if (!res.ok) throw new Error(await backendError(res));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "email")
    return (
      <div>
        <SetupHeading>Owner&rsquo;s work email</SetupHeading>
        <SetupBody>
          We&rsquo;ll invite them to confirm they sit at the top of{" "}
          {me.organization_name}.
        </SetupBody>
        <div className="mt-6">
          <SetupField
            inputRef={emailRef}
            type="email"
            required
            aria-label="Owner's work email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearSetupFieldError(emailRef.current);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (!submitting) void sendInvite();
            }}
          />
        </div>
        <SetupError>{error}</SetupError>
        <SetupAction label="Send invite" onClick={() => void sendInvite()} />
      </div>
    );

  return (
    <div>
      <SetupHeading>Do you know who sits at the top?</SetupHeading>
      <SetupBody>
        That person is the{" "}
        <span
          className="underline decoration-[#1c1917]/40 underline-offset-2"
          title="The person at the top of your org chart in Knohow. They approve org-wide decisions. Not the same as a Google Workspace Super Admin."
        >
          owner
        </span>{" "}
        of {me.organization_name} on Knohow. You can invite them now or skip.
      </SetupBody>
      <SetupChoices>
        <button
          type="button"
          className={SETUP_CHOICE_CLASS}
          disabled={submitting}
          onClick={() => setPhase("email")}
        >
          Yes, invite them
        </button>
        <button
          type="button"
          className={SETUP_CHOICE_CLASS}
          disabled={submitting}
          onClick={onDone}
        >
          Skip for now
        </button>
      </SetupChoices>
    </div>
  );
}
