"use client";

import { useEffect, useRef, useState } from "react";

import { FormDialog, MODAL_SWAP_MS } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { ErrorTip } from "@/components/brand/tooltip";
import {
  SetupField,
  clearSetupFieldError,
  shakeSetupField,
} from "@/components/setup/shell";
import { backendError, backendFetch } from "@/lib/backend";
import { emailError } from "@/lib/email";

/** Invite whoever holds a seat nobody has yet: the owner (from the empty
 *  owner card or its task) or the Google Workspace Super Admin (from its
 *  task). The same nomination setup sends; they confirm by signing in.
 *  `size="sm"`, the Accounts dialog's shape (user 2026-09-27). */
const COPY = {
  owner: {
    title: "Invite the owner",
    label: "Owner’s work email",
  },
  super_admin: {
    title: "Invite your Super Admin",
    label: "Their work email",
  },
} as const;

/** Book a Demo's `--revert-hold`. */
const ERROR_HOLD_MS = 3000;

export function InviteDialog({
  kind,
  open,
  onOpenChange,
  swap,
}: {
  kind: keyof typeof COPY;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opened or closed as part of a dialog swap (no backdrop flash). */
  swap?: boolean;
}) {
  const { chrome } = useSession();
  const { refresh } = useUpdates();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const copy = COPY[kind];

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  // Focus the field once the dialog has finished opening, not on its first
  // frame: an instant black border and caret made this open feel snappier
  // than the other dialogs (user 2026-09-29).
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(
      () => inputRef.current?.focus(),
      MODAL_SWAP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  function clearError() {
    window.clearTimeout(holdTimer.current);
    setError("");
    clearSetupFieldError(inputRef.current);
  }

  /** Book a Demo's error: red + shake, then border and tooltip fade back
   *  after the same 3s hold. */
  function flagError(message: string) {
    setError(message);
    shakeSetupField(inputRef.current);
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(clearError, ERROR_HOLD_MS);
  }

  return (
    <FormDialog
      swap={swap}
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) clearError();
      }}
      title={copy.title}
      size="sm"
      submitLabel="Send invite"
      busy={busy}
      disabled={!email.trim()}
      onSubmit={async (event) => {
        event.preventDefault();
        const problem = emailError(email);
        if (problem) {
          flagError(problem);
          return;
        }
        setBusy(true);
        clearError();
        try {
          const res = await backendFetch(
            `/organizations/${chrome.organizationId}/invitations`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, email: email.trim() }),
            },
          );
          if (!res.ok) throw new Error(await backendError(res));
          setEmail("");
          onOpenChange(false);
          refresh();
        } catch (e) {
          flagError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {/* A little air above the label and below the field (user 2026-09-27).
          The field is Book a Demo's (via SetupField): red border that fades
          back, and a shake on every failed submit. */}
      <label className={`${satoshi.className} flex flex-col gap-1.5 py-2`}>
        <span className="text-[0.875rem] text-[#1c1917]">{copy.label}</span>
        <ErrorTip
          message={error}
          onDismiss={clearError}
        >
          <SetupField
            inputRef={inputRef}
            type="email"
            className="rounded-[10px]"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
          />
        </ErrorTip>
      </label>
    </FormDialog>
  );
}
