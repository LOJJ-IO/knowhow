"use client";

import { useState } from "react";

import { Button } from "@/components/app/button";
import { AppDialog } from "@/components/app/dialog";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { satoshi } from "@/components/brand/fonts";
import {
  forgetRememberedAccounts,
  type RememberedOrg,
} from "@/lib/remembered-accounts";

/** "Manage accounts", from the profile menu — the in-app half of the Log In
 *  picker's "Remove accounts" screen (user 2026-09-22).
 *
 *  **Forgetting is a device-local act.** It removes the row from this browser:
 *  the member, the organization and the linked identity are untouched, and
 *  signing in again brings the row straight back. That is why the word here is
 *  "Forget" and not "Remove", and why a linked personal address (which has no
 *  row of its own) is hidden rather than unlinked — the same rule the sign-in
 *  screen follows.
 *
 *  The account you are signed in as isn't offered: forgetting the session you
 *  are using is a way to confuse yourself, not a feature. Log out first. */
export function ManageAccountsDialog({
  open,
  onOpenChange,
  accounts,
  currentMemberId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: RememberedOrg[];
  currentMemberId: string;
  /** The list this dialog was handed is now stale. */
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);

  const forget = async (key: string, run: () => Promise<void>) => {
    setBusy(key);
    await run();
    setGone((current) => [...current, key]);
    setBusy(null);
    onChanged();
  };

  const rows = accounts.filter((row) => !gone.includes(row.member_id));

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Accounts on this browser"
      description="Forgetting an account removes it from this browser's sign-in list. The account itself, and anything in it, is untouched."
      size="lg"
      kind="form"
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p
          className={`${satoshi.className} m-0 text-[0.9375rem] text-[var(--app-dim)]`}
        >
          Nothing else is remembered here.
        </p>
      ) : (
        <ul className={`${satoshi.className} m-0 flex list-none flex-col p-0`}>
          {rows.map((row) => {
            const current = row.member_id === currentMemberId;
            return (
              <li
                key={row.member_id}
                className="flex items-center gap-3 border-b border-[var(--app-border)] py-3 last:border-0"
              >
                <PersonAvatar
                  identity={row.email}
                  label={row.person_name ?? row.email}
                  size={36}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium text-[#1c1917]">
                    {row.organization_name}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-[var(--app-dim)]">
                    {row.person_name ? `${row.person_name} · ` : ""}
                    {row.email}
                    {row.linked_personal_emails.length
                      ? ` · ${row.linked_personal_emails.length} personal`
                      : ""}
                  </span>
                </span>
                {current ? (
                  <span className="shrink-0 text-[0.8125rem] text-[var(--app-dim)]">
                    Signed in
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === row.member_id}
                    onClick={() =>
                      void forget(row.member_id, () =>
                        forgetRememberedAccounts([row.member_id]),
                      )
                    }
                  >
                    {busy === row.member_id ? "Forgetting…" : "Forget"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppDialog>
  );
}
