"use client";

import { createContext, useContext, useMemo } from "react";

import { PERSON_PALETTE } from "@/lib/identity/palette";
import type { OverviewMember, OverviewTeam } from "@/lib/organization";

/** Email (lowercased) → orb colour, for everyone in the org. */
const AvatarColorsContext = createContext<ReadonlyMap<string, string> | null>(
  null,
);

/** Hands out avatar colours across the whole org (user 2026-10-02: "no
 *  variety"). Colours from email alone clumped: Acme's 27 people drew violet
 *  eight times. Here they go round `PERSON_PALETTE` in turn, **team by team**,
 *  so every colour is used about equally and nobody on a team shares a
 *  teammate's colour (up to ten members). A person in several teams keeps the
 *  colour from the first; people in no team come last. One colour per person
 *  for the whole app, so the same face matches in every list. The trade: a
 *  person's colour can shift when someone joins or leaves ahead of them. */
export function AvatarColorsProvider({
  teams,
  members,
  children,
}: {
  teams: OverviewTeam[] | undefined;
  members: OverviewMember[] | undefined;
  children: React.ReactNode;
}) {
  const colors = useMemo(() => {
    const map = new Map<string, string>();
    if (!members) return map;
    const emailById = new Map(members.map((m) => [m.id, m.email.toLowerCase()]));
    let next = 0;
    const assign = (email: string | undefined) => {
      if (!email || map.has(email)) return;
      map.set(email, PERSON_PALETTE[next % PERSON_PALETTE.length]);
      next += 1;
    };
    // In each team's own order, the order its card lists them in.
    for (const team of teams ?? []) {
      for (const id of team.memberIds) assign(emailById.get(id));
    }
    for (const m of members) assign(m.email.toLowerCase());
    return map;
  }, [teams, members]);

  return (
    <AvatarColorsContext.Provider value={colors}>
      {children}
    </AvatarColorsContext.Provider>
  );
}

/** This person's colour in the current org, or `undefined` outside one. */
export function useAvatarColor(identity: string): string | undefined {
  return useContext(AvatarColorsContext)?.get(identity.trim().toLowerCase());
}
