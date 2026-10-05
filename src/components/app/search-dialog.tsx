"use client";

import { useEffect, useMemo, useState } from "react";

import { AppDialog } from "@/components/app/dialog";
import { Badge } from "@/components/app/badge";
import { EmptyState } from "@/components/app/empty-state";
import { describeFile, editedAgo, FileIcon } from "@/components/app/file-meta";
import { PersonChip, Tabs, TeamChip, message, plural } from "@/components/app/screen-kit";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { searchFiles, type SearchResult } from "@/lib/governance";

type Kind = "all" | "doc" | "sheet" | "slides" | "other";

const KIND_OF: Record<string, Kind> = {
  "application/vnd.google-apps.document": "doc",
  "application/vnd.google-apps.spreadsheet": "sheet",
  "application/vnd.google-apps.presentation": "slides",
};

/** The matched words in the title, in bold. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-semibold">{text.slice(at, at + q.length)}</strong>
      {text.slice(at + q.length)}
    </>
  );
}

/** Search results, as a modal over whatever you were on (Ronald 2026-10-04:
 *  Search doesn't need its own screen). The top bar's field opens it on
 *  Enter. A little wider than the other dialogs (`lg`), with the team and
 *  owner columns sized to fit so they sit close to the title. Every file
 *  your teams own, read live from Drive (titles and contents), filtered to
 *  what you're allowed to see. */
export function SearchDialog({
  open,
  onOpenChange,
  query,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
}) {
  const { overview } = useUpdates();
  // Each answer remembers the query it was for, so a new query shows
  // "Searching…" until its own answer lands.
  const [got, setGot] = useState<{ q: string; results?: SearchResult[]; error?: string }>();
  const [kindFor, setKindFor] = useState<{ q: string; kind: Kind }>();
  const q = query.trim();
  const kind = kindFor?.q === q ? kindFor.kind : "all";
  const setKind = (k: Kind) => setKindFor({ q, kind: k });

  useEffect(() => {
    if (!open || !q) return;
    let live = true;
    searchFiles(q)
      .then((body) => live && setGot({ q, results: body.results }))
      .catch((e) => live && setGot({ q, error: message(e) }));
    return () => {
      live = false;
    };
  }, [open, q]);

  const current = got?.q === q ? got : undefined;
  const results = current?.results ?? null;
  const error = current?.error ?? "";

  const members = useMemo(() => {
    const byId = new Map<string, { name: string; email: string }>();
    const byEmail = new Map<string, { name: string; email: string }>();
    for (const m of overview?.members ?? []) {
      const p = { name: m.displayName ?? m.email.split("@")[0], email: m.email };
      byId.set(m.id, p);
      byEmail.set(m.email.toLowerCase(), p);
    }
    return { byId, byEmail };
  }, [overview]);
  const teamName = useMemo(
    () => new Map((overview?.teams ?? []).map((t) => [t.id, t.name])),
    [overview],
  );

  const shown = useMemo(() => results ?? [], [results]);
  const counts = useMemo(() => {
    const c: Record<Kind, number> = { all: shown.length, doc: 0, sheet: 0, slides: 0, other: 0 };
    for (const r of shown) c[KIND_OF[r.file_type] ?? "other"]++;
    return c;
  }, [shown]);
  const filtered = shown.filter((r) => kind === "all" || (KIND_OF[r.file_type] ?? "other") === kind);

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`"${query.trim()}"`}
      size="lg"
    >
      {error ? (
        <EmptyState icon="search" title="Search didn't work" description={error} />
      ) : !results ? (
        <p className={`${satoshi.className} py-6 text-[0.875rem] text-[var(--app-dim)]`}>
          Searching…
        </p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon="search"
          title={`Nothing matches "${query.trim()}"`}
          description="Try another word, or something you'd expect inside the file."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>
              {plural(shown.length, "result", "results")}
            </p>
            <Tabs
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "doc", label: "Docs", count: counts.doc },
                { value: "sheet", label: "Sheets", count: counts.sheet },
                { value: "slides", label: "Slides", count: counts.slides },
                ...(counts.other ? [{ value: "other" as Kind, label: "Other", count: counts.other }] : []),
              ]}
            />
          </div>
          <ul className="-mx-3 mt-4 flex flex-col">
            {filtered.map((r) => {
              const owner =
                (r.owner_id && members.byId.get(r.owner_id)) ||
                (r.owner_email && members.byEmail.get(r.owner_email.toLowerCase())) ||
                undefined;
              return (
                <li
                  key={r.file_id}
                  className="grid grid-cols-[minmax(0,1fr)_9rem_9rem] items-center gap-4 rounded-[14px] px-3 py-3 hover:bg-[var(--app-muted)] max-[640px]:grid-cols-[minmax(0,1fr)_9rem]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <FileIcon mimeType={r.file_type} size={36} />
                    <span className={`${satoshi.className} min-w-0`}>
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[0.9375rem] text-[#1c1917]" title={r.title}>
                          <Highlight text={r.title} query={query} />
                        </span>
                        {r.company ? null : <Badge>Only you</Badge>}
                      </span>
                      <span className="block text-[0.8125rem] text-[var(--app-dim)]">
                        {describeFile(r.file_type).label}
                        {r.modified_at ? ` · ${editedAgo(r.modified_at)}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="min-w-0 max-[640px]:hidden">
                    {r.team_id ? (
                      <TeamChip name={teamName.get(r.team_id) ?? "Team"} />
                    ) : (
                      <span className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>
                        {r.company ? "Company-wide" : "Your Drive"}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <PersonChip person={owner} />
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AppDialog>
  );
}
