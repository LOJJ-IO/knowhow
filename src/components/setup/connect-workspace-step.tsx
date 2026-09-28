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
  SUPER_ADMIN_DEFINITION,
  SetupTerm,
  clearSetupFieldError,
  shakeSetupField,
} from "./shell";
import { emailError } from "@/lib/email";
import { ErrorTip } from "@/components/brand/tooltip";
import { SetupCopyLink } from "./setup-share-action";
import { SignInResultPanel } from "./sign-in-result";
import {
  backendError,
  backendFetch,
  startAdminProof,
  type Me,
} from "@/lib/backend";
import { DelegationConnectStep } from "./delegation-connect-step";
import { GoogleWord } from "@/components/brand/google-word";
import { GoogleG } from "@/components/ui/icons";

/** After setup: always check this account with Google first (ADR-0021).
 *  Invite-someone-else only appears after Google says this account cannot
 *  connect — never as a skip before the check. */
export function ConnectWorkspaceStep({
  me,
  onDone,
  initialPhase = "check",
}: {
  me: Me;
  onDone: () => void;
  initialPhase?: "check" | "knowWho" | "email" | "openLink";
}) {
  const [phase, setPhase] = useState<"check" | "knowWho" | "email" | "openLink">(
    initialPhase,
  );
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "email") emailRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase !== "openLink") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await backendFetch(
          `/organizations/${me.organization_id}/invitations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "super_admin" }),
          },
        );
        if (!res.ok) throw new Error(await backendError(res));
        const invitation = await res.json();
        if (!cancelled) setUrl(invitation.url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, me.organization_id]);

  async function sendEmailInvite() {
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
          body: JSON.stringify({
            kind: "super_admin",
            email: email.trim(),
          }),
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

  if (me.is_super_admin) {
    return <DelegationConnectStep me={me} onDone={onDone} />;
  }

  if (phase === "check" && me.admin_proof_attempted)
    return (
      <SignInResultPanel
        result="admin_not_verified"
        onDone={() => setPhase("knowWho")}
        onContinue={onDone}
      />
    );

  if (phase === "knowWho")
    return (
      <div>
        <SetupHeading>
          Do you know who can connect company Google?
        </SetupHeading>
        <SetupBody>
          That person is usually a{" "}
          <SetupTerm
            href="https://support.google.com/a/answer/33307"
            definition={SUPER_ADMIN_DEFINITION}
          >
            Super Admin
          </SetupTerm>{" "}
          of your Google Workspace.
        </SetupBody>
        <SetupChoices>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => setPhase("email")}
          >
            Yes, invite by email
          </button>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => setPhase("openLink")}
          >
            No, give me a link to share
          </button>
        </SetupChoices>
      </div>
    );

  if (phase === "email")
    return (
      <div>
        <SetupHeading>Their work email</SetupHeading>
        <SetupBody>
          We&rsquo;ll send an invite. Google checks whether they can connect
          Workspace when they sign in.
        </SetupBody>
        <ErrorTip
          message={error}
          onDismiss={() => {
            setError("");
            clearSetupFieldError(emailRef.current);
          }}
          className="mt-6"
        >
          <SetupField
            inputRef={emailRef}
            type="email"
            required
            aria-label="Work email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearSetupFieldError(emailRef.current);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (!submitting) void sendEmailInvite();
            }}
          />
        </ErrorTip>
        <SetupAction
          label="Send invite"
          onClick={() => void sendEmailInvite()}
        />
      </div>
    );

  if (phase === "openLink")
    return (
      <div>
        <SetupHeading>Share this link</SetupHeading>
        <SetupBody>
          Whoever opens it signs in with Google. Google checks whether they can
          connect {me.organization_name}&rsquo;s Workspace. If not, they join
          like anyone else.
        </SetupBody>
        <div className="mt-6">
          <SetupCopyLink url={url} label="Workspace connect invite link" />
        </div>
        <SetupError>{error}</SetupError>
        <SetupAction label="Continue" onClick={onDone} />
      </div>
    );

  // Waits for the click (user 2026-09-27: the auto-start from 4ee5629 only
  // flashed this screen), so the Super Admin definition can be read first.
  return (
    <div>
      <SetupHeading>
        Connect Knohow to <GoogleWord />.
      </SetupHeading>
      <SetupBody>
        Google will check whether you&rsquo;re a{" "}
        <SetupTerm
          href="https://support.google.com/a/answer/33307"
          definition={SUPER_ADMIN_DEFINITION}
        >
          Google Workspace Super Admin
        </SetupTerm>{" "}
        for your company, and may ask for one extra permission. This is how we
        know if you can finish setup fully.
      </SetupBody>
      <SetupAction
        label="Check with Google"
        icon={<GoogleG className="size-5 shrink-0" />}
        onClick={startAdminProof}
      />
    </div>
  );
}
