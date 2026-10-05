"use client";

import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/app/badge";
import { Button } from "@/components/app/button";
import { FormDialog } from "@/components/app/dialog";
import { EmptyState } from "@/components/app/empty-state";
import { FileIcon } from "@/components/app/file-meta";
import { NAV_STROKE } from "@/components/app/icon";
import {
  Bar,
  SectionHeading,
  SkeletonRows,
  Tabs,
  Window,
  message,
  plural,
} from "@/components/app/screen-kit";
import { useSession } from "@/components/app/session";
import { AppPage } from "@/components/app/shell";
import { TitleAside, TitleHelp } from "@/components/app/title-aside";
import { useUpdates } from "@/components/app/updates";
import { LIBRARIAN_GROUPS, LibrarianPopup } from "@/components/app/notification-center";
import { satoshi } from "@/components/brand/fonts";
import { PersonAvatar } from "@/components/identity/person-avatar";
import {
  fetchOffboarding,
  offboard,
  peopleById,
  previewOffboarding,
  type ActivePerson,
  type Offboarding,
  type PreviewFile,
} from "@/lib/governance";
import { cn } from "@/lib/utils";


/** Offboarding: everyone on a team, and for whoever is leaving, one move
 *  that hands their files to someone who's staying, before access ends. */
export function OffboardingScreen() {
  const { chrome } = useSession();
  const { refresh: refreshUpdates, reloadTasks, dismissUpdate } = useUpdates();
  const org = chrome.organizationId;
  const [data, setData] = useState<Offboarding | null>(null);
  const [error, setError] = useState("");
  const [team, setTeam] = useState("all");
  const [leaving, setLeaving] = useState<ActivePerson | null>(null);
  const [done, setDone] = useState<{ name: string; moved: number; to: string; stuck: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await fetchOffboarding(org));
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

  const teamName = useMemo(() => new Map((data?.teams ?? []).map((t) => [t.id, t.name])), [data]);
  const shown = (data?.active ?? [])
    .filter((p) => team === "all" || p.team_ids.includes(team))
    .sort((a, b) => Number(b.is_owner) - Number(a.is_owner) || a.name.localeCompare(b.name));

  if (error && !data)
    return (
      <AppPage>
        <Window>
          <EmptyState icon="person_remove" title="Couldn't load your people" description={error} />
        </Window>
      </AppPage>
    );

  return (
    <AppPage>
      <LibrarianPopup kinds={LIBRARIAN_GROUPS[3].kinds} onAction={(task) => dismissUpdate(task.id)} />
      <TitleAside>
        <TitleHelp label="About Offboarding">
          <p>
            Pick who takes over and their files move in one step. Nothing is deleted.
          </p>
        </TitleHelp>
      </TitleAside>
      <Window>
        <div className="p-8">
          {done ? (
            <Bar
              icon={<Check size={20} strokeWidth={NAV_STROKE} />}
              title={`${done.name} is offboarded`}
              body={`${plural(done.moved, "file", "files")} moved to ${done.to}.${done.stuck ? ` ${plural(done.stuck, "file needs", "files need")} moving by hand, listed under Ownership.` : ""}`}
            >
              <Button variant="ghost" onClick={() => setDone(null)}>
                Dismiss
              </Button>
            </Bar>
          ) : null}
          {/* "When someone leaves" is the title's `?`, and "Already
              offboarded" is in Notifications under Librarian (Ronald
              2026-10-04). */}

          <SectionHeading
            className={done ? "mt-10" : undefined}
            title="People"
            detail={data ? plural(data.active.length, "person on a team", "people on a team") : undefined}
          />
          {data ? (
            <Tabs
              className="mt-4"
              value={team}
              onChange={setTeam}
              options={[
                { value: "all", label: "Everyone", count: data.active.length },
                ...data.teams.map((t) => ({
                  value: t.id,
                  label: t.name,
                  count: data.active.filter((p) => p.team_ids.includes(t.id)).length,
                })),
              ]}
            />
          ) : null}

          {!data ? (
            <SkeletonRows />
          ) : (
            <ul className="mt-4 flex flex-col">
              {shown.map((p) => (
                <li
                  key={p.id}
                  className="grid grid-cols-[minmax(0,1fr)_14rem_7rem_7rem] items-center gap-4 rounded-[14px] px-3 py-2.5 hover:bg-[var(--app-muted)] max-[900px]:grid-cols-[minmax(0,1fr)_7rem_7rem]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <PersonAvatar identity={p.email} label={p.name} size={32} />
                    <span className={`${satoshi.className} min-w-0`}>
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[0.9375rem] text-[#1c1917]">{p.name}</span>
                        {p.is_owner ? <Badge>Owner</Badge> : null}
                        {p.leads_team_ids.length ? <Badge>Lead</Badge> : null}
                        {p.personal ? <Badge>Personal account</Badge> : null}
                      </span>
                      <span className="block truncate text-[0.8125rem] text-[var(--app-dim)]">{p.email}</span>
                    </span>
                  </span>
                  <span className={`${satoshi.className} truncate text-[0.875rem] text-[var(--app-dim)] max-[900px]:hidden`}>
                    {p.team_ids.map((id) => teamName.get(id)).filter(Boolean).join(", ") || "Company-wide"}
                  </span>
                  <span className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)] tabular-nums`}>
                    {plural(p.files_owned, "file", "files")}
                  </span>
                  <span className="flex justify-end">
                    {p.can_offboard ? (
                      <Button variant="outline" size="sm" onClick={() => setLeaving(p)}>
                        Offboard
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}

        </div>
      </Window>

      {leaving && data ? (
        <OffboardDialog
          org={org}
          person={leaving}
          data={data}
          onClose={() => setLeaving(null)}
          onDone={async (result) => {
            setLeaving(null);
            setDone(result);
            await refresh();
            refreshUpdates();
            reloadTasks();
          }}
        />
      ) : null}
    </AppPage>
  );
}

/** The default heir: the lead of their first team, or the owner if they lead it. */
function defaultHeir(person: ActivePerson, data: Offboarding): string | null {
  const owner = data.active.find((p) => p.is_owner);
  for (const id of person.team_ids) {
    const lead = data.teams.find((t) => t.id === id)?.lead_id;
    if (lead && lead !== person.id) return lead;
  }
  return owner && owner.id !== person.id ? owner.id : null;
}

function OffboardDialog({
  org,
  person,
  data,
  onClose,
  onDone,
}: {
  org: string;
  person: ActivePerson;
  data: Offboarding;
  onClose: () => void;
  onDone: (result: { name: string; moved: number; to: string; stuck: number }) => Promise<void>;
}) {
  const people = peopleById(data.people);
  const [heir, setHeir] = useState<string | null>(() => defaultHeir(person, data));
  const [files, setFiles] = useState<PreviewFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heirs = data.active.filter((p) => p.id !== person.id && !p.personal);

  useEffect(() => {
    if (!heir) return;
    let cancelled = false;
    previewOffboarding(org, person.id, heir)
      .then((body) => {
        if (!cancelled) setFiles(body.files);
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [org, person.id, heir]);

  const movable = (files ?? []).filter((f) => f.movable);
  const stuck = (files ?? []).filter((f) => !f.movable);
  const first = person.name.split(" ")[0];

  async function submit() {
    if (!heir) return;
    setBusy(true);
    setError("");
    try {
      const result = await offboard(person.id, heir);
      await onDone({
        name: person.name,
        moved: result.files.filter((f) => f.action === "ownership_transferred").length,
        to: people.get(heir)?.name ?? "their team",
        stuck: result.unresolved_count,
      });
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => (o ? null : onClose())}
      size="sm"
      title={`Offboard ${person.name}`}
      submitLabel={`Offboard ${first}`}
      busy={busy}
      disabled={!heir || files === null}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>Who takes over</p>
      <select
        value={heir ?? ""}
        onChange={(e) => {
          setFiles(null);
          setHeir(e.target.value || null);
        }}
        aria-label="Who takes over"
        className={`${satoshi.className} mt-2 h-11 w-full cursor-pointer rounded-[10px] border border-[#d9d9de] bg-white px-3 text-[0.9375rem] text-[#1c1917] outline-none focus:border-[#1c1917]`}
      >
        {heirs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.is_owner ? " (owner)" : p.leads_team_ids.length ? " (lead)" : ""}
          </option>
        ))}
      </select>

      <div className="mt-5">
        {files === null ? (
          <p className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>
            Looking through {first}&apos;s Drive…
          </p>
        ) : files.length === 0 ? (
          <p className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>
            {first} doesn&apos;t own any files. Offboarding just updates their teams.
          </p>
        ) : (
          <>
            <p className={`${satoshi.className} text-[0.875rem] text-[#1c1917]`}>
              {movable.length
                ? `${plural(movable.length, "file moves", "files move")} to ${people.get(heir ?? "")?.name}.`
                : "Nothing can move automatically."}
            </p>
            <ul className="mt-2 flex max-h-[13rem] flex-col gap-1 overflow-y-auto pr-1">
              {files.map((f) => (
                <li key={f.file_id} className="flex items-center gap-3 rounded-[12px] bg-[var(--app-muted)] px-3 py-2">
                  <FileIcon mimeType={f.mime_type} size={30} />
                  <span className={`${satoshi.className} min-w-0 flex-1 truncate text-[0.875rem] text-[#1c1917]`}>
                    {f.title}
                  </span>
                  {f.movable ? null : <Badge>By hand</Badge>}
                </li>
              ))}
            </ul>
            {stuck.length ? (
              <p className={`${satoshi.className} mt-3 text-[0.8125rem] text-[var(--app-dim)]`}>
                {plural(stuck.length, "file is", "files are")} on a personal Google account, so Google won&apos;t move{" "}
                {stuck.length === 1 ? "it" : "them"}. You&apos;ll find {stuck.length === 1 ? "it" : "them"} under Ownership.
              </p>
            ) : null}
          </>
        )}
      </div>
      {person.leads_team_ids.length && heir ? (
        <p className={cn(`${satoshi.className} mt-4 text-[0.8125rem] text-[var(--app-dim)]`)}>
          {people.get(heir)?.name} will lead {person.leads_team_ids.length === 1 ? "their team" : "their teams"}.
        </p>
      ) : null}
      {error ? <p className={`${satoshi.className} mt-3 text-[0.8125rem] text-[#EA4335]`}>{error}</p> : null}
    </FormDialog>
  );
}
