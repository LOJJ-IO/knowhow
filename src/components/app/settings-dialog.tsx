"use client";

import { useEffect, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { Button } from "@/components/app/button";
import { AppDialog, DialogSection } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { ChoicePill } from "@/components/ui/choice-pill";
import { backendError, backendFetch } from "@/lib/backend";
import { fetchOrgOverview, type OrgOverview } from "@/lib/organization";

type TeamJoinRequest = {
  id: string;
  team_id: string;
  member_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
};

const LIFETIMES = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "forever", label: "No end date" },
];

/** Settings dialog — org name, auto-accept, join-link reissue (ADR-0021),
 *  and pending team join approvals for leads. */
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
  const [joinUrl, setJoinUrl] = useState("");
  const [reissueLifetime, setReissueLifetime] = useState("7d");
  const [reissuing, setReissuing] = useState(false);
  const [requests, setRequests] = useState<TeamJoinRequest[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);

  const canEdit = me.is_owner;
  const canManageJoinLink =
    me.is_owner ||
    me.is_super_admin ||
    me.is_team_lead ||
    me.is_founding_member;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchOrgOverview(chrome.organizationId)
      .then((result) => {
        if (cancelled) return;
        setOverview(result);
        setName(result.name);
        setAutoAccept(result.autoAcceptWorkspaceMembers);
        setError("");
        setSaved(false);
        setJoinUrl("");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    void backendFetch(`/organizations/${chrome.organizationId}/team-join-requests`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        setRequests((await res.json()) as TeamJoinRequest[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, chrome.organizationId]);

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
          body: JSON.stringify({ lifetime: reissueLifetime }),
        },
      );
      if (!res.ok) throw new Error(await backendError(res));
      const body = (await res.json()) as { url: string };
      setJoinUrl(body.url);
      if (overview) setOverview({ ...overview, joinLinkActive: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReissuing(false);
    }
  }

  async function decide(requestId: string, approve: boolean) {
    setDeciding(requestId);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${chrome.organizationId}/team-join-requests/${requestId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approve }),
        },
      );
      if (!res.ok) throw new Error(await backendError(res));
      setRequests((cur) => cur.filter((r) => r.id !== requestId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeciding(null);
    }
  }

  const teamName = (teamId: string) =>
    overview?.teams.find((t) => t.id === teamId)?.name ?? "a team";

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
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
          {/* Every dialog's bottom Close is black (user 2026-09-27). */}
          <Button onClick={() => onOpenChange(false)}>
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
              ? "A live link lets people join this organization."
              : "No live join link — reissue one below if you can."
          }
        >
          <span
            className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}
          >
            {overview?.joinLinkActive ? "Live" : "Off"}
          </span>
        </Row>
        {canManageJoinLink ? (
          <div className={`${satoshi.className} mt-3 flex flex-col gap-2`}>
            <p className="m-0 text-[0.8125rem] text-[var(--app-dim)]">
              How long should a new link last?
            </p>
            <div className="flex flex-wrap gap-2">
              {LIFETIMES.map((opt) => (
                <ChoicePill
                  key={opt.value}
                  label={opt.label}
                  selected={reissueLifetime === opt.value}
                  onClick={() => setReissueLifetime(opt.value)}
                />
              ))}
            </div>
            <Button
              variant="outline"
              disabled={reissuing}
              onClick={() => void reissueLink()}
            >
              {reissuing ? "Creating…" : "Create new join link"}
            </Button>
            {joinUrl ? (
              <input
                readOnly
                value={joinUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 w-full rounded-[10px] border border-[var(--app-border)] bg-white px-3 text-[0.8125rem] text-[#1c1917]"
              />
            ) : null}
          </div>
        ) : null}
      </DialogSection>

      {requests.length > 0 ? (
        <DialogSection
          title="Team join requests"
          hint="People waiting for a lead to approve their team."
        >
          <ul className={`${satoshi.className} m-0 flex list-none flex-col gap-3 p-0`}>
            {requests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="m-0 text-[0.875rem] text-[#1c1917]">
                    {req.display_name || req.email || "Someone"}
                  </p>
                  <p className="m-0 text-[0.8125rem] text-[var(--app-dim)]">
                    wants to join {teamName(req.team_id)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={deciding === req.id}
                    onClick={() => void decide(req.id, false)}
                  >
                    Decline
                  </Button>
                  <Button
                    disabled={deciding === req.id}
                    onClick={() => void decide(req.id, true)}
                  >
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DialogSection>
      ) : null}
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
