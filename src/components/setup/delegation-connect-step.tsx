"use client";

import { useEffect, useRef, useState } from "react";
import {
  SETUP_CHOICE_CLASS,
  SetupAction,
  SetupBody,
  SetupChoices,
  SetupError,
  SetupHeading,
} from "./shell";
import { backendError, backendFetch, type Me } from "@/lib/backend";
import { CopyField } from "@/components/ui/copy-field";
import { GoogleWord } from "@/components/brand/google-word";
import { GoogleG } from "@/components/ui/icons";

type SetupGuide = {
  client_id: string;
  scopes: string[];
  scopes_csv: string;
  admin_console_url: string;
  status: string;
  missing_scopes: string[];
};

type StepError = { title: string; items?: string[]; detail?: string };

const SCOPE_LABELS: Record<string, string> = {
  "https://www.googleapis.com/auth/drive": "Google Drive",
  "https://www.googleapis.com/auth/admin.reports.audit.readonly":
    "Drive activity reports (read-only)",
};

function scopeLabel(scope: string) {
  return (
    SCOPE_LABELS[scope] ??
    scope.replace("https://www.googleapis.com/auth/", "")
  );
}

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
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
  const [error, setError] = useState<StepError | null>(null);
  const [openedAdmin, setOpenedAdmin] = useState(false);
  const checkingRef = useRef(false);
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
        if (!cancelled)
          setError({
            title: "Couldn’t load the Google Admin steps.",
            detail: message(e),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.organization_id]);

  async function checkNow() {
    if (checkingRef.current) return;
    checkingRef.current = true;
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
        setError(null);
        setPhase("connected");
        window.setTimeout(() => onDoneRef.current(), 1500);
        return;
      }
      if (body.missing_scopes?.length) {
        setError({
          title: "Google authorized some of Knohow, but not all of it.",
          items: body.missing_scopes.map(scopeLabel),
          detail: "Open Google Admin again and click Authorize.",
        });
      } else {
        setError({
          title: "Google hasn’t authorized Knohow yet.",
          detail:
            "Click Authorize in Google Admin and we’ll check again when you’re back.",
        });
      }
    } catch (e) {
      setError({ title: "Couldn’t check with Google.", detail: message(e) });
    } finally {
      checkingRef.current = false;
    }
  }
  const checkNowRef = useRef(checkNow);
  useEffect(() => {
    checkNowRef.current = checkNow;
  });

  // After they open Google Admin, check each time they come back to this tab
  // instead of asking them to press a button.
  useEffect(() => {
    if (!openedAdmin || phase !== "guide") return;
    const onReturn = () => {
      if (document.visibilityState === "visible") void checkNowRef.current();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [openedAdmin, phase]);

  if (phase === "connected")
    return (
      <div>
        <SetupHeading>
          Knohow is connected to <GoogleWord />.
        </SetupHeading>
        <SetupBody>Taking you to the app…</SetupBody>
      </div>
    );

  // Nothing until we know whether there's anything to do: an org that's
  // already connected skips this step, and shouldn't flash it first.
  if (!guide && !error) return null;

  return (
    <div>
      <SetupHeading>
        Connect Knohow to <GoogleWord />.
      </SetupHeading>
      <SetupBody>
        Click <span className="font-semibold">Open Google Admin</span>.
        Everything&rsquo;s filled in, so just click{" "}
        <span className="font-semibold">Authorize</span>. When you come back,
        we&rsquo;ll check automatically.
      </SetupBody>

      {guide ? (
        <div className="mx-[2.5%] mt-6 flex flex-col gap-3">
          <CopyField label="Client ID" value={guide.client_id} />
          <CopyField label="OAuth scopes" value={guide.scopes_csv} multiline />
        </div>
      ) : null}

      {error ? (
        <SetupError title={error.title} items={error.items}>
          {error.detail}
        </SetupError>
      ) : null}

      <SetupChoices>
        <button type="button" className={SETUP_CHOICE_CLASS} onClick={onDone}>
          Skip for now
        </button>
      </SetupChoices>
      <SetupAction
        label="Open Google Admin"
        icon={<GoogleG className="size-5 shrink-0" />}
        onClick={() => {
          if (!guide?.admin_console_url) return;
          setOpenedAdmin(true);
          window.open(guide.admin_console_url, "_blank", "noopener,noreferrer");
        }}
      />
    </div>
  );
}
