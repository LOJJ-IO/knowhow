"use client";

import { useState } from "react";
import {
  SetupAction,
  SetupBody,
  SetupError,
  SetupField,
  SetupHeading,
} from "./shell";
import { SetupShareAction } from "./setup-share-action";
import { ChoicePill } from "@/components/ui/choice-pill";
import { backendError, backendFetch, type Me } from "@/lib/backend";

type LinkPhase = "offer" | "lifetime" | "ready";

const LIFETIMES = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "forever", label: "No end date" },
];

/** The one link setup sends out: offer it, choose how long it lasts, hand it
 *  over. Three screens, because each asks for a separate decision. */
export function InviteLinkStep({
  me,
  onDone,
}: {
  me: Me;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<LinkPhase>("offer");
  // Pre-picked so the button is never dead and nothing is ever greyed out.
  // The owner still chooses.
  const [lifetime, setLifetime] = useState("7d");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const domain = me.organization_domain;

  if (phase === "offer")
    return (
      <div>
        <SetupHeading>Ready to bring everyone in?</SetupHeading>
        <SetupBody>
          {domain
            ? `One link works for everyone at ${domain}. They pick their team, you approve.`
            : "One link works for everyone. They pick their team, you approve."}
        </SetupBody>
        <SetupAction
          label="Create invite link"
          onClick={() => setPhase("lifetime")}
        />
      </div>
    );

  if (phase === "lifetime")
    return (
      <div>
        <SetupHeading>How long should the link work?</SetupHeading>
        <SetupBody>You can turn it off at any time.</SetupBody>
        <div className="mt-6 flex flex-wrap items-center gap-1.5">
          {LIFETIMES.map((option) => (
            <ChoicePill
              key={option.value}
              label={option.label}
              selected={lifetime === option.value}
              onClick={() => {
                setLifetime(option.value);
                setError("");
              }}
            />
          ))}
        </div>
        <SetupError>{error}</SetupError>
        <SetupAction
          label="Continue"
          onClick={() => {
            if (busy) return;
            setBusy(true);
            setError("");
            void (async () => {
              try {
                const res = await backendFetch(
                  `/organizations/${me.organization_id}/join-link`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lifetime }),
                  },
                );
                if (!res.ok) throw new Error(await backendError(res));
                const link = await res.json();
                setUrl(link.url);
                setPhase("ready");
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      </div>
    );

  return (
    <div>
      <SetupHeading>Your link is ready.</SetupHeading>
      <SetupBody>
        {domain
          ? `Anyone with a ${domain} account can use it. Everyone else is turned away.`
          : "Anyone you send it to can use it."}
      </SetupBody>
      {/* A field, not a second line of body copy. */}
      <div className="mt-6">
        <SetupField
          readOnly
          value={url}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
          className="text-[0.85rem] text-[#1c1917]/70"
        />
      </div>
      <SetupError>{error}</SetupError>
      {/* Copy is this screen's one action, and it's also what finishes
          setup — there is nothing left to decide after it. */}
      <SetupShareAction
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            /* still show Copied — the URL is in the field to select */
          }
          window.setTimeout(onDone, 600);
        }}
      />
    </div>
  );
}
