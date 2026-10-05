"use client";

import { Lock } from "lucide-react";

import { Badge } from "@/components/app/badge";
import { describeFile, editedAgo, FileIcon } from "@/components/app/file-meta";
import { menuAnchor, type MenuAnchor } from "@/components/app/item-menu";
import { PersonChip, TeamChip } from "@/components/app/screen-kit";
import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";

export type FileTableRow = {
  id: string;
  title: string;
  mimeType: string;
  modifiedAt: string | null;
  private?: boolean;
  /** The team's name, or null for a company-wide file. */
  teamName: string | null;
  owner: { name: string; email: string; personal?: boolean } | null | undefined;
};

const COLUMNS =
  "grid-cols-[2rem_minmax(0,1fr)_11rem_12rem] max-[900px]:grid-cols-[2rem_minmax(0,1fr)_12rem]";

/** Files as Ownership lists them: name (type · edited), team, owner. Used by
 *  Ownership and by a Workspace folder's details view (Ronald, 2026-10-04).
 *  Pass `selected` + `onToggle` to give each row a checkbox. */
export function FileTable({
  rows,
  selected,
  onToggle,
  onRowMenu,
  onRowOpen,
}: {
  rows: FileTableRow[];
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  /** A right click (or Enter) on a row, with where to open its menu. */
  onRowMenu?: (id: string, anchor: MenuAnchor) => void;
  /** A mouse click on a row: Workspace opens the file in Google (Ronald,
   *  2026-10-04). */
  onRowOpen?: (id: string) => void;
}) {
  return (
    <div className="mt-5">
      <div
        className={`${satoshi.className} grid ${COLUMNS} items-center gap-4 border-b border-[var(--app-border)] px-3 pb-2 text-[0.8125rem] text-[var(--app-dim)]`}
      >
        <span />
        <span>Name</span>
        <span className="max-[900px]:hidden">Team</span>
        <span>Owner</span>
      </div>
      {/* 4px between rows (and under the header) so selected rows read as
          separate pills, not one grey block (Ronald, 2026-10-05). */}
      <ul className="mt-1 flex flex-col gap-1">
        {rows.map((f) => {
          const on = selected?.has(f.id) ?? false;
          return (
            <li
              key={f.id}
              {...(onRowMenu
                ? {
                    tabIndex: 0,
                    "aria-haspopup": "menu" as const,
                    ...(onRowOpen ? { onClick: () => onRowOpen(f.id) } : {}),
                    onContextMenu: (e: React.MouseEvent<HTMLLIElement>) => {
                      e.preventDefault();
                      onRowMenu(f.id, menuAnchor(e));
                    },
                    onKeyDown: (e: React.KeyboardEvent<HTMLLIElement>) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowMenu(f.id, e.currentTarget);
                      }
                    },
                  }
                : {})}
              className={cn(
                `grid ${COLUMNS} items-center gap-4 rounded-[14px] px-3 py-2.5`,
                on ? "bg-[var(--app-active)]" : "hover:bg-[var(--app-muted)]",
                onRowOpen && "cursor-pointer",
                onRowMenu &&
                  "outline-none focus-visible:outline-2 focus-visible:outline-[#1c1917]",
              )}
            >
              {onToggle ? (
                <input
                  type="checkbox"
                  aria-label={`Select ${f.title}`}
                  checked={on}
                  onChange={() => onToggle(f.id)}
                  className="size-4 cursor-pointer accent-[#1c1917]"
                />
              ) : (
                <span />
              )}
              <span className="flex min-w-0 items-center gap-3">
                <FileIcon mimeType={f.mimeType} size={36} />
                <span className={`${satoshi.className} min-w-0`}>
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[0.9375rem] text-[#1c1917]" title={f.title}>
                      {f.title}
                    </span>
                    {f.private ? (
                      <Badge>
                        <Lock size={10} strokeWidth={2.2} className="mr-1" />
                        Private
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block text-[0.8125rem] text-[var(--app-dim)]">
                    {describeFile(f.mimeType).label}
                    {f.modifiedAt ? ` · ${editedAgo(f.modifiedAt)}` : ""}
                  </span>
                </span>
              </span>
              <span className="min-w-0 max-[900px]:hidden">
                {f.teamName ? (
                  <TeamChip name={f.teamName} />
                ) : (
                  <span className={`${satoshi.className} text-[0.875rem] text-[var(--app-dim)]`}>
                    Company-wide
                  </span>
                )}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <PersonChip person={f.owner} />
                {f.owner?.personal ? <Badge>Personal</Badge> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
