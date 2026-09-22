"use client";

import { useEffect, useRef, useState } from "react";

import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import {
  BACKEND_API_URL,
  backendError,
  backendFetch,
  startAdminProof,
} from "@/lib/backend";
import { SETUP_CHOICE_CLASS } from "./shell";

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
}: {
  result: SignInResult;
  /** Closes the sheet. */
  onDone: () => void;
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
    } finally {
      setSubmitting(false);
    }
  }

  // "done" — the signed-in screen isn't designed yet (user will describe it).
  if (done) return null;

  const heading = (text: string) => (
    <h2
      className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
    >
      {text}
    </h2>
  );
  const body = (text: string) => (
    <p
      className={`${sohne.className} mt-6 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
    >
      {text}
    </p>
  );
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
          {b.label}
        </button>
      ))}
    </div>
  );
  const errorLine = error ? (
    <p
      aria-live="polite"
      className={`${satoshi.className} m-0 mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
    >
      {error}
    </p>
  ) : null;

  switch (result) {
    case "admin_verified":
      return (
        <div>
          {heading("You’re verified as a Google Workspace Super Admin")}
          {body("Google confirmed it. Your organization’s domain is now verified.")}
        </div>
      );
    case "admin_not_verified":
      // One action per screen (user): inviting the Super Admin happens later
      // in the app, not here.
      return (
        <div>
          {heading("Google didn’t confirm you as a Super Admin")}
          {body("You can keep using Knohow. You can invite your Super Admin later.")}
          {choices([{ label: "Skip for now", onClick: onDone }])}
        </div>
      );
    case "admin_error":
      return (
        <div>
          {heading("We couldn’t check with Google")}
          {body("Nothing changed. Try again in a moment.")}
          {choices([{ label: "Try again", onClick: startAdminProof }])}
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
            <input
              ref={nameRef}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && orgName.trim()) void createPersonalOrg();
              }}
              placeholder="Workspace name"
              aria-label="Workspace name"
              className={`${satoshi.className} mt-8 h-12 w-full rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white px-4 text-[1rem] text-[#1c1917] outline-none placeholder:text-[#1c1917]/40`}
            />
            <div className={`${satoshi.className} mt-3 flex flex-col gap-3`}>
              <button
                type="button"
                disabled={submitting || !orgName.trim()}
                className={SETUP_CHOICE_CLASS}
                onClick={() => void createPersonalOrg()}
              >
                Continue
              </button>
            </div>
            {errorLine}
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
          {choices([{ label: "Continue", onClick: onDone }])}
        </div>
      );
    case "link_already_linked":
      return (
        <div>
          {heading("That account belongs to someone else")}
          {body(
            "It is already connected to a different person, so we left it alone.",
          )}
          {choices([{ label: "Continue", onClick: onDone }])}
        </div>
      );
    case "invite_wrong_account":
      return (
        <div>
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
