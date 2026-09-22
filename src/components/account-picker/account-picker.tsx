"use client";

import { useState } from "react";
import { UserRoundX } from "lucide-react";
import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";
import { GoogleG } from "@/components/ui/icons";
import { FooterStubLink } from "@/components/landing/footer-stub-link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/brand/tooltip";
import {
  continueWithGoogle,
  forgetRememberedAccounts,
  readInviteToken,
  type RememberedOrg,
} from "@/lib/remembered-accounts";

/** "Which account today?" and the remove-accounts screen behind it.
 *
 *  One tenant: the rows this browser has signed in to, the pills showing
 *  linked personal addresses, and the tree for forgetting them. Keyed to a
 *  device, never to a person. */

/** Initial-circle tints. Google gives us no profile picture (`/auth/me`
 *  returns a name and an email only), so a row's avatar is the initial on a
 *  tint picked deterministically from the email — same person, same colour
 *  every visit. PLACEHOLDER palette. */
const AVATAR_TINTS = ["#2F6F4E", "#8E3B8E", "#2F6F8E", "#8E5A2F", "#4A3F8E"];

function avatarTint(email: string) {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) % 100003;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

/** Black chip beside the org name, saying which kind of account this row
 *  signs in with. The address itself lives in the tooltip, so the row stays
 *  two lines: the organization, then who you are in it. */
