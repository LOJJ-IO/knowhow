"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { Button } from "@/components/app/button";
import { AppDialog } from "@/components/app/dialog";
import { useSession } from "@/components/app/session";
import { useUpdates } from "@/components/app/updates";
import { FileIcon } from "@/components/app/file-meta";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { backendError, backendFetch } from "@/lib/backend";
import { actionLabel, relativeTime } from "@/lib/change-text";
import {
  fetchLog,
  fetchTrash,
  restoreFile,
  type LogEntry,
  type TrashedFile,
} from "@/lib/librarian";
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
  const { refresh, reloadTasks } = useUpdates();
  const club = me.organization_kind === "club";
  /** A club's club account (ADR-0034), saved the moment it's picked. */
  const [clubAccount, setClubAccount] = useState<string | null>(me.club_account_member_id);
  const [savingClubAccount, setSavingClubAccount] = useState(false);
  const canPickClubAccount = me.is_owner || me.is_founding_member;
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [name, setName] = useState(chrome.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [requests, setRequests] = useState<TeamJoinRequest[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);
  /** Files deleted through Knohow you may restore (Ronald, 2026-10-04). */
  const [trash, setTrash] = useState<TrashedFile[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  /** The org's history; the owner and Super Admins only. */
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const seesLog = me.is_owner || me.is_super_admin;

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
    fetchTrash(chrome.organizationId)
      .then((rows) => {
        if (!cancelled) setTrash(rows);
      })
      .catch(() => {
        if (!cancelled) setTrash([]);
      });
    if (seesLog)
      fetchLog(chrome.organizationId)
        .then((rows) => {
          if (!cancelled) setLog(rows);
        })
        .catch(() => {
          if (!cancelled) setLog([]);
        });
    return () => {
      cancelled = true;
    };
  }, [open, chrome.organizationId, seesLog]);

  async function restore(file: TrashedFile) {
    setRestoring(file.fileId);
    setError("");
    try {
      await restoreFile(chrome.organizationId, file.fileId);
      setTrash((cur) => (cur ?? []).filter((f) => f.fileId !== file.fileId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoring(null);
    }
  }

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

  async function pickClubAccount(memberId: string | null) {
    setSavingClubAccount(true);
    setError("");
    try {
      const res = await backendFetch(`/organizations/${chrome.organizationId}/club-account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!res.ok) throw new Error(await backendError(res));
      setClubAccount(memberId);
      reloadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingClubAccount(false);
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

        {club ? (
          <section className="flex flex-col gap-2">
            <SettingsHeading>Club account</SettingsHeading>
            <ClubAccountMenu
              members={overview?.members ?? []}
              value={clubAccount}
              disabled={!canPickClubAccount || savingClubAccount}
              onChange={(id) => void pickClubAccount(id)}
            />
          </section>
        ) : null}

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

        <section className="flex flex-col gap-2">
          <SettingsHeading>Trash</SettingsHeading>
          {trash === null ? (
            <p className="m-0 text-[0.875rem] text-[var(--app-dim)]">Loading…</p>
          ) : trash.length === 0 ? (
            <p className="m-0 text-[0.875rem] text-[var(--app-dim)]">
              Nothing in Trash. Files deleted in Knohow stay here for 30 days.
            </p>
          ) : (
            <ul className="m-0 flex max-h-[16rem] list-none flex-col gap-3 overflow-y-auto p-0">
              {trash.map((f) => (
                <li key={f.fileId} className="flex items-center gap-3">
                  <FileIcon mimeType={f.mimeType} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[0.875rem] text-[#1c1917]" title={f.name}>
                      {f.name}
                    </p>
                    <p className="m-0 text-[0.8125rem] text-[var(--app-dim)]">
                      {f.trashedBy ? `Deleted by ${f.trashedBy} · ` : ""}
                      {daysLeft(f.goneAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={restoring === f.fileId}
                    onClick={() => void restore(f)}
                  >
                    {restoring === f.fileId ? "Restoring…" : "Restore"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {seesLog ? (
          <section className="flex flex-col gap-2">
            <SettingsHeading>Logs</SettingsHeading>
            {log === null ? (
              <p className="m-0 text-[0.875rem] text-[var(--app-dim)]">Loading…</p>
            ) : log.length === 0 ? (
              <p className="m-0 text-[0.875rem] text-[var(--app-dim)]">Nothing yet.</p>
            ) : (
              <ul className="m-0 flex max-h-[18rem] list-none flex-col gap-3 overflow-y-auto p-0">
                {log.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[0.875rem] text-[#1c1917]">
                        {actionLabel(e.action)}
                        {e.subject ? ` · ${e.subject}` : ""}
                      </p>
                      {e.actor ? (
                        <p className="m-0 text-[0.8125rem] text-[var(--app-dim)]">{e.actor}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[0.8125rem] text-[var(--app-dim)] tabular-nums">
                      {relativeTime(e.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </AppDialog>
  );
}

/** Manage teams' "Join Link" heading: bigger and bolder than the rows. */
/** Who the club account is: a club member, or nobody (members keep their
 *  own files). Same dropdown look as Manage teams' link lifetime. */
function ClubAccountMenu({
  members,
  value,
  disabled,
  onChange,
}: {
  members: OrgOverview["members"];
  value: string | null;
  disabled: boolean;
  onChange: (memberId: string | null) => void;
}) {
  const current = members.find((m) => m.id === value);
  const item =
    "mx-1 flex min-h-10 cursor-pointer items-center gap-3 rounded-[12px] px-3 py-1.5 text-[0.9375rem] outline-none select-none data-[highlighted]:bg-[var(--app-muted)]";
  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled}
        className={`${satoshi.className} flex h-10 w-full items-center gap-2.5 rounded-[var(--login-button-radius,10px)] border border-[#d9d9de] bg-white px-3 text-left text-[0.9375rem] text-[#1c1917] outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917]/15 disabled:cursor-default disabled:text-[var(--app-dim)] data-[popup-open]:border-[#1c1917]`}
      >
        {current ? (
          <PersonAvatar identity={current.email} label={current.displayName ?? current.email} size={22} />
        ) : null}
        <span className="min-w-0 flex-1 truncate">
          {current ? current.email : "None yet. Members keep their own files."}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-[var(--app-dim)]" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={6} className="isolate z-[550]">
          <Menu.Popup
            className={`${satoshi.className} app-modal max-h-[18rem] min-w-[var(--anchor-width)] overflow-y-auto rounded-[16px] bg-white py-1 shadow-[0_18px_50px_rgba(0,0,0,0.16),0_0_0_1px_var(--app-border)] outline-none`}
          >
            {members.map((m) => (
              <Menu.Item key={m.id} onClick={() => onChange(m.id)} className={item}>
                <PersonAvatar identity={m.email} label={m.displayName ?? m.email} size={22} />
                <span className="min-w-0">
                  <span className="block truncate text-[#1c1917]">{m.displayName ?? m.email}</span>
                  <span className="block truncate text-[0.8125rem] text-[var(--app-dim)]">{m.email}</span>
                </span>
              </Menu.Item>
            ))}
            {value ? (
              <Menu.Item onClick={() => onChange(null)} className={`${item} text-[#44403c]`}>
                None: members keep their own files
              </Menu.Item>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function SettingsHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="m-0 text-[1.0625rem] leading-[1.3] font-bold tracking-tight text-[#1c1917]">
      {children}
    </h3>
  );
}

/** "Gone in 12 days": when Google empties it for good (ADR-0010). */
function daysLeft(goneAt: string) {
  const days = Math.ceil((new Date(goneAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 1) return "Gone tomorrow";
  return `Gone in ${days} days`;
}
