"use client";

import { useEffect, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { CalendarDays, ChevronDown, Lock, LockOpen } from "lucide-react";

import { satoshi } from "@/components/brand/fonts";
import { Button } from "@/components/app/button";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { CopyField } from "@/components/ui/copy-field";
import { backendError, backendFetch } from "@/lib/backend";

const LIFETIMES = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "forever", label: "No end date" },
];

/** Shared by Lock / Unlock and the lifetime dropdown so they match. The
 *  width fits the longest lifetime label ("No end date"). */
const PILL =
  "flex h-9 w-28 shrink-0 whitespace-nowrap cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--app-border)] bg-white px-4 transition-colors duration-150 hover:border-[#d9d9de]";

/** Who gets in without the owner deciding each time: auto-approve for
 *  Workspace accounts, and the join link (ADR-0021). Lives in Manage teams
 *  (moved from Settings, user 2026-09-27). There's no Save there, so the
 *  switch saves as it's flipped. */
export function JoiningSection() {
  const { chrome, me } = useSession();
  const { overview, refresh } = useUpdates();
  const [autoAccept, setAutoAccept] = useState<boolean | null>(null);
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [lifetime, setLifetime] = useState("7d");
  const [reissuing, setReissuing] = useState(false);
  /** A new link was just made: the plus shows a tick for 1.5s, like Copy. */
  const [created, setCreated] = useState(false);
  /** Its own flag: sharing Create's made that button flash "Creating…". */
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState("");

  const canManageJoinLink =
    me.is_owner || me.is_super_admin || me.is_team_lead || me.is_founding_member;
  const canEditAutoAccept = canManageJoinLink;
  const checked = autoAccept ?? overview?.autoAcceptWorkspaceMembers ?? false;
  /** Set by this dialog's own changes until the overview re-reads. */
  const [linkLive, setLinkLive] = useState<boolean | null>(null);
  const linkOn = linkLive ?? overview?.joinLinkActive ?? false;
  const [linkLocked, setLinkLocked] = useState<boolean | null>(null);
  const locked = linkOn && (linkLocked ?? overview?.joinLinkLocked ?? false);

  // The live link's URL, so the box shows it before anyone presses New link.
  useEffect(() => {
    if (!canManageJoinLink) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await backendFetch(
          `/organizations/${chrome.organizationId}/join-link`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as { url: string | null };
        if (!cancelled && body.url) setJoinUrl((prev) => prev || body.url!);
      } catch {
        // The box just stays empty; New link still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageJoinLink, chrome.organizationId]);

  async function toggleAutoAccept(next: boolean) {
    setAutoAccept(next);
    setSavingSwitch(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${chrome.organizationId}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auto_accept_workspace_members: next }),
        },
      );
      if (!res.ok) throw new Error(await backendError(res));
      refresh();
    } catch (e) {
      setAutoAccept(!next);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingSwitch(false);
    }
  }

  async function reissueLink() {
    if (reissuing) return;
    setReissuing(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${chrome.organizationId}/join-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lifetime }),
        },
      );
      if (!res.ok) throw new Error(await backendError(res));
      const body = (await res.json()) as { url: string };
      setJoinUrl(body.url);
      setLinkLive(true);
      setLinkLocked(false);
      setCreated(true);
      window.setTimeout(() => setCreated(false), 1500);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReissuing(false);
    }
  }

  /** Locks or unlocks the live link without replacing it (user
   *  2026-09-27): the link people already have comes back on unlock. */
  async function setLocked(next: boolean) {
    if (locking) return;
    setLocking(true);
    setError("");
    setLinkLocked(next);
    try {
      const res = await backendFetch(
        `/organizations/${chrome.organizationId}/join-link`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locked: next }),
        },
      );
      if (!res.ok) throw new Error(await backendError(res));
      refresh();
    } catch (e) {
      setLinkLocked(!next);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLocking(false);
    }
  }

  return (
    // No hint or row descriptions (user 2026-09-27).
    <div className="flex flex-col gap-5">
      {canManageJoinLink ? (
        <div className={`${satoshi.className} flex flex-col gap-2`}>
          <h3 className="m-0 text-[1.0625rem] leading-[1.3] font-bold tracking-tight text-[#1c1917]">
            Join Link
          </h3>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {joinUrl ? (
                <CopyField
                  label="Join link"
                  value={joinUrl}
                  showLabel={false}
                />
              ) : (
                <p className="m-0 flex h-10 items-center rounded-[var(--login-button-radius,10px)] border border-dashed border-[#d9d9de] px-3 text-[0.8rem] text-[var(--app-dim)]">
                  No join link yet
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="group"
              disabled={reissuing}
              onClick={() => void reissueLink()}
            >
              {/* Drawn on a 16px grid with 2px bars so both strokes land on
                  whole pixels; Lucide's 24-unit Plus blurs unevenly at 16px. */}
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="size-4 shrink-0 transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-disabled:scale-100 motion-reduce:transition-none"
              >
                {created ? (
                  <path d="M3 8.5l3.5 3.5L13 4.5" strokeLinejoin="round" />
                ) : (
                  <path d="M8 3v10M3 8h10" />
                )}
              </svg>
              {reissuing ? "Creating…" : "New link"}
            </Button>
          </div>
        </div>
      ) : null}
      <Row
        label="Let people from your domain in automatically"
      >
        <Switch
          checked={checked}
          disabled={!canEditAutoAccept || savingSwitch}
          label="Let people from your domain in automatically"
          onChange={(next) => void toggleAutoAccept(next)}
        />
      </Row>
      <Row
        label={
          !linkOn
            ? "No join link yet"
            : locked
              ? "Join link is locked"
              : "Join link is open"
        }
        display={
          linkOn ? (
            <>
              Join link is{" "}
              <span className={locked ? "text-[#EA4335]" : "text-[#34A853]"}>
                {locked ? "locked" : "open"}
              </span>
            </>
          ) : undefined
        }
      >
        {/* Locks the live link rather than replacing it (user 2026-09-27). */}
        <LockButton
          locked={locked}
          disabled={!canManageJoinLink || !linkOn || locking || reissuing}
          onClick={() => void setLocked(!locked)}
        />
      </Row>
      {canManageJoinLink ? (
        // A row like the switches above: the question left, the choice
        // right (user 2026-09-27).
        <Row label="New links expire after">
          <LifetimeMenu value={lifetime} onChange={setLifetime} />
        </Row>
      ) : null}
      {error ? (
        <p
          aria-live="polite"
          className={`${satoshi.className} m-0 text-[0.8125rem] text-[#EA4335]`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  display,
  children,
}: {
  label: string;
  /** Rich version of `label`, e.g. with one word coloured. */
  display?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p
        className={`${satoshi.className} m-0 min-w-0 text-[0.9375rem] leading-[1.4] font-medium text-[#1c1917]`}
      >
        {display ?? label}
      </p>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-[background-color,translate] duration-150 active:translate-y-px disabled:cursor-default disabled:opacity-60 ${
        checked ? "bg-[#1c1917]" : "bg-[var(--app-active)]"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left] duration-150 ${
          checked ? "left-[1.125rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** The link lifetime as a compact dropdown, drawn like the profile menu. It
 *  opens inside a dialog, so it sits above dialogs (500), under tooltips. */
function LifetimeMenu({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const current = LIFETIMES.find((l) => l.value === value) ?? LIFETIMES[1];
  return (
    <Menu.Root>
      <Menu.Trigger
        className={`${satoshi.className} ${PILL} group text-[#1c1917] outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917]/15 data-[popup-open]:border-[#1c1917]`}
      >
        <CalendarDays
          aria-hidden
          className="size-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-12 group-hover:scale-110 group-data-[popup-open]:-rotate-12 group-data-[popup-open]:scale-110 motion-reduce:transition-none"
        />
        <span className="text-[13px] font-medium tracking-tight">
          {current.label}
        </span>
        <ChevronDown
          aria-hidden
          className="-mr-1 size-4 shrink-0 text-[var(--app-dim)]"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          align="end"
          sideOffset={6}
          className="isolate z-[550]"
        >
          <Menu.Popup
            className={`${satoshi.className} app-modal min-w-[11rem] rounded-[16px] bg-white py-1 shadow-[0_18px_50px_rgba(0,0,0,0.16),0_0_0_1px_var(--app-border)] outline-none`}
          >
            {LIFETIMES.map((opt) => (
              <Menu.Item
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className={`mx-1 flex h-10 cursor-pointer items-center rounded-[12px] px-3 text-[0.9375rem] outline-none select-none data-[highlighted]:bg-[var(--app-muted)] ${
                  opt.value === value
                    ? "font-medium text-[#1c1917]"
                    : "text-[#44403c]"
                }`}
              >
                {opt.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Lock / Unlock for the join link, in the app's light outline style. The
 *  icon shows the link as it is; no hover morph (user 2026-09-27). */
function LockButton({
  locked,
  disabled,
  onClick,
}: {
  locked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = locked ? LockOpen : Lock;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${satoshi.className} ${PILL} ${locked ? "text-[#34A853]" : "text-[#EA4335]"} disabled:cursor-default disabled:opacity-50`}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="text-[13px] font-medium tracking-tight">
        {locked ? "Unlock" : "Lock"}
      </span>
    </button>
  );
}
