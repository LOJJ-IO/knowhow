"use client";

import { useEffect, useRef, useState } from "react";
import {
  SetupAction,
  SetupBody,
  SetupError,
  SetupField,
  SetupHeading,
  clearSetupFieldError,
  shakeSetupField,
} from "./shell";
import { backendError, backendFetch, type Me } from "@/lib/backend";

/** A Workspace org is created with its hosted domain as its name, because at
 *  that moment nobody has been asked. `acme.org` is a placeholder; this turns
 *  it into the guess a founder is most likely to accept. */
export function suggestOrgName(me: Me): string {
  const domain = me.organization_domain;
  // Already named by a human (or a personal org, named at creation).
  if (!domain || me.organization_name.toLowerCase() !== domain.toLowerCase())
    return me.organization_name;
  return domain
    .split(".")[0]
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** "What's your organization called?" — the first screen of setup proper.
 *
 *  Everything downstream reads this name: the invite link's sign-in screen,
 *  the "already with {OtherOrg}" refusal, and the Log In account picker. Left
 *  unasked it would read `acme.org` in all three. */
export function OrgNameStep({
  me,
  onDone,
}: {
  me: Me;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState(() => suggestOrgName(me));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // The guess is a suggestion, not an answer: selecting it means one
    // keystroke replaces it for anyone whose name isn't their domain.
    input.select();
  }, []);

  async function submit() {
    const trimmed = name.trim();
    if (submitting) return;
    if (!trimmed) {
      shakeSetupField(inputRef.current);
      setError("Enter an organization name.");
      return;
    }
    clearSetupFieldError(inputRef.current);
    setSubmitting(true);
    setError("");
    try {
      const res = await backendFetch(`/organizations/${me.organization_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(await backendError(res));
      const org = await res.json();
      onDone(org.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <SetupHeading>What&rsquo;s your organization called?</SetupHeading>
      <SetupBody>This is the name your team sees when they join.</SetupBody>
      <div className="mt-6">
        <SetupField
          inputRef={inputRef}
          aria-label="Organization name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearSetupFieldError(inputRef.current);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Enter is the field's commit, and this screen's commit happens
            // to be the same thing. It still goes through one path.
            e.preventDefault();
            void submit();
          }}
        />
      </div>
      <SetupError>{error}</SetupError>
      <SetupAction label="Continue" onClick={() => void submit()} />
    </div>
  );
}
