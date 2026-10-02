"use client";

import { Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/app/button";
import { EmptyState } from "@/components/app/empty-state";
import { describeFile, editedAgo, FileIcon } from "@/components/app/file-meta";
import { NAV_STROKE } from "@/components/app/icon";
import {
  Bar,
  PersonChip,
  SectionHeading,
  SkeletonRows,
  Switch,
  Window,
  message,
  plural,
} from "@/components/app/screen-kit";
import { useSession } from "@/components/app/session";
import { AppPage } from "@/components/app/shell";
import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";
import {
  decideSuggestion,
  fetchSharing,
  peopleById,
  setAutoOwn,
  type Person,
  type Sharing,
} from "@/lib/governance";

/** A short list of names: "Priya, Daniel and Marcus". */
function names(people: (Person | undefined)[]) {
  const first = people.filter(Boolean).map((p) => p!.name.split(" ")[0]);
  if (first.length <= 1) return first.join("");
  return `${first.slice(0, -1).join(", ")} and ${first[first.length - 1]}`;
}

/** Sharing: what happens the moment a file is made, team by team, and the
 *  caller's own files that are waiting on a share. */
export function SharingScreen() {
  const { chrome } = useSession();
  const org = chrome.organizationId;
  const [data, setData] = useState<Sharing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await fetchSharing(org));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }, [org]);

  useEffect(() => {
    // Loads on open; state is set only after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const people = useMemo(() => peopleById(data?.people ?? []), [data]);
  const topLeaders = (data?.top_leader_ids ?? []).map((id) => people.get(id));

  async function decide(fileId: string, share: boolean) {
    setBusy(fileId);
    try {
      await decideSuggestion(fileId, share);
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(teamId: string, on: boolean) {
    setData((d) =>
      d ? { ...d, teams: d.teams.map((t) => (t.id === teamId ? { ...t, auto_own: on } : t)) } : d,
    );
    try {
      await setAutoOwn(org, teamId, on);
    } catch (e) {
      setError(message(e));
      await refresh();
    }
  }

  if (error && !data)
    return (
      <AppPage>
        <Window>
          <EmptyState icon="share" title="Couldn't load sharing" description={error} />
        </Window>
      </AppPage>
    );

  return (
    <AppPage>
      <Window>
        <div className="p-8">
          <Bar
            icon={<Share2 size={20} strokeWidth={NAV_STROKE} />}
            title="Access follows your teams"
            body={`A file made in Knohow is shared with its team${topLeaders.length ? ` and ${names(topLeaders)}` : ""} the moment it exists, and the team keeps ownership. Nobody waits on a request.`}
          />

          {data?.suggestions.length ? (
            <>
              <SectionHeading
                className="mt-10"
                title="Waiting for you"
                detail="Files you made outside Knohow. Share them the way Knohow would have?"
              />
              <ul className="mt-4 flex flex-col gap-2">
                {data.suggestions.map((s) => {
                  const recipients = s.recipient_ids.map((id) => people.get(id));
                  return (
                    <li
                      key={s.id}
                      className={`${satoshi.className} flex flex-wrap items-center gap-4 rounded-[20px] bg-[var(--app-muted)] p-4`}
                    >
                      <FileIcon mimeType={s.mime_type} />
                      <span className="min-w-[14rem] flex-1">
                        <span className="block text-[0.9375rem] text-[#1c1917]">{s.title}</span>
                        <span className="block text-[0.8125rem] text-[var(--app-dim)]">
                          {describeFile(s.mime_type).label}
                          {s.modified_at ? ` · ${editedAgo(s.modified_at)}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="flex -space-x-1.5">
                          {recipients.slice(0, 3).map((p) =>
                            p ? (
                              <span key={p.id} className="rounded-full ring-2 ring-[var(--app-muted)]">
                                <PersonAvatar identity={p.email} label={p.name} size={22} />
                              </span>
                            ) : null,
                          )}
                        </span>
                        <span className="text-[0.8125rem] text-[var(--app-dim)]">
                          With {names(recipients)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === s.file_id}
                          onClick={() => void decide(s.file_id, false)}
                        >
                          Not now
                        </Button>
                        <Button size="sm" disabled={busy === s.file_id} onClick={() => void decide(s.file_id, true)}>
                          {busy === s.file_id ? "Sharing…" : "Share"}
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          <SectionHeading
            className="mt-10"
            title="Team rules"
            detail="What happens to a new file, by the team that made it."
          />
          {!data ? (
            <SkeletonRows rows={3} />
          ) : data.teams.length === 0 ? (
            <EmptyState
              icon="share"
              title="No teams yet"
              description="Rules follow your teams. Add teams in Manage teams on Home and each gets its own."
            />
          ) : (
            <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3">
              {data.teams.map((t) => {
                const lead = t.lead_id ? people.get(t.lead_id) : undefined;
                const target = t.owner_target_id ? people.get(t.owner_target_id) : undefined;
                return (
                  <section key={t.id} className="rounded-[24px] border border-[var(--app-border)] p-5">
                    <header className="flex items-center gap-3">
                      <TeamIcon name={t.name} size={36} className="shrink-0 rounded-[10px]" />
                      <div className="min-w-0">
                        <h3 className={`${sohne.className} truncate text-[1rem] tracking-tight text-[#1c1917]`}>
                          {t.name}
                        </h3>
                        <p className={`${satoshi.className} text-[0.8125rem] text-[var(--app-dim)]`}>
                          {plural(t.member_count, "person", "people")} · {plural(t.file_count, "file", "files")}
                        </p>
                      </div>
                    </header>
                    <dl className={`${satoshi.className} mt-4 flex flex-col gap-3 text-[0.875rem]`}>
                      <div>
                        <dt className="text-[0.8125rem] text-[var(--app-dim)]">New files are shared with</dt>
                        <dd className="mt-1 text-[#1c1917]">
                          Everyone on {t.name}
                          {topLeaders.length ? `, plus ${names(topLeaders)}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.8125rem] text-[var(--app-dim)]">Owned by</dt>
                        <dd className="mt-1">
                          <PersonChip person={target} />
                          {lead && target && lead.id === target.id ? (
                            <span className="ml-1 text-[0.8125rem] text-[var(--app-dim)]">(lead)</span>
                          ) : null}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4">
                      <span className={`${satoshi.className} text-[0.875rem] text-[#1c1917]`}>
                        {t.auto_own ? "Ownership moves automatically" : "Ownership moves after a review"}
                      </span>
                      <Switch
                        checked={t.auto_own}
                        disabled={!t.can_edit}
                        label={`Move ownership automatically for ${t.name}`}
                        onChange={(on) => void toggle(t.id, on)}
                      />
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          {error && data ? (
            <p className={`${satoshi.className} mt-4 text-[0.875rem] text-[#EA4335]`}>{error}</p>
          ) : null}
        </div>
      </Window>
    </AppPage>
  );
}
