"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/app/button";
import { AppDialog } from "@/components/app/dialog";
import { JoiningSection } from "@/components/app/joining-section";
import { TeamMembersSection } from "@/components/app/team-members-section";
import { TeamIcon } from "@/components/identity/team-icon";
import { cn } from "@/lib/utils";

/** The control in the top right of Home (user 2026-09-22). Recent updates sat
 *  beside it until 2026-09-27, when updates moved to Notifications and this
 *  grew into the space (size `lg`).
 *
 *  It is `secondary` in the button taxonomy ([[0020-button-taxonomy]]):
 *  standing controls that aren't what the screen is for. The screen is the
 *  chart; a filled `default` here would compete with the topbar's New, and
 *  the rule is one `default` per surface.
 *
 *  **They rest at the fill `secondary` normally reaches on hover** (user
 *  2026-09-22): sitting on the dotted canvas rather than on white, the lighter
 *  `--app-muted` read as barely there. Hover is therefore not a colour change
 *  any more — the colour is already spent — so it is a small lift instead, and
 *  the press keeps the app's scale-down. */
const ON_CANVAS =
  // Ink, not the `secondary` grey: on the canvas these are the only controls
  // there are, and grey-on-grey read as switched off (user 2026-09-22).
  "bg-[var(--app-active)] text-[#1c1917] hover:bg-[var(--app-active)] hover:scale-[1.02]";

/** Manage teams. The teams themselves are the icon: their generated marks
 *  overlapped into a stack, the way a shared-with row shows its people.
 *
 *  It opens a dialog in the Accounts shape holding Joining (auto-approve and
 *  the join link), moved here from Settings (user 2026-09-27). */
export function ManageTeamsButton({ teams }: { teams: { name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"joining" | "teams">("joining");
  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => setOpen(true)}
        className={cn("gap-3 pl-2.5", ON_CANVAS)}
      >
        <span className="flex shrink-0 items-center">
          {/* Three at most: a fourth reads as a crowd rather than a stack.
              Past three, a fourth circle holds only a plus (user 2026-09-27). */}
          {teams.slice(0, 3).map((team, i) => (
            <TeamIcon
              key={team.name}
              name={team.name}
              size={28}
              className={i === 0 ? "" : "-ml-2 ring-2 ring-[var(--app-active)]"}
            />
          ))}
          {teams.length > 3 ? (
            <span
              aria-hidden
              className="-ml-2 grid size-7 shrink-0 place-items-center rounded-full bg-white ring-2 ring-[var(--app-active)]"
            >
              <Plus className="size-3.5" strokeWidth={2.25} />
            </span>
          ) : null}
        </span>
        Manage teams
      </Button>
      <AppDialog
        open={open}
        onOpenChange={setOpen}
        title="Manage teams"
        size="sm"
        footer={
          <Button onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        {/* Tabs like Notifications' (user 2026-09-27): the open one black,
            40px to what they show. Teams lists each team's members
            (`TeamMembersSection`). */}
        <div role="tablist" className="mb-10 flex items-center gap-2">
          {(
            [
              ["joining", "Joining"],
              ["teams", "Teams"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              role="tab"
              aria-selected={tab === value}
              variant={tab === value ? "default" : "outline"}
              onClick={() => setTab(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === "joining" ? <JoiningSection /> : <TeamMembersSection />}
        </div>
      </AppDialog>
    </>
  );
}
