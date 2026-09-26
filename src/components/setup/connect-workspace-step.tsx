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
import { SetupCopyLink } from "./setup-share-action";
import { SignInResultPanel } from "./sign-in-result";
import {
  backendError,
  backendFetch,
  startAdminProof,
  type Me,
} from "@/lib/backend";

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

  // Always run Google's check — no intermediate card or click (user 2026-09-26).
  // Google already answered no for this account: show that answer instead of
  // another round trip that lands on the same screen.
  useEffect(() => {
    if (phase !== "check" || me.is_super_admin || me.admin_proof_attempted)
      return;
    startAdminProof();
  }, [phase, me.is_super_admin, me.admin_proof_attempted]);

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
    return (
      <div>
        <SetupHeading>Connect Knohow to Google.</SetupHeading>
        <SetupBody>
          Google already confirmed you can connect {me.organization_name}
          &rsquo;s Workspace. Continue into the app to finish that step when
          ready.
        </SetupBody>
        <SetupChoices>
          <button type="button" className={SETUP_CHOICE_CLASS} onClick={onDone}>
            Continue
          </button>
        </SetupChoices>
      </div>
    );
  }

  if (phase === "check" && me.admin_proof_attempted)
    return (
      <SignInResultPanel
        result="admin_not_verified"
        onDone={() => setPhase("knowWho")}
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
          <a
            className="underline decoration-[#1c1917]/40 underline-offset-2"
            href="https://support.google.com/a/answer/33307"
            target="_blank"
            rel="noreferrer"
            title="Google Workspace Super Admin — someone who can manage your organization's Google account."
          >
            Super Admin
          </a>{" "}
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
        <div className="mt-6">
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
        </div>
        <SetupError>{error}</SetupError>
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

  return (
    <div>
      <SetupHeading>Connect Knohow to Google.</SetupHeading>
      <SetupBody>
        Checking with Google whether this account can connect your
        company&rsquo;s Workspace…
      </SetupBody>
    </div>
  );
}
