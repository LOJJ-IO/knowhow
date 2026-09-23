"use client";

import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  AddAccountIcon,
  CaretIcon,
  LogOutIcon,
  ManageAccountsIcon,
  MorphIcon,
  SettingsIcon,
} from "@/components/app/nav-morph";
import { useSession } from "@/components/app/session";
import { ManageAccountsDialog } from "@/components/app/manage-accounts-dialog";
import { SettingsDialog } from "@/components/app/settings-dialog";
import { satoshi } from "@/components/brand/fonts";
import { PersonAvatar } from "@/components/identity/person-avatar";
import {
  addAnotherAccount,
  continueWithGoogle,
  fetchRememberedOrgs,
  logOut,
  switchToAccount,
  type RememberedOrg,
} from "@/lib/remembered-accounts";
import { cn } from "@/lib/utils";

/** What the topbar's profile chip opens: who you are, then the few things
 *  that are about *you* rather than about the organization (user 2026-09-22,
 *  from a reference menu).
 *
 *  It holds **only what exists**. The reference had teams, themes, plans,
 *  purchase history and a desktop app; Knohow has an account, Settings (moved
 *  here out of the sidebar) and a way out. A menu that lists things the
 *  product can't do is a menu of dead ends.
 *
 *  Anchored under the chip and aligned to its right edge, so it opens to the
 *  left of the button rather than off the side of the window. */
