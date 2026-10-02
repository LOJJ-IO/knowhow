"use client";

import { useEffect, useRef, useState } from "react";

import { FormDialog, MODAL_SWAP_MS } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { ErrorTip } from "@/components/brand/tooltip";
import { TeamIcon } from "@/components/identity/team-icon";
import {
  SetupField,
  clearSetupFieldError,
  shakeSetupField,
} from "@/components/setup/shell";
import { backendError, backendFetch } from "@/lib/backend";

/** Book a Demo's `--revert-hold`. */
const ERROR_HOLD_MS = 3000;

/** Manage teams' New team (user 2026-09-27): one name field, built like the
 *  invite dialog (same shape, same field and error behaviour). */
export function NewTeamDialog({
  open,
  onOpenChange,
  swap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opened or closed as part of a dialog swap (no backdrop flash). */
  swap?: boolean;
}) {
  const { chrome } = useSession();
  const { refresh } = useUpdates();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const holdTimer = useRef<number | undefined>(undefined);

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
      title="New team"
      size="sm"
      submitLabel="Create team"
      busy={busy}
      disabled={!name.trim()}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        clearError();
        try {
          const res = await backendFetch(
            `/organizations/${chrome.organizationId}/teams`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: name.trim() }),
            },
          );
          if (!res.ok) throw new Error(await backendError(res));
          setName("");
          onOpenChange(false);
          refresh();
        } catch (e) {
          flagError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className={`${satoshi.className} flex flex-col gap-1.5 py-2`}>
        <span className="text-[0.875rem] text-[#1c1917]">Team name</span>
        {/* The team's icon beside the field, seeded from the name as it's
            typed, like setup's team naming (user 2026-09-27). */}
        <span className="flex items-center gap-2.5">
          {name.trim() ? (
            <TeamIcon name={name} size={40} />
          ) : (
            <span
              aria-hidden
              className="size-10 shrink-0 rounded-full border border-dashed border-[#d9d9de]"
            />
          )}
          <ErrorTip
            message={error}
            onDismiss={clearError}
            className="min-w-0 flex-1"
          >
            <SetupField
              inputRef={inputRef}
                className="rounded-[10px]"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError();
              }}
            />
          </ErrorTip>
        </span>
      </label>
    </FormDialog>
  );
}
