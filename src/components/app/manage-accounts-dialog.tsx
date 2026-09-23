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
import { cn } from "@/lib/utils";

/** "Manage accounts", from the profile menu — the same screen the Log In
 *  picker's "Remove accounts" is, brought inside the app (user 2026-09-22).
 *
 *  **Tick what to forget, then forget it once.** Per-row buttons were the
 *  first attempt and were wrong: removing three accounts meant three
 *  confirmations of a thing you had already decided.
 *
 *  **A tree, not a flat list**, and the branch carries meaning. An
 *  organization is a row this browser remembers, and ticking it takes its
 *  addresses with it. A linked personal address has no row of its own, so it
 *  is **hidden** here instead — the link survives — and it can be kept while
 *  its organization goes. Both are device-local: nothing about the member,
 *  the organization or the identity changes, and signing in again brings the
 *  row back.
 *
 *  The account you are signed in as is shown and not tickable: forgetting the
 *  session you are using is a way to confuse yourself, not a feature.
 *
 *  `size="sm"` on purpose: the Log In modal is 420px wide and tall, and this
 *  is the same screen (user 2026-09-22 — at `lg` it was a wide, short box
 *  that read as a different thing). */
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
  const [picked, setPicked] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  const has = (key: string) => picked.includes(key);

  /** Ticking an organization takes its addresses with it; unticking it
   *  releases them again. Either way the branch moves as one. */
  const toggleOrg = (row: RememberedOrg) => {
    const keys = [row.member_id, ...row.linked_personal_emails];
    setPicked((current) =>
      current.includes(row.member_id)
        ? current.filter((k) => !keys.includes(k))
        : [...current.filter((k) => !keys.includes(k)), ...keys],
    );
  };

  /** Unticking one address leaves its organization ticked: they are separate
   *  removals, so keeping an address doesn't rescue the row above it. */
  const toggleEmail = (email: string) =>
    setPicked((current) =>
      current.includes(email)
        ? current.filter((k) => k !== email)
        : [...current, email],
    );

  const memberIds = accounts
    .map((row) => row.member_id)
    .filter((id) => has(id));
  const emails = accounts
    .flatMap((row) => row.linked_personal_emails)
    .filter((email) => has(email));
  const count = memberIds.length + emails.length;

  const forget = () => {
    setWorking(true);
    void forgetRememberedAccounts(memberIds, emails).then(() => {
      setWorking(false);
      setPicked([]);
      onChanged();
      onOpenChange(false);
    });
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={count > 1 ? "Forget accounts" : "Forget an account"}
      description="Forgetting an account removes it from this browser's sign-in list. The account itself, and anything in it, is untouched."
      size="sm"
      kind="form"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={count === 0 || working} onClick={forget}>
            {working
              ? "Forgetting…"
              : count > 1
                ? `Forget ${count} accounts`
                : "Forget"}
          </Button>
        </>
      }
    >
      {accounts.length === 0 ? (
        <p
          className={`${satoshi.className} m-0 text-[0.9375rem] text-[var(--app-dim)]`}
        >
          Nothing is remembered on this browser.
        </p>
      ) : (
        <ul
          className={`${satoshi.className} m-0 flex list-none flex-col gap-0.5 p-0`}
        >
          {accounts.map((row) => {
            const current = row.member_id === currentMemberId;
            return (
              <li key={row.member_id}>
                <Row
                  checked={has(row.member_id)}
                  onToggle={current ? undefined : () => toggleOrg(row)}
                  identity={row.email}
                  title={row.organization_name}
                  subtitle={`${row.person_name ? `${row.person_name} · ` : ""}${row.email}`}
                  note={current ? "Signed in" : undefined}
                />

                {row.linked_personal_emails.length > 0 ? (
                  // Indented under the organization and joined to it by one
                  // continuous trunk: the spacing lives in each child's
                  // padding rather than a flex gap, so the line has nothing
                  // to jump. Children are a fixed height, so the trunk meets
                  // each row at its middle (28px = 2px padding + half of 52).
                  <ul className="m-0 flex list-none flex-col p-0 pl-6">
                    {row.linked_personal_emails.map((email, i) => {
                      const last = i === row.linked_personal_emails.length - 1;
                      return (
                        <li key={email} className="relative pt-0.5">
                          {last ? (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -left-3 top-0 h-[28px] w-3 rounded-bl-[6px] border-b border-l border-[var(--app-border)]"
                            />
                          ) : (
                            <>
                              <span
                                aria-hidden
                                className="pointer-events-none absolute -left-3 top-0 bottom-0 w-px bg-[var(--app-border)]"
                              />
                              <span
                                aria-hidden
                                className="pointer-events-none absolute -left-3 top-[28px] h-px w-3 bg-[var(--app-border)]"
                              />
                            </>
                          )}
                          <Row
                            checked={has(email)}
                            onToggle={() => toggleEmail(email)}
                            identity={email}
                            title={email}
                            subtitle="Personal · hidden here, never unlinked"
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
  checked,
  onToggle,
  identity,
  title,
  subtitle,
  note,
}: {
  checked: boolean;
  /** Absent for a row that can't be ticked — the session you are using. */
  onToggle?: () => void;
  identity: string;
  title: string;
  subtitle: string;
  note?: string;
}) {
  const body = (
    <>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle?.()}
        disabled={!onToggle}
        aria-label={`Forget ${title}`}
        className="size-4 shrink-0 accent-[#1c1917] disabled:opacity-40"
      />
      <PersonAvatar identity={identity} label={title} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium text-[#1c1917]">
          {title}
        </span>
        <span className="block truncate text-[0.8125rem] text-[var(--app-dim)]">
          {subtitle}
        </span>
      </span>
      {note ? (
        <span className="shrink-0 text-[0.8125rem] text-[var(--app-dim)]">
          {note}
        </span>
      ) : null}
    </>
  );

  // No outline and no white card (user 2026-09-22, matching the reference):
  // the rows sit straight on the dialog's surface. What marks a row as picked
  // is the tick and a quiet fill — a border around every row turned a list
  // into a stack of boxes, and fought the branch lines that are the only
  // structure here that means anything.
  const className = cn(
    "flex h-[52px] items-center gap-3 rounded-[14px] px-3 transition-colors",
    checked ? "bg-[var(--app-active)]" : "bg-transparent",
    onToggle ? "cursor-pointer hover:bg-[var(--app-muted)]" : "cursor-default",
  );

  return onToggle ? (
    <label className={className}>{body}</label>
  ) : (
    <div className={className}>{body}</div>
  );
}
