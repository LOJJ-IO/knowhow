"use client";

import { Search as SearchIcon, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/app/badge";
import { EmptyState } from "@/components/app/empty-state";
import { describeFile, editedAgo, FileIcon } from "@/components/app/file-meta";
import { NAV_STROKE } from "@/components/app/icon";
import { PersonChip, Tabs, TeamChip, Window, message, plural } from "@/components/app/screen-kit";
import { AppPage } from "@/components/app/shell";
import { useUpdates } from "@/components/app/updates";
import { satoshi } from "@/components/brand/fonts";
import { searchFiles, type SearchResult } from "@/lib/governance";
import { cn } from "@/lib/utils";

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

/** Search: one box over every file your teams own, read live from Drive
 *  (titles and contents), filtered to what you're allowed to see. */
export function SearchScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { overview } = useUpdates();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searched, setSearched] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<Kind>("all");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  // Debounced: search as you type, once you pause.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const body = await searchFiles(q);
        setResults(body.results);
        setSearched(q);
        setError("");
        router.replace(`/search?q=${encodeURIComponent(q)}`, { scroll: false });
      } catch (e) {
        setError(message(e));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, router]);

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

  const shown = useMemo(() => (query.trim() ? results ?? [] : []), [query, results]);
  const counts = useMemo(() => {
    const c: Record<Kind, number> = { all: shown.length, doc: 0, sheet: 0, slides: 0, other: 0 };
    for (const r of shown) c[KIND_OF[r.file_type] ?? "other"]++;
    return c;
  }, [shown]);
  const filtered = shown.filter((r) => kind === "all" || (KIND_OF[r.file_type] ?? "other") === kind);

  return (
    <AppPage>
      <Window>
        <div className="p-8">
          <label
            className={cn(
              `${satoshi.className} flex h-14 items-center gap-3 rounded-[16px] border bg-white px-5 transition-[border-color]`,
              "border-[#d9d9de] focus-within:border-[#1c1917]",
            )}
          >
            <SearchIcon size={20} strokeWidth={NAV_STROKE} className="shrink-0 text-[var(--app-dim)]" />
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setResults(null);
              }}
              placeholder="Search every file your teams own"
              aria-label="Search"
              className="min-w-0 flex-1 bg-transparent text-[1.0625rem] text-[#1c1917] outline-none placeholder:text-[var(--app-dim)]"
            />
            {loading ? (
              <span className="text-[0.8125rem] text-[var(--app-dim)]">Searching…</span>
            ) : query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setResults(null);
                  router.replace("/search", { scroll: false });
                  input.current?.focus();
                }}
                className="cursor-pointer rounded-full p-1 text-[var(--app-dim)] hover:text-[#1c1917]"
              >
                <X size={16} strokeWidth={NAV_STROKE} />
              </button>
            ) : null}
          </label>

          {error ? (
            <EmptyState icon="search" title="Search didn't work" description={error} />
          ) : !query.trim() ? (
            <EmptyState
              icon="search"
              title="Find anything your teams own"
              description="Searches file names and what's inside them, across every team you can see. Private files stay with their owner and leads."
            />
          ) : results && shown.length === 0 && !loading ? (
            <EmptyState
              icon="search"
              title={`Nothing matches "${searched || query.trim()}"`}
              description="Try another word, or something you'd expect inside the file."
            />
          ) : results ? (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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
              <ul className="mt-4 flex flex-col">
                {filtered.map((r) => {
                  const owner =
                    (r.owner_id && members.byId.get(r.owner_id)) ||
                    (r.owner_email && members.byEmail.get(r.owner_email.toLowerCase())) ||
                    undefined;
                  return (
                    <li
                      key={r.file_id}
                      className="grid grid-cols-[minmax(0,1fr)_11rem_12rem] items-center gap-4 rounded-[14px] px-3 py-3 hover:bg-[var(--app-muted)] max-[900px]:grid-cols-[minmax(0,1fr)_12rem]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <FileIcon mimeType={r.file_type} size={36} />
                        <span className={`${satoshi.className} min-w-0`}>
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[0.9375rem] text-[#1c1917]" title={r.title}>
                              <Highlight text={r.title} query={searched} />
                            </span>
                            {r.company ? null : <Badge>Only you</Badge>}
                          </span>
                          <span className="block text-[0.8125rem] text-[var(--app-dim)]">
                            {describeFile(r.file_type).label}
                            {r.modified_at ? ` · ${editedAgo(r.modified_at)}` : ""}
                          </span>
                        </span>
                      </span>
                      <span className="min-w-0 max-[900px]:hidden">
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
          ) : null}
        </div>
      </Window>
    </AppPage>
  );
}