export function ProfileMenu({ children }: { children: ReactNode }) {
  const { me, chrome } = useSession();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  /** The accounts this browser has signed in with, the same list the Log In
   *  picker shows. Fetched once the menu is opened, not on every page load —
   *  nothing needs it until someone goes looking for another account. */
  const [accounts, setAccounts] = useState<RememberedOrg[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || accounts) return;
    let cancelled = false;
    void fetchRememberedOrgs().then((rows) => {
      if (!cancelled) setAccounts(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, accounts]);
  /** Which row the pointer is on, so Settings can keep the gear turn it had
   *  in the sidebar (user 2026-09-22). */
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      <Menu.Root open={open} onOpenChange={setOpen}>
        <Menu.Trigger render={children as React.ReactElement} />
        <Menu.Portal>
          <Menu.Positioner
            side="bottom"
            align="end"
            sideOffset={8}
            className={LAYER}
          >
            <Menu.Popup className={cn(satoshi.className, POPUP)}>
              <Menu.Group>
                <Menu.GroupLabel className={LABEL}>Accounts</Menu.GroupLabel>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger
                    onMouseEnter={() => setHovered("accounts")}
                    onMouseLeave={() => setHovered(null)}
                    className="mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 outline-none select-none data-[highlighted]:bg-[var(--app-muted)] data-[popup-open]:bg-[var(--app-muted)]"
                  >
                    <PersonAvatar
                      identity={chrome.viewer.email}
                      label={chrome.viewer.name}
                      size={40}
                    />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[0.9375rem] font-medium text-[#1c1917]">
                        {chrome.viewer.name}
                      </span>
                      <span className="block truncate text-[0.8125rem] text-[var(--app-dim)]">
                        {me.email}
                      </span>
                    </span>
                    <CaretIcon open={hovered === "accounts"} direction="left" />
                  </Menu.SubmenuTrigger>

                  <Menu.Portal>
                    <Menu.Positioner
                      side="left"
                      align="start"
                      sideOffset={8}
                      className={LAYER}
                    >
                      <Menu.Popup className={cn(satoshi.className, POPUP)}>
                        <Menu.GroupLabel className={LABEL}>
                          Switch accounts
                        </Menu.GroupLabel>

                        {accounts === null ? (
                          <p className="m-0 px-4 py-3 text-[0.875rem] text-[var(--app-dim)]">
                            Looking…
                          </p>
                        ) : accounts.length === 0 ? (
                          <p className="m-0 px-4 py-3 text-[0.875rem] text-[var(--app-dim)]">
                            No other accounts on this browser.
                          </p>
                        ) : (
                          accounts.map((row) => (
                            <div key={row.member_id}>
                              <AccountRow
                                memberId={row.member_id}
                                name={row.person_name ?? row.organization_name}
                                email={row.email}
                                chip={row.kind === "org" ? "Org" : "Personal"}
                                current={row.member_id === me.id}
                              />

                              {/* A linked personal address has no row of its
                                  own in the backend's list — it is carried on
                                  the person's org row — so it **branches**
                                  under it, the way the Log In picker and
                                  Manage accounts draw the same relationship
                                  (user 2026-09-22). The trunk is the point:
                                  these addresses belong to that person, they
                                  are not separate organizations. */}
                              {row.linked_personal_emails.length > 0 ? (
                                <div className="pl-7">
                                  {row.linked_personal_emails.map(
                                    (email, i) => {
                                      const last =
                                        i ===
                                        row.linked_personal_emails.length - 1;
                                      return (
                                        <div
                                          key={email}
                                          className="relative pt-0.5"
                                        >
                                          {last ? (
                                            <span
                                              aria-hidden
                                              className="pointer-events-none absolute -left-2 top-0 h-[29px] w-3 rounded-bl-[6px] border-b border-l border-[var(--app-border)]"
                                            />
                                          ) : (
                                            <>
                                              <span
                                                aria-hidden
                                                className="pointer-events-none absolute -left-2 top-0 bottom-0 w-px bg-[var(--app-border)]"
                                              />
                                              <span
                                                aria-hidden
                                                className="pointer-events-none absolute -left-2 top-[29px] h-px w-3 bg-[var(--app-border)]"
                                              />
                                            </>
                                          )}
                                          <AccountRow
                                            name={row.person_name ?? "Personal"}
                                            email={email}
                                            chip="Personal"
                                            current={email === me.email}
                                            nested
                                          />
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}

                        <Divider />

                        <Item
                          icon={<AddAccountIcon open={hovered === "add"} />}
                          onHover={setHovered}
                          hoverKey="add"
                          onClick={() => addAnotherAccount()}
                        >
                          Add another account
                        </Item>
                        <Item
                          icon={
                            <ManageAccountsIcon open={hovered === "manage"} />
                          }
                          onHover={setHovered}
                          hoverKey="manage"
                          onClick={() => setManageOpen(true)}
                        >
                          Manage accounts
                        </Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Group>

              <Divider />

              <Item
                onHover={setHovered}
                hoverKey="settings"
                icon={<SettingsIcon open={hovered === "settings"} size={20} />}
                onClick={() => setSettingsOpen(true)}
              >
                Settings
              </Item>

              {/* A route, so a link item: it opens a page, and it should
                  behave like one (new tab, copy address). Keeps the icon it
                  has in the sidebar, morph and all. */}
              <Menu.LinkItem
                render={<Link href="/help" />}
                onMouseEnter={() => setHovered("help")}
                onMouseLeave={() => setHovered(null)}
                className={ITEM}
              >
                <MorphIcon href="/help" open={hovered === "help"} size={20} />
                Help
              </Menu.LinkItem>

              <Divider />

              {/* "Log out of all accounts" only when there is more than one
                  (user 2026-09-22). One session is active at a time, so with a
                  single account the plural would be describing a situation the
                  person isn't in. The action is the same either way: the
                  backend clears this session's cookies. */}
              <Item
                icon={<LogOutIcon open={hovered === "log-out"} size={20} />}
                onHover={setHovered}
                hoverKey="log-out"
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  void logOut().then(() => router.replace("/"));
                }}
              >
                {leaving
                  ? "Logging out…"
                  : signedInCount(accounts) > 1
                    ? "Log out of all accounts"
                    : "Log out"}
              </Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ManageAccountsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        accounts={accounts ?? []}
        currentMemberId={me.id}
        onChanged={() => setAccounts(null)}
      />
    </>
  );
}

/** The popup's own look. Motion is `app-modal` (globals.css) and the layer is
 *  on the positioner — a portalled popup whose positioner has no z-index lands
 *  in the body's default layer, where the page can paint over it (user
 *  2026-09-22: "the z index is all wrong"). */
const POPUP =
  "app-modal w-[20rem] rounded-[16px] bg-white py-1 shadow-[0_18px_50px_rgba(0,0,0,0.16),0_0_0_1px_var(--app-border)] outline-none";

/** Menus sit under dialogs (500) and tooltips (600). */
const LAYER = "isolate z-[450]";

const LABEL = "px-4 pt-3 pb-1 text-[0.8125rem] text-[var(--app-dim)]";

/** One remembered account. Switching is a **sign-in**, not a local flip:
 *  Google decides who you are, the address only pre-selects the account there
 *  (the same rule the Log In picker follows). Signing in to the one you are
 *  already in would be a no-op, so it is marked and inert. */
function AccountRow({
  memberId,
  name,
  email,
  chip,
  current,
  nested = false,
}: {
  /** Present for an account with a row of its own. A linked personal address
   *  has none — it is carried on someone's org row — so it has nothing to
   *  switch *to* and still goes through Google. */
  memberId?: string;
  name: string;
  email: string;
  /** Which kind of account this row signs in with — the Log In picker's own
   *  chip, brought across so a row reads the same on both sides of sign-in
   *  (user 2026-09-22). */
  chip?: string;
  current: boolean;
  /** A linked address hanging off an organization's row. */
  nested?: boolean;
}) {
  const body = (
    <>
      <PersonAvatar identity={email} label={name} size={nested ? 28 : 36} />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[0.9375rem] font-medium text-[#1c1917]">
            {name}
          </span>
          {chip ? <Chip>{chip}</Chip> : null}
        </span>
        <span className="block truncate text-[0.8125rem] text-[var(--app-dim)]">
          {email}
        </span>
      </span>
      {current ? (
        <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </>
  );

  if (current)
    return (
      <div
        className={cn(
          "mx-1 flex items-center gap-3 rounded-[12px] px-3 text-[#44403c]",
          nested ? "py-1.5" : "py-2.5",
        )}
        aria-current="true"
      >
        {body}
      </div>
    );

  return (
    <Menu.Item
      onClick={() => {
        // Instant when this browser already knows the account; Google only
        // when it doesn't, or when the backend refuses.
        if (!memberId) return continueWithGoogle(null, email);
        void switchToAccount(memberId).then((ok) => {
          if (ok) window.location.reload();
          else continueWithGoogle(null, email);
        });
      }}
      className={cn(
        "mx-1 flex cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[#44403c] outline-none select-none data-[highlighted]:bg-[var(--app-muted)]",
        nested ? "py-1.5" : "py-2.5",
      )}
    >
      {body}
    </Menu.Item>
  );
}

/** Every row in the menu, whether it acts or navigates. */
/** How many accounts this browser holds, counted the way the list above
 *  counts them: one per remembered organization, plus each linked personal
 *  address, which has no row in the backend's list but does have one here
 *  (user 2026-09-22 — with two accounts the copy still read "Log out"). */
function signedInCount(accounts: RememberedOrg[] | null): number {
  if (!accounts) return 0;
  const emails = new Set<string>();
  for (const row of accounts) {
    emails.add(row.email.toLowerCase());
    for (const email of row.linked_personal_emails)
      emails.add(email.toLowerCase());
  }
  return emails.size;
}

/** The picker's black chip, at menu scale. */
function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[#1c1917] px-1.5 py-[0.1rem] text-[0.6875rem] font-bold leading-[1rem] text-white">
      {children}
    </span>
  );
}

const ITEM =
  "mx-1 flex h-11 cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[0.9375rem] text-[#44403c] no-underline outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-60 data-[highlighted]:bg-[var(--app-muted)] data-[highlighted]:text-[#1c1917]";

function Divider() {
  return <div className="my-1 h-px bg-[var(--app-border)]" />;
}

function Item({
  icon,
  disabled,
  onClick,
  onHover,
  hoverKey,
  children,
}: {
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  onHover?: (key: string | null) => void;
  hoverKey?: string;
  children: ReactNode;
}) {
  return (
    <Menu.Item
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => onHover?.(hoverKey ?? null)}
      onMouseLeave={() => onHover?.(null)}
      className={ITEM}
    >
      {icon}
      {children}
    </Menu.Item>
  );
}