function AccountBadge({
  label,
  emails,
}: {
  label: string;
  /** One address for a row's own account; several for the Personal chip. */
  emails: string[];
}) {
  const count = emails.length;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`${label}: ${emails.join(", ")}`}
            className="inline-flex cursor-default items-center gap-1 rounded-full bg-[#1c1917] px-2 py-[0.15rem] text-[0.7rem] font-bold leading-[1.1rem] text-white"
          />
        }
      >
        {label}
        {count > 1 ? ` (${count})` : ""}
      </TooltipTrigger>
      {/* Portaled to <body>, so it inherits nothing from the picker: the
          font has to be named here or it falls back to the browser's sans. */}
      <TooltipContent side="bottom" sideOffset={6} className={satoshi.className}>
        {emails.map((email) => (
          <span key={email} className="block">
            {email}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

/** One selectable row on the remove-accounts screen — either a remembered
 *  org/personal member, or a linked personal address that has no row of its
 *  own on the picker (user 2026-09-21). */
/** One linked personal address, sitting under the organization row that
 *  surfaces it. */
type RemovableChild = {
  key: string;
  email: string;
  title: string;
  subtitle: string;
};

type RemovableAccount = {
  key: string;
  /** The remembered member id forgotten when this row is ticked. */
  memberId: string;
  title: string;
  subtitle: string;
  tintEmail: string;
  avatarLetter: string;
  children: RemovableChild[];
};

/** The remove screen's tree: one organization per row, with the person's
 *  linked personal addresses nested under it the way a folder holds files
 *  (user, 2026-09-21).
 *
 *  An address is listed under **every** org row that surfaces it, because
 *  that is how the picker shows it — as a chip on each of the person's rows.
 *  Hiding it is per address, not per row, so ticking it anywhere hides it
 *  everywhere on this browser. */
function removableAccounts(organizations: RememberedOrg[]): RemovableAccount[] {
  return organizations.map((org) => ({
    key: `member:${org.member_id}`,
    memberId: org.member_id,
    title: org.organization_name,
    subtitle: org.email,
    tintEmail: org.email,
    avatarLetter: org.organization_name.charAt(0).toUpperCase(),
    children: org.linked_personal_emails.map((email) => ({
      key: `member:${org.member_id}:personal:${email}`,
      email,
      title: email,
      subtitle: org.person_name ?? "Personal",
    })),
  }));
}

/** Second screen behind the picker's "Remove accounts" link: tick what to
 *  forget on this device. A file tree, not a flat list (user, 2026-09-21):
 *  each organization holds the person's linked personal addresses beneath it,
 *  ticking the organization ticks the whole branch, and a child can be
 *  unticked on its own to keep it.
 *
 *  The two ticks don't mean the same thing, which is why the branch matters.
 *  An organization is **forgotten** on this browser. A child address has no
 *  row to forget, so it is **hidden** here instead; the link itself survives.
 *  Singular or plural follows **how many are in the list**, not how many are
 *  ticked (user, 2026-09-20). PLACEHOLDER copy. */
function RemoveAccountsScreen({
  organizations,
  onBack,
  onRemoved,
}: {
  organizations: RememberedOrg[];
  /** What the picker has to drop: whole rows, and addresses now hidden. */
  onRemoved: (removed: { memberIds: string[]; emails: string[] }) => void;
  onBack: () => void;
}) {
  const accounts = removableAccounts(organizations);
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const rowCount = accounts.reduce((n, row) => n + 1 + row.children.length, 0);
  const many = rowCount > 1;

  const isSelected = (key: string) => selected.includes(key);

  /** Ticking an organization takes its addresses with it; unticking it
   *  releases them again. Either way the branch moves as one. */
  function toggleParent(row: RemovableAccount) {
    const keys = [row.key, ...row.children.map((c) => c.key)];
    setSelected((current) =>
      current.includes(row.key)
        ? current.filter((k) => !keys.includes(k))
        : [...current.filter((k) => !keys.includes(k)), ...keys],
    );
  }

  /** Unticking one address leaves the organization ticked: they are separate
   *  removals, so keeping an address doesn't rescue the row above it. */
  function toggleChild(key: string) {
    setSelected((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    );
  }

  function submit() {
    setRemoving(true);
    const memberIds = [
      ...new Set(
        accounts.filter((row) => isSelected(row.key)).map((row) => row.memberId),
      ),
    ];
    const emails = [
      ...new Set(
        accounts
          .flatMap((row) => row.children)
          .filter((child) => isSelected(child.key))
          .map((child) => child.email),
      ),
    ];
    void forgetRememberedAccounts(memberIds, emails).then(() =>
      onRemoved({ memberIds, emails }),
    );
  }

  const tick = (checked: boolean, onChange: () => void, label: string) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={removing}
      aria-label={label}
      className="size-4 shrink-0 accent-[#1c1917]"
    />
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-[#1c1917] transition-transform duration-150 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-5">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2
          className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
        >
          {many ? "Remove accounts" : "Remove account"}
        </h2>
      </div>
      <p
        className={`${sohne.className} mt-6 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
      >
        {many
          ? "Select the accounts you want to remove from this device."
          : "Select the account you want to remove from this device."}
      </p>
      <ul
        className={`${satoshi.className} m-0 mt-8 flex list-none flex-col gap-2 p-0`}
      >
        {accounts.map((row) => {
          const checked = isSelected(row.key);
          return (
            <li key={row.key}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[var(--login-button-radius)] border bg-white px-3 py-2 transition-colors",
                  checked ? "border-[#1c1917]" : "border-[#d9d9de]",
                )}
              >
                {tick(checked, () => toggleParent(row), `Remove ${row.title}`)}
                <span
                  aria-hidden
                  style={{ backgroundColor: avatarTint(row.tintEmail) }}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-[1rem] font-bold text-white"
                >
                  {row.avatarLetter}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[1rem] font-bold text-[#1c1917]">
                    {row.title}
                  </span>
                  <span className="block truncate text-[0.8rem] text-[#1c1917]/70">
                    {row.subtitle}
                  </span>
                </span>
              </label>

              {row.children.length > 0 ? (
                // Indented under the organization and joined to it by one
                // continuous trunk: the spacing lives in each child's padding
                // rather than a flex gap, so the line has nothing to jump.
                // Children are a fixed height so the trunk meets each row at
                // its middle (36px = 8px padding + half of the 56px row).
                <ul className="m-0 flex list-none flex-col p-0 pl-6">
                  {row.children.map((child, childIndex) => {
                    const childChecked = isSelected(child.key);
                    const isLast = childIndex === row.children.length - 1;
                    return (
                      <li key={child.key} className="relative pt-2">
                        {isLast ? (
                          // Last one turns the corner and stops.
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -left-3 top-0 h-9 w-3 rounded-bl-[6px] border-b border-l border-[#d9d9de]"
                          />
                        ) : (
                          // Trunk carries on to the next child, with a stub
                          // reaching out to this one.
                          <>
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -left-3 top-0 bottom-0 w-px bg-[#d9d9de]"
                            />
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -left-3 top-9 h-px w-3 bg-[#d9d9de]"
                            />
                          </>
                        )}
                        <label
                          className={cn(
                            "flex h-14 cursor-pointer items-center gap-3 rounded-[var(--login-button-radius)] border bg-white px-3 transition-colors",
                            childChecked
                              ? "border-[#1c1917]"
                              : "border-[#d9d9de]",
                          )}
                        >
                          {tick(
                            childChecked,
                            () => toggleChild(child.key),
                            `Remove ${child.title}`,
                          )}
                          <span
                            aria-hidden
                            style={{ backgroundColor: avatarTint(child.email) }}
                            className="flex size-7 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-bold text-white"
                          >
                            {child.email.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[0.9rem] font-bold text-[#1c1917]">
                              {child.title}
                            </span>
                            <span className="block truncate text-[0.75rem] text-[#1c1917]/70">
                              {child.subtitle}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={removing || selected.length === 0}
        onClick={submit}
        className={`${satoshi.className} relative mt-8 flex h-12 w-full cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white text-[1rem] font-bold text-[#1c1917] transition-transform duration-150 active:scale-[0.98] disabled:cursor-default disabled:opacity-60`}
      >
        {many ? "Remove selected accounts" : "Remove selected account"}
      </button>
    </>
  );
}

/** "Which account today?" — one row per organization this browser has signed
 *  in to. The org's name leads; the person's name is the subtext under it.
 *  PLACEHOLDER copy. */
export function AccountPicker({
  organizations,
  onRemoved,
}: {
  organizations: RememberedOrg[];
  /** Rows were forgotten, or addresses hidden; the caller drops both from the
   *  list, and shows the plain Log In screen once no rows are left. */
  onRemoved: (removed: { memberIds: string[]; emails: string[] }) => void;
}) {
  /** The "Remove accounts" link opens a second screen in this modal rather
   *  than forgetting everything on the spot (user 2026-09-20). */
  const [removing, setRemoving] = useState(false);

  if (removing)
    return (
      <RemoveAccountsScreen
        organizations={organizations}
        onBack={() => setRemoving(false)}
        onRemoved={(removed) => {
          setRemoving(false);
          onRemoved(removed);
        }}
      />
    );

  return (
    // Scoped to the picker rather than the app root: it's the only surface
    // with tooltips, and the root layout is a Server Component — no reason
    // to push a client boundary up there for one screen.
    <TooltipProvider delay={0}>
      <h2
        className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
      >
        Which account today?
      </h2>
      <p
        className={`${sohne.className} mt-6 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
      >
        Pick up where you left off or continue as another user.
      </p>
      <ul className={`${satoshi.className} m-0 mt-8 flex list-none flex-col gap-0.5 p-0`}>
        {organizations.map((row) => (
          <li
            key={row.member_id}
            className="flex items-center gap-3 rounded-[var(--login-button-radius)] px-2 py-1"
          >
            <button
              type="button"
              // Signing in to this organization: its account is the hint, and
              // Google can still override it.
              onClick={() => continueWithGoogle(null, row.email)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left transition-transform duration-150 active:scale-[0.98]"
            >
              <span
                aria-hidden
                style={{ backgroundColor: avatarTint(row.email) }}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-[1rem] font-bold text-white"
              >
                {row.organization_name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[1rem] font-bold text-[#1c1917]">
                  {row.organization_name}
                </span>
                {row.person_name ? (
                  <span className="block truncate text-[0.8rem] text-[#1c1917]/70">
                    {row.person_name}
                  </span>
                ) : null}
              </span>
            </button>
            <span className="flex shrink-0 items-center gap-1.5">
              <AccountBadge
                label={row.kind === "org" ? "Org" : "Personal"}
                emails={[row.email]}
              />
              {/* Linked addresses with no org of their own. Only on rows that
                  aren't themselves personal, or the row would read "Personal"
                  twice. */}
              {row.kind === "org" && row.linked_personal_emails.length > 0 ? (
                <AccountBadge
                  label="Personal"
                  emails={row.linked_personal_emails}
                />
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {/* Half width, centred (user 2026-09-20) — a full-width rule made the
          modal read as two stacked panels. */}
      <div className={`${satoshi.className} mx-auto mt-3 flex w-1/2 items-center gap-3`}>
        <span className="h-px flex-1 bg-[#d9d9de]" />
        <span className="text-[0.75rem] text-[#1c1917]/70">OR</span>
        <span className="h-px flex-1 bg-[#d9d9de]" />
      </div>
      <button
        type="button"
        onClick={() => continueWithGoogle(readInviteToken())}
        className={`${satoshi.className} relative mt-6 flex h-12 w-full cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white text-[1rem] font-bold text-[#1c1917] transition-transform duration-150 active:scale-[0.98] disabled:cursor-default disabled:opacity-60`}
      >
        <GoogleG className="absolute left-[13px] size-5" />
        Continue with another account
      </button>
      <p
        className={`${satoshi.className} mt-6 text-[0.8rem] leading-[1.6] text-[#1c1917]`}
      >
        By continuing, you agree to Knohow&rsquo;s{" "}
        <span className="font-bold">
          <FooterStubLink href="/terms">Terms of Use</FooterStubLink>
        </span>
        . Read our{" "}
        <span className="font-bold">
          <FooterStubLink href="/privacy">Privacy Policy</FooterStubLink>
        </span>
        .
      </p>
      <button
        type="button"
        onClick={() => setRemoving(true)}
        className={`${satoshi.className} mt-4 inline-flex cursor-pointer items-center gap-[4px] border-b border-current leading-none text-[0.8rem] font-bold text-[#1c1917]`}
      >
        <UserRoundX className="size-[1em] shrink-0" aria-hidden />
        {removableAccounts(organizations).length > 1
          ? "Remove accounts"
          : "Remove account"}
      </button>
    </TooltipProvider>
  );
}
