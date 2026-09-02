import { CornerDownRight, Folder } from "lucide-react";

import type { FolderRoutingEntry } from "@/lib/queries";

/**
 * The "file chart": shows that documents land in the right Drive folder by
 * themselves — Tim from Marketing creates a doc, it's filed under Marketing.
 */
export function FolderRoutingPanel({ entries }: { entries: FolderRoutingEntry[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Drive auto-filing</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Every new file is routed to its team&apos;s Drive folder automatically — no
        manual moving, no lost documents.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {entries.map((entry) => (
          <div key={entry.folder} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gblue/15 text-gblue">
                <Folder className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  Drive › {entry.folder}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.docCount} {entry.docCount === 1 ? "file" : "files"}
                </p>
              </div>
            </div>
            {entry.latest ? (
              <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
                <CornerDownRight className="mt-0.5 size-3 shrink-0" />
                <span className="min-w-0 truncate">
                  “{entry.latest.title}” — {entry.latest.ownerName}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground/70">No files routed yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
