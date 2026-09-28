"use client";

import { useState } from "react";

import { FormDialog } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { ErrorTip } from "@/components/brand/tooltip";
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

export function InviteDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: keyof typeof COPY;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { chrome } = useSession();
  const { refresh } = useUpdates();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = COPY[kind];

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError("");
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
          setError(problem);
          return;
        }
        setBusy(true);
        setError("");
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
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {/* A little air above the label and below the field (user 2026-09-27). */}
      <label className={`${satoshi.className} flex flex-col gap-1.5 py-2`}>
        <span className="text-[0.875rem] text-[#1c1917]">{copy.label}</span>
        <ErrorTip message={error} onDismiss={() => setError("")}>
          <input
            type="email"
            autoFocus
            aria-invalid={error ? true : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            className="h-10 w-full rounded-[10px] border border-[var(--app-border)] bg-white px-3 text-[0.9375rem] text-[#1c1917] outline-none focus:border-[#1c1917] aria-invalid:border-[#EA4335]"
          />
        </ErrorTip>
      </label>
    </FormDialog>
  );
}
