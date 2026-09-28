"use client";

import { useEffect, useRef, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { ErrorTip } from "@/components/brand/tooltip";
import {
  BACKEND_API_URL,
  backendError,
  backendFetch,
  startAdminProof,
} from "@/lib/backend";
import {
  ChoiceLabel,
  SETUP_CHOICE_CLASS,
  SUPER_ADMIN_DEFINITION,
  SetupAction,
  SetupBody,
  SetupField,
  SetupHeading,
  SetupTerm,
  clearSetupFieldError,
  shakeSetupField,
} from "./shell";

/** What Google said on the way back: `?admin_proof=`, `?signup=personal`,
 *  `?invite=wrong_account`, `?link=`. Reading the result, clearing it from
 *  the URL, and the panel that reports it. PLACEHOLDER copy. */

/** Outcomes the backend reports back in the URL after a Google round trip. */
export type SignInResult =
  | "admin_verified"
  | "admin_not_verified"
  | "admin_error"
  | "personal"
  | "invite_wrong_account"
  | "link_linked"
  | "link_already_linked";

export function readSignInResult(): SignInResult | null {
  const params = new URLSearchParams(window.location.search);
  const adminProof = params.get("admin_proof");
  if (adminProof === "verified") return "admin_verified";
  if (adminProof === "not_verified") return "admin_not_verified";
  if (adminProof === "error") return "admin_error";
  if (params.get("signup") === "personal") return "personal";
  if (params.get("invite") === "wrong_account") return "invite_wrong_account";
  const link = params.get("link");
  if (link === "linked") return "link_linked";
  if (link === "already_linked") return "link_already_linked";
  return null;
}

/** Drops the result from the URL so a reload doesn't show it again. */
export function clearSignInResultFromUrl() {
  const url = new URL(window.location.href);
  for (const key of ["admin_proof", "signup", "invite", "link"]) url.searchParams.delete(key);
  window.history.replaceState(null, "", url);
}

/** "Yes, my company uses Google Workspace" — sign in to the work account.
 *  The personal identity already proved is carried through and recorded
 *  against the same person; no personal org is created (user 2026-09-20). */
export function linkOrganizationAccount() {
  if (!BACKEND_API_URL) return;
  // External origin (the backend), not a Next.js route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${BACKEND_API_URL}/onboarding/link-org-account`);
}

/** Sends the browser back to Google with the account chooser forced open. */
export function signInWithAnotherAccount() {
  if (!BACKEND_API_URL) return;
  // External origin (the backend), not a Next.js route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${BACKEND_API_URL}/onboarding/signup?switch_account=true`);
}

/** What came back from Google. PLACEHOLDER copy (user asked for placeholders
 *  until they design these screens). */
export function SignInResultPanel({
  result,
  onDone,
  onContinue,
  organizationName,
}: {
  result: SignInResult;
  /** The organization's name, for the verified screen's sub-line. */
  organizationName?: string;
  /** Closes the sheet. */
  onDone: () => void;
  /** "Google didn't confirm" mid-setup: carry on with setup (the owner
   *  question, ADR-0023) instead of jumping into the app. */
  onContinue?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  /** "No, just me" was chosen: now name the workspace. */
  const [naming, setNaming] = useState(false);
  const [orgName, setOrgName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  async function createPersonalOrg() {
    setSubmitting(true);
    setError("");
    try {
      const res = await backendFetch("/onboarding/personal-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      if (!res.ok) {
        throw new Error(await backendError(res));
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      shakeSetupField(nameRef.current);
    } finally {
      setSubmitting(false);
    }
  }

  /** Never disabled (setup rule): an empty name shakes the field instead. */
  function submitWorkspaceName() {
    if (submitting) return;
    if (!orgName.trim()) {
      nameRef.current?.focus();
      shakeSetupField(nameRef.current);
      setError("Enter a workspace name.");
      return;
    }
    void createPersonalOrg();
  }

  // "done" — the signed-in screen isn't designed yet (user will describe it).
  if (done) return null;

  // The setup shell's own heading and sub-line, so these screens share its
  // indent and spacing (user, 2026-09-27).
  const heading = (text: React.ReactNode) => <SetupHeading>{text}</SetupHeading>;
  const body = (text: string) => <SetupBody>{text}</SetupBody>;
  const choices = (
    buttons: { label: string; onClick: () => void }[],
  ) => (
    <div className={`${satoshi.className} mt-8 flex flex-col gap-3`}>
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          disabled={submitting}
          className={SETUP_CHOICE_CLASS}
          onClick={b.onClick}
        >
          <ChoiceLabel>{b.label}</ChoiceLabel>
        </button>
      ))}
    </div>
  );
  const errorLine = error ? (
    <p
      aria-live="polite"
      className={`${satoshi.className} m-0 mx-[2.5%] mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
    >
      {error}
    </p>
  ) : null;

  switch (result) {
    case "admin_verified":
      return (
        <div>
          <ResultMark kind="check" />
          {heading(
            <>
              You’re verified as a{" "}
              <SetupTerm definition={SUPER_ADMIN_DEFINITION}>
                Google Workspace Super Admin
              </SetupTerm>
            </>,
          )}
          {body(
            `Google confirmed you manage ${organizationName ? `${organizationName}’s` : "your company’s"} Google accounts. That lets you connect your company’s Drive to Knohow.`,
          )}
          <SetupAction label="Continue" onClick={onDone} />
        </div>
      );
    case "admin_not_verified":
      // Wrong person tried Connect — recover by inviting someone else, or
      // continue into the app limited (ADR-0021 / Phase 4).
      return (
        <div>
          <ResultMark kind="cross" />
          {heading("Google didn’t confirm you can connect Workspace")}
          {body("You can keep using Knohow. You can invite your Super Admin later.")}
          {choices([
            { label: "Invite someone else", onClick: onDone },
            onContinue
              ? { label: "Continue", onClick: onContinue }
              : {
                  label: "Continue to the app",
                  onClick: () => {
                    window.location.assign("/home");
                  },
                },
          ])}
        </div>
      );
    case "admin_error":
      return (
        <div>
          <ResultMark kind="cross" />
          {heading("We couldn’t check with Google")}
          {body("Nothing changed. Try again in a moment.")}
          <SetupAction label="Try again" onClick={startAdminProof} />
        </div>
      );
    case "personal":
      // One action per screen: naming the workspace is its own step, reached
      // only after "No".
      if (naming)
        return (
          <div>
            {heading("What should we call your workspace?")}
            {body("This is the name you'll see when you sign in.")}
            <ErrorTip
              message={error}
              onDismiss={() => {
                setError("");
                clearSetupFieldError(nameRef.current);
              }}
              className="mx-[2.5%] mt-6"
            >
              <SetupField
                inputRef={nameRef}
                value={orgName}
                onChange={(e) => {
                  setOrgName(e.target.value);
                  clearSetupFieldError(nameRef.current);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  submitWorkspaceName();
                }}
                placeholder="Workspace name"
                aria-label="Workspace name"
              />
            </ErrorTip>
            <SetupAction label="Continue" onClick={submitWorkspaceName} />
          </div>
        );
      return (
        <div>
          {heading("This is a personal Google account")}
          {body("Does your company use Google Workspace?")}
          {choices([
            {
              label: "Yes, link my work account",
              onClick: linkOrganizationAccount,
            },
            {
              label: "No, just me",
              onClick: () => setNaming(true),
            },
          ])}
          {errorLine}
        </div>
      );
    case "link_linked":
      return (
        <div>
          {heading("Your accounts are connected")}
          {body(
            "You can sign in with either one and land in the same place.",
          )}
          <SetupAction label="Continue" onClick={onDone} />
        </div>
      );
    case "link_already_linked":
      return (
        <div>
          <ResultMark kind="cross" />
          {heading("That account belongs to someone else")}
          {body(
            "It is already connected to a different person, so we left it alone.",
          )}
          <SetupAction label="Continue" onClick={onDone} />
        </div>
      );
    case "invite_wrong_account":
      return (
        <div>
          <ResultMark kind="cross" />
          {heading("That wasn’t the invited account")}
          {body("Sign in with the email address the invite was for.")}
          {choices([
            {
              label: "Use another account",
              onClick: signInWithAnotherAccount,
            },
          ])}
        </div>
      );
  }
}

/** Tick or X above a Google result, drawn in with the Transitions.dev success
 *  check (`.t-success-check` in globals.css). Mounts "out" and flips "in"
 *  once the card has finished growing (`--resize-dur`), so the two motions
 *  play one after the other instead of on top of each other. */
export function ResultMark({ kind }: { kind: "check" | "cross" }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), 320);
    return () => window.clearTimeout(timer);
  }, []);

  // Centred above the heading; a white tick (or X) drawn inside a filled
  // circle (user, 2026-09-27). The circle rides the wrapper's fade, rotate
  // and bob; only the <path> strokes get the draw.
  return (
    <div className="mb-8 flex justify-center">
      <span
        className="t-success-check text-[#1c1917]"
        data-state={shown ? "in" : "out"}
        aria-hidden="true"
        // Longest path in the icon, rounded up (getTotalLength).
        style={{ "--check-path-length": kind === "check" ? 27 : 20 } as React.CSSProperties}
      >
        <svg viewBox="0 0 48 48" fill="none" className="size-14">
          <circle cx="24" cy="24" r="24" fill="currentColor" />
          <g
            stroke="#fff"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {kind === "check" ? (
              <path d="M15 25l6 6 12-13" />
            ) : (
              <>
                <path d="M17 17l14 14" />
                <path d="M31 17L17 31" />
              </>
            )}
          </g>
        </svg>
      </span>
    </div>
  );
}
