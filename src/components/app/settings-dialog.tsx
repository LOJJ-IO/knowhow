"use client";

import { useEffect, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { Button } from "@/components/app/button";
import { AppDialog, DialogSection } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { backendError, backendFetch } from "@/lib/backend";
import { fetchOrgOverview, type OrgOverview } from "@/lib/organization";

/** Settings, as a dialog over whatever you were looking at (user 2026-09-21,
 *  following Sage_v1) rather than a screen you navigate away to. Settings is
 *  something you adjust and come back from, so it shouldn't cost you your
 *  place.
 *
 *  Only settings that actually exist are here. The org's name and the
 *  auto-accept rule both have endpoints; the join link is shown because
 *  onboarding created it, and is read-only until the app has a place to
 *  reissue it. Both writes are **owner-only in the backend**
 *  (`_require_owner`), so a non-owner sees them as read-only rather than
 *  getting a 403 on save. */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { chrome, me } = useSession();
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [name, setName] = useState(chrome.name);
  const [autoAccept, setAutoAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Read on open, not on mount: the settings a person sees must be the ones
  // that are true now, not the ones that were true when the app loaded.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Resets live in the callbacks, not the effect body: setting state
    // synchronously inside an effect cascades renders.
    fetchOrgOverview(chrome.organizationId)
      .then((result) => {
        if (cancelled) return;
        setOverview(result);
        setName(result.name);
        setAutoAccept(result.autoAcceptWorkspaceMembers);
        setError("");
        setSaved(false);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [open, chrome.organizationId]);

  const canEdit = me.is_owner;
  const dirty =
    overview !== null &&
    (name.trim() !== overview.name ||
      autoAccept !== overview.autoAcceptWorkspaceMembers);

  async function save() {
    if (!overview || !dirty) return;
    setSaving(true);
    setError("");
    try {
      if (name.trim() && name.trim() !== overview.name) {
        const res = await backendFetch(
          `/organizations/${chrome.organizationId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          },
        );
        if (!res.ok) throw new Error(await backendError(res));
      }
      if (autoAccept !== overview.autoAcceptWorkspaceMembers) {
        const res = await backendFetch(
          `/organizations/${chrome.organizationId}/settings`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ auto_accept_workspace_members: autoAccept }),
          },
        );
        if (!res.ok) throw new Error(await backendError(res));
      }
      setOverview({
        ...overview,
        name: name.trim(),
        autoAcceptWorkspaceMembers: autoAccept,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
      description={
        canEdit
          ? "How Knohow behaves for your organization."
          : "How Knohow behaves for your organization. Only the owner can change these."
      }
      size="lg"
      footer={
        <>
          {error ? (
            <p
              className={`${satoshi.className} mr-auto self-center text-[0.8125rem] text-[#EA4335]`}
              aria-live="polite"
            >
              {error}
            </p>
          ) : saved ? (
            <p
              className={`${satoshi.className} mr-auto self-center text-[0.8125rem] text-[var(--app-dim)]`}
              aria-live="polite"
            >
              Saved.
            </p>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canEdit ? (
            <Button disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </>
      }
    >
      <DialogSection
        title="Organization"
        hint={
          overview?.observedDomain
            ? `Observed on ${overview.observedDomain}. The domain can't be changed here.`
            : "This organization has no Workspace domain."
        }
      >
        <label className={`${satoshi.className} flex flex-col gap-1.5`}>
          <span className="text-[0.875rem] text-[#1c1917]">Name</span>
          <input
            type="text"
            value={name}
            readOnly={!canEdit}
            onChange={(e) => {
              setSaved(false);
              setName(e.target.value);
            }}
            className="h-10 w-full rounded-[10px] border border-[var(--app-border)] bg-white px-3 text-[0.9375rem] text-[#1c1917] outline-none read-only:text-[var(--app-dim)] focus:border-[#1c1917]"
          />
        </label>
      </DialogSection>

      <DialogSection
        title="Joining"
        hint="Who gets in without the owner deciding each time."
      >
        <Row
          label="Approve Workspace accounts automatically"
          hint={`Anyone signing in from your domain joins without waiting.${
            overview?.pendingMembers
              ? ` ${overview.pendingMembers} waiting now.`
              : ""
          }`}
        >
          <Switch
            checked={autoAccept}
            disabled={!canEdit}
            label="Approve Workspace accounts automatically"
            onChange={(next) => {
              setSaved(false);
              setAutoAccept(next);
            }}
          />
        </Row>
        <Row
          label="Join link"
          hint={
            overview?.joinLinkActive
              ? "A live link from setup lets people join this organization."
              : "No live join link."
          }
        >
          <span
            className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}
          >
            {overview?.joinLinkActive ? "Live" : "Off"}
          </span>
        </Row>
      </DialogSection>
    </AppDialog>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className={`${satoshi.className} min-w-0`}>
        <p className="m-0 text-[0.875rem] leading-[1.4] text-[#1c1917]">
          {label}
        </p>
        {hint ? (
          <p className="m-0 mt-0.5 text-[0.8125rem] leading-[1.5] text-[var(--app-dim)]">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
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
      className={`relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-[background-color,transform] duration-150 active:scale-95 disabled:cursor-default disabled:opacity-60 ${
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
