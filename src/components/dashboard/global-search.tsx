"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { searchAllDocuments } from "@/app/(app)/dashboard/actions";
import { DocTypeIcon, type DocTypeKey } from "@/components/dashboard/doc-type-icon";
import { Input } from "@/components/ui/input";

type Hit = {
  id: string;
  title: string;
  type: DocTypeKey;
  ownerName: string;
  folder: string;
  createdAt: string;
};

export function GlobalSearch({ placeholder = "Search every document in your Workspace…" }: { placeholder?: string }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const handle = setTimeout(async () => {
      setSearching(true);
      const results = (await searchAllDocuments(q)) as Hit[];
      setHits(results);
      setOpen(true);
      setSearching(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative max-w-xl">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) {
            setHits([]);
            setOpen(false);
          }
        }}
        onFocus={() => query.trim() && setOpen(true)}
        placeholder={placeholder}
        className="h-9 rounded-full bg-card pl-9"
        aria-label="Search documents"
      />

      {open ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {searching ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No documents match “{query.trim()}”.
            </p>
          ) : (
            <ul>
              {hits.map((hit) => (
                <li
                  key={hit.id}
                  className="flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-b-0"
                >
                  <DocTypeIcon type={hit.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-popover-foreground">{hit.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {hit.ownerName} · Drive › {hit.folder} ·{" "}
                      {new Date(hit.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
