"use client";

import { useEffect, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { Button } from "@/components/app/button";
import { AppDialog } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
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

/** Settings dialog — org name and pending team join approvals for leads.
 *  Joining (auto-accept, join link) moved to Manage teams (user 2026-09-27). */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { chrome, me, setOrganizationName } = useSession();
  const { refresh } = useUpdates();
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [name, setName] = useState(chrome.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [requests, setRequests] = useState<TeamJoinRequest[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);

  // The backend lets any approved member rename; the owner seat can still be
  // an unconfirmed claim, so the founder and Super Admins can too.
  const canEdit = me.is_owner || me.is_super_admin || me.is_founding_member;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchOrgOverview(chrome.organizationId)
      .then((result) => {
        if (cancelled) return;
        setOverview(result);
        setName(result.name);
        setError("");
        setSaved(false);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    void backendFetch(
      `/organizations/${chrome.organizationId}/team-join-requests`,
    )
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
    overview !== null && name.trim() !== "" && name.trim() !== overview.name;

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
      setOverview({ ...overview, name: name.trim() });
      setOrganizationName(name.trim());
      refresh();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
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
      size="sm"
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
          <Button onClick={() => onOpenChange(false)}>Close</Button>
          {canEdit ? (
            // Outline, like an unselected Manage teams tab (user
            // 2026-09-27); Close stays the one black button.
            <Button
              variant="outline"
              disabled={!dirty || saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </>
      }
    >
      {/* Laid out like Manage teams (user 2026-09-27): bold headings, no
          hints or dividers, 20px between blocks. */}
      <div className={`${satoshi.className} flex flex-col gap-5`}>
        <section className="flex flex-col gap-2">
          <SettingsHeading>Organization</SettingsHeading>
          <input
            type="text"
            aria-label="Organization name"
            value={name}
            readOnly={!canEdit}
            onChange={(e) => {
              setSaved(false);
              setName(e.target.value);
            }}
            className="t-input t-demo-input h-10 w-full min-w-0 rounded-[var(--login-button-radius,10px)] border bg-white px-3 text-[0.9375rem] text-[#1c1917] outline-none read-only:text-[var(--app-dim)]"
          />
        </section>

        {requests.length > 0 ? (
          <section className="flex flex-col gap-2">
            <SettingsHeading>Team join requests</SettingsHeading>
            <ul className="m-0 flex list-none flex-col gap-5 p-0">
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
          </section>
        ) : null}
      </div>
    </AppDialog>
  );
}

/** Manage teams' "Join Link" heading: bigger and bolder than the rows. */
function SettingsHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="m-0 text-[1.0625rem] leading-[1.3] font-bold tracking-tight text-[#1c1917]">
      {children}
    </h3>
  );
}
