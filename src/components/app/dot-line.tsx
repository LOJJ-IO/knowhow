"use client";

import { Fragment, type ReactNode } from "react";
import { Plus } from "lucide-react";

import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";

/** What happened, who did it and where, in the dot style (Ronald
 *  2026-10-04): "Document created · (avatar) Alex Morgan · (icon)
 *  Engineering". Several teams fold into "Multiple teams" behind their icons
 *  overlapped like the org chart's member stack: three at most, then a
 *  circle with only a plus (Ronald 2026-10-04), so it stays one line.
 *  Shared by Notifications' team rows and the toasts so the two read the
 *  same. Sizes and colours follow the surrounding text. */
export function DotLine({
  what,
  person,
  teams,
  iconSize = 16,
  tone = "light",
}: {
  what?: ReactNode;
  person?: { identity: string; name: string } | null;
  teams: { id: string; name: string }[];
  iconSize?: number;
  /** The surface it sits on: the overlap rings match it. */
  tone?: "light" | "dark";
}) {
  const ring = tone === "dark" ? "ring-2 ring-[#333]" : "ring-2 ring-white";
  const parts: ReactNode[] = [];
  if (what) parts.push(<span>{what}</span>);
  if (person)
    parts.push(
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <PersonAvatar
          identity={person.identity}
          label={person.name}
          size={iconSize}
        />
        <span>{person.name}</span>
      </span>,
    );
  if (teams.length === 1)
    parts.push(
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <TeamIcon name={teams[0].name} size={iconSize} />
        <span>{teams[0].name}</span>
      </span>,
    );
  else if (teams.length > 1)
    parts.push(
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="flex">
          {teams.slice(0, 3).map((t, i) => (
            <TeamIcon
              key={t.id}
              name={t.name}
              size={iconSize}
              className={i > 0 ? `-ml-1 ${ring}` : undefined}
            />
          ))}
          {teams.length > 3 ? (
            <span
              aria-hidden
              className={`-ml-1 grid shrink-0 place-items-center rounded-full ${ring} ${tone === "dark" ? "bg-[#57534e] text-white" : "bg-[var(--app-active)] text-[#1c1917]"}`}
              style={{ width: iconSize, height: iconSize }}
            >
              <Plus size={Math.round(iconSize * 0.6)} strokeWidth={2.5} />
            </span>
          ) : null}
        </span>
        <span>Multiple teams</span>
      </span>,
    );

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <span aria-hidden>·</span> : null}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
