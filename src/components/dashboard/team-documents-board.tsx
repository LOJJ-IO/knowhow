"use client";

import { useMemo, useState } from "react";

import { DocStatusDot } from "@/components/dashboard/doc-status-dot";
import { DocTypeIcon } from "@/components/dashboard/doc-type-icon";
import { Input } from "@/components/ui/input";

type DocOwner = { id: string; name: string };
type DocRow = {
  id: string;
  title: string;
  createdAt: Date;
  sharedWithOwner: boolean;
  owner: DocOwner;
};

type Columns = { DOC: DocRow[]; SHEET: DocRow[]; SLIDE: DocRow[] };

const COLUMN_META = {
  DOC: { label: "Docs", product: "Google Docs" },
  SHEET: { label: "Sheets", product: "Google Sheets" },
  SLIDE: { label: "Slides", product: "Google Slides" },
} as const;

const TIMEFRAMES = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
] as const;

function withinTimeframe(date: Date, days: string) {
  if (days === "all") return true;
  const cutoff = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
  return date.getTime() >= cutoff;
}

export function TeamDocumentsBoard({
  columns,
  owners,
}: {
  columns: Columns;
  owners: DocOwner[];
}) {
  const [ownerId, setOwnerId] = useState("all");
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]["value"]>("all");
  const [query, setQuery] = useState<Record<keyof Columns, string>>({
    DOC: "",
    SHEET: "",
    SLIDE: "",
  });

  const filtered = useMemo(() => {
    const apply = (rows: DocRow[], search: string) =>
      rows.filter(
        (row) =>
          (ownerId === "all" || row.owner.id === ownerId) &&
          withinTimeframe(row.createdAt, timeframe) &&
          row.title.toLowerCase().includes(search.toLowerCase())
      );

    return {
      DOC: apply(columns.DOC, query.DOC),
      SHEET: apply(columns.SHEET, query.SHEET),
      SLIDE: apply(columns.SLIDE, query.SLIDE),
    };
  }, [columns, ownerId, timeframe, query]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {(Object.keys(COLUMN_META) as (keyof Columns)[]).map((key) => {
        const meta = COLUMN_META[key];
        const rows = filtered[key];

        return (
          <div key={key} className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <DocTypeIcon type={key} className="size-5 rounded-sm [&_svg]:size-3" />
                Recent {meta.label}
              </div>
              <span className="text-xs text-muted-foreground">{meta.product}</span>
            </div>

            <div className="space-y-2 border-b border-border p-2.5">
              <Input
                placeholder={`Search ${meta.label.toLowerCase()}`}
                value={query[key]}
                onChange={(e) => setQuery((prev) => ({ ...prev, [key]: e.target.value }))}
                className="h-8 text-xs"
              />
              <div className="flex gap-1.5">
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="h-7 flex-1 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                >
                  <option value="all">Team Leader</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as typeof timeframe)}
                  className="h-7 flex-1 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                >
                  {TIMEFRAMES.map((tf) => (
                    <option key={tf.value} value={tf.value}>
                      {tf.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ul className="max-h-80 overflow-y-auto">
              {rows.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">No documents</li>
              ) : (
                rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-2.5 border-b border-border px-3 py-2 text-sm last:border-b-0"
                  >
                    <DocTypeIcon type={key} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{row.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.owner.name} · {row.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <DocStatusDot sharedWithOwner={row.sharedWithOwner} />
                  </li>
                ))
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
