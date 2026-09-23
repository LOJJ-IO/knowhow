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
 *  **A tree, not a flat list**, the same shape the picker uses: each
 *  organization holds the person's linked personal addresses beneath it,
 *  joined by one continuous trunk. The branch is not decoration — the two
 *  rows mean different things. An organization is **forgotten** on this
 *  browser; a linked address has no row of its own to forget, so it is
 *  **hidden** here instead and the link survives. Nesting is what says which
 *  is which.
 *
 *  Either way it is device-local: the member, the organization and the linked
 *  identity are untouched, and signing in again brings the row back. That is
 *  why the word is "Forget" and not "Remove".
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
        <ul
          className={`${satoshi.className} m-0 flex list-none flex-col gap-3 p-0`}
        >
          {rows.map((row) => {
            const current = row.member_id === currentMemberId;
            const children = row.linked_personal_emails.filter(
              (email) => !gone.includes(email),
            );
            return (
              <li key={row.member_id}>
                <Row
                  identity={row.email}
                  title={row.organization_name}
                  subtitle={`${row.person_name ? `${row.person_name} · ` : ""}${row.email}`}
                  action={
                    current ? (
                      <span className="shrink-0 text-[0.8125rem] text-[var(--app-dim)]">
                        Signed in
                      </span>
                    ) : (
                      <ForgetButton
                        busy={busy === row.member_id}
                        onClick={() =>
                          void forget(row.member_id, () =>
                            forgetRememberedAccounts([row.member_id]),
                          )
                        }
                      />
                    )
                  }
                />

                {children.length > 0 ? (
                  // Indented under the organization and joined to it by one
                  // continuous trunk: the spacing lives in each child's
                  // padding rather than a flex gap, so the line has nothing
                  // to jump. Children are a fixed height, so the trunk meets
                  // each row at its middle (34px = 8px padding + half of the
                  // 52px row).
                  <ul className="m-0 flex list-none flex-col p-0 pl-6">
                    {children.map((email, i) => {
                      const last = i === children.length - 1;
                      return (
                        <li key={email} className="relative pt-2">
                          {last ? (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -left-3 top-0 h-[34px] w-3 rounded-bl-[6px] border-b border-l border-[var(--app-border)]"
                            />
                          ) : (
                            <>
                              <span
                                aria-hidden
                                className="pointer-events-none absolute -left-3 top-0 bottom-0 w-px bg-[var(--app-border)]"
                              />
                              <span
                                aria-hidden
                                className="pointer-events-none absolute -left-3 top-[34px] h-px w-3 bg-[var(--app-border)]"
                              />
                            </>
                          )}
                          <Row
                            identity={email}
                            title={email}
                            subtitle="Personal · hidden here, never unlinked"
                            action={
                              <ForgetButton
                                label="Hide"
                                busy={busy === email}
                                onClick={() =>
                                  void forget(email, () =>
                                    forgetRememberedAccounts(undefined, [
                                      email,
                                    ]),
                                  )
                                }
                              />
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AppDialog>
  );
}

function Row({
  identity,
  title,
  subtitle,
  action,
}: {
  identity: string;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex h-[52px] items-center gap-3 rounded-[14px] border border-[var(--app-border)] bg-white px-3">
      <PersonAvatar identity={identity} label={title} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium text-[#1c1917]">
          {title}
        </span>
        <span className="block truncate text-[0.8125rem] text-[var(--app-dim)]">
          {subtitle}
        </span>
      </span>
      {action}
    </div>
  );
}

function ForgetButton({
  label = "Forget",
  busy,
  onClick,
}: {
  label?: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={onClick}>
      {busy ? "Working…" : label}
    </Button>
  );
}
