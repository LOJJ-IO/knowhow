"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  SETUP_CHOICE_CLASS,
  SetupBody,
  SetupChoices,
  SetupError,
  SetupHeading,
} from "./shell";
import { backendError, backendFetch, type Me } from "@/lib/backend";
import { satoshi } from "@/components/brand/fonts";

type SetupGuide = {
  client_id: string;
  scopes: string[];
  scopes_csv: string;
  admin_console_url: string;
  status: string;
  missing_scopes: string[];
};

/** A read-only field with its copy control inside it as an icon. Copies with
 *  the clipboard API and falls back to selecting the text and `execCommand`,
 *  and says so (icon turns into a check) so a failed copy is never silent. */
function CopyField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      const el = fieldRef.current;
      if (el) {
        el.focus();
        el.select();
        try {
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        }
      }
    }
    setFailed(!ok);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1500);
  }

  const fieldClass = `${satoshi.className} w-full min-w-0 rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white pl-3 pr-11 text-[0.8rem] text-[#1c1917]/80 outline-none`;
  return (
    <div className={`${satoshi.className} flex flex-col gap-1.5`}>
      <span className="text-[0.75rem] font-medium text-[#1c1917]/70">
        {label}
      </span>
      <div className="relative">
        {multiline ? (
          <textarea
            ref={fieldRef}
            readOnly
            value={value}
            aria-label={label}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className={`${fieldClass} resize-none py-2 leading-[1.4]`}
          />
        ) : (
          <input
            ref={fieldRef}
            readOnly
            value={value}
            aria-label={label}
            onFocus={(e) => e.currentTarget.select()}
            className={`${fieldClass} h-10`}
          />
        )}
        <button
          type="button"
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
          title={failed ? "Couldn’t copy. Select the text and copy it." : "Copy"}
          onClick={() => void copy()}
          className="absolute top-1.5 right-1.5 flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-[#1c1917]/70 outline-none hover:bg-black/5 hover:text-[#1c1917] focus-visible:outline-2 focus-visible:outline-[#1c1917] active:translate-y-px"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );
}

/** After Super Admin proof: paste client ID + scopes into Google Admin,
 *  then we check whether domain-wide delegation works (FEAT / ADR-0021). */
export function DelegationConnectStep({
  me,
  onDone,
}: {
  me: Me;
  onDone: () => void;
}) {
  const [guide, setGuide] = useState<SetupGuide | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState<"guide" | "connected">("guide");
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await backendFetch(
          `/organizations/${me.organization_id}/delegation/setup`,
        );
        if (!res.ok) throw new Error(await backendError(res));
        const body = (await res.json()) as SetupGuide;
        if (cancelled) return;
        // Already connected: nothing to do here, so don't stop on a screen
        // that only repeats "You're verified" (user, 2026-09-27). Move on.
        if (body.status === "approved") {
          onDoneRef.current();
          return;
        }
        setGuide(body);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.organization_id]);

  async function checkNow() {
    if (checking) return;
    setChecking(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${me.organization_id}/delegation/check`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await backendError(res));
      const body = (await res.json()) as {
        status: string;
        missing_scopes: string[];
      };
      setGuide((g) =>
        g
          ? { ...g, status: body.status, missing_scopes: body.missing_scopes }
          : g,
      );
      if (body.status === "approved") {
        setPhase("connected");
        window.setTimeout(onDone, 1500);
        return;
      }
      if (body.missing_scopes?.length) {
        setError(
          `Still missing scopes: ${body.missing_scopes.join(", ")}. Add them in Admin and try again.`,
        );
      } else {
        setError(
          "Google hasn’t authorized Knohow yet. Finish the Admin console step, then check again.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }

  if (phase === "connected")
    return (
      <div>
        <SetupHeading>Knohow is connected to Google.</SetupHeading>
        <SetupBody>Taking you to the app…</SetupBody>
      </div>
    );

  // Nothing until we know whether there's anything to do: an org that's
  // already connected skips this step, and shouldn't flash it first.
  if (!guide && !error) return null;

  return (
    <div>
      <SetupHeading>Connect Knohow to Google.</SetupHeading>
      <SetupBody>
        In Google Admin, open{" "}
        <span className="font-semibold">Domain-wide delegation</span> and
        click <span className="font-semibold">Add new</span>. Paste the client
        ID and scopes below, then click{" "}
        <span className="font-semibold">Authorize</span>. When you&rsquo;re
        done, we&rsquo;ll check.
      </SetupBody>

      {guide ? (
        <div className="mt-6 flex flex-col gap-3">
          <CopyField label="Client ID" value={guide.client_id} />
          <CopyField label="OAuth scopes" value={guide.scopes_csv} multiline />
        </div>
      ) : null}

      <SetupError>{error}</SetupError>

      <SetupChoices>
        <button
          type="button"
          className={SETUP_CHOICE_CLASS}
          onClick={() => {
            if (guide?.admin_console_url)
              window.open(guide.admin_console_url, "_blank", "noopener,noreferrer");
          }}
        >
          Open Google Admin
        </button>
        <button
          type="button"
          className={SETUP_CHOICE_CLASS}
          disabled={checking}
          onClick={() => void checkNow()}
        >
          {checking ? "Checking…" : "I’ve added it, check now"}
        </button>
        <button type="button" className={SETUP_CHOICE_CLASS} onClick={onDone}>
          Skip for now
        </button>
      </SetupChoices>
    </div>
  );
}
