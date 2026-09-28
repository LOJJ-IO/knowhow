"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChoiceLabel,
  SETUP_CHOICE_CLASS,
  SetupAction,
  SetupBody,
  SetupChoices,
  SetupError,
  SetupField,
  SetupHeading,
  OwnerTerm,
  clearSetupFieldError,
  shakeSetupField,
} from "./shell";
import { emailError } from "@/lib/email";
import { ErrorTip } from "@/components/brand/tooltip";
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
  const [phase, setPhase] = useState<"top" | "ask" | "email">("top");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "email") emailRef.current?.focus();
  }, [phase]);

  async function sendInvite() {
    const input = emailRef.current;
    const problem = emailError(email);
    if (problem) {
      shakeSetupField(input);
      setError(problem);
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
      shakeSetupField(emailRef.current);
    } finally {
      setSubmitting(false);
    }
  }

  async function claimOwner() {
    setSubmitting(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${me.organization_id}/owner-claim`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await backendError(res));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Asked of the founder first (ADR-0023). Yes is a pending claim, never an
  // instant grant (ADR-0021); No moves on to inviting whoever is.
  if (phase === "top")
    return (
      <div>
        <SetupHeading>Do you sit at the top?</SetupHeading>
        <SetupBody>
          Every organization on Knohow has one <OwnerTerm />: the person in
          charge. Is that you?
        </SetupBody>
        <SetupChoices>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            disabled={submitting}
            onClick={() => void claimOwner()}
          >
            Yes
          </button>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            disabled={submitting}
            onClick={() => setPhase("ask")}
          >
            No
          </button>
        </SetupChoices>
        <SetupError>{error}</SetupError>
      </div>
    );

  if (phase === "email")
    return (
      <div>
        <SetupHeading>Owner&rsquo;s work email</SetupHeading>
        <SetupBody>
          We&rsquo;ll invite them to confirm they sit at the top of{" "}
          {me.organization_name}.
        </SetupBody>
        <ErrorTip
          message={error}
          onDismiss={() => {
            setError("");
            clearSetupFieldError(emailRef.current);
          }}
          className="mx-[2.5%] mt-6"
        >
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
        </ErrorTip>
        <SetupAction label="Send invite" onClick={() => void sendInvite()} />
      </div>
    );

  return (
    <div>
      <SetupHeading>Do you know who sits at the top?</SetupHeading>
      <SetupBody>
        That person is the{" "}
        <OwnerTerm />{" "}
        of {me.organization_name} on Knohow. You can invite them now or skip.
      </SetupBody>
      <SetupChoices>
        <button
          type="button"
          className={SETUP_CHOICE_CLASS}
          disabled={submitting}
          onClick={() => setPhase("email")}
        >
          <ChoiceLabel>Yes, invite them</ChoiceLabel>
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