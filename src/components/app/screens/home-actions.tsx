"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/app/button";
import { AppDialog, MODAL_SWAP_MS } from "@/components/app/dialog";
import { RenameDialog } from "@/components/app/item-menu";
import { JoiningSection } from "@/components/app/joining-section";
import { NewTeamDialog } from "@/components/app/new-team-dialog";
import { RemoveTeamDialog } from "@/components/app/remove-team-dialog";
import { useSession } from "@/components/app/session";
import { TeamMembersSection } from "@/components/app/team-members-section";
import { useUpdates } from "@/components/app/updates";
import { TeamIcon } from "@/components/identity/team-icon";
import { renameTeam, type OverviewTeam } from "@/lib/organization";
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
  const [creating, setCreating] = useState(false);
  const { chrome } = useSession();
  const { refresh } = useUpdates();
  /** The team behind the menu's Rename; kept after close for the fade. */
  const [renaming, setRenaming] = useState<OverviewTeam | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  /** Bumped on each open: Rename starts from the current name. */
  const [renameOpens, setRenameOpens] = useState(0);
  /** The team behind the menu's Remove team; kept after close for the fade. */
  const [removing, setRemoving] = useState<OverviewTeam | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  /** Bumped on each open: a fresh warning, no choice carried over. */
  const [removeOpens, setRemoveOpens] = useState(0);
  /** A handoff between Manage teams and New team is under way: both keep
   *  the backdrop steady (no flash). */
  const [swapping, setSwapping] = useState(false);
  const swap = (run: () => void) => {
    setSwapping(true);
    window.setTimeout(() => {
      run();
      window.setTimeout(() => setSwapping(false), MODAL_SWAP_MS);
    }, MODAL_SWAP_MS);
  };
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
        swap={swapping}
        onOpenChange={setOpen}
        title="Manage teams"
        size="sm"
        footer={<Button onClick={() => setOpen(false)}>Close</Button>}
      >
        {/* Tabs like Notifications' (user 2026-09-27): the open one black,
            40px to what they show. Teams lists each team's members
            (`TeamMembersSection`). */}
        {/* New team sits on the far right, apart from the tabs, where
            Notifications keeps Clear all (user 2026-09-27). */}
        <div className="mb-10 flex items-center gap-2">
          <div role="tablist" className="flex items-center gap-2">
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
          {tab === "teams" ? (
            <Button
              variant="outline"
              className="group ml-auto"
              onClick={() => {
              // No overlapping dialogs: Manage teams closes, then New team
              // opens (MODAL_SWAP_MS).
              setOpen(false);
              swap(() => setCreating(true));
            }}
            >
              {/* New link's plus (joining-section.tsx). */}
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="size-4 shrink-0 transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 motion-reduce:transition-none"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
              New team
            </Button>
          ) : null}
        </div>
        <div role="tabpanel">
          {tab === "joining" ? (
            <JoiningSection />
          ) : (
            <TeamMembersSection
              onRenameTeam={(team) => {
                // Same swap as New team.
                setRenaming(team);
                setRenameOpens((n) => n + 1);
                setOpen(false);
                swap(() => setRenameOpen(true));
              }}
              onRemoveTeam={(team) => {
                // Same swap as New team: Manage teams closes, the warning
                // opens, and Manage teams comes back after.
                setRemoving(team);
                setRemoveOpens((n) => n + 1);
                setOpen(false);
                swap(() => setRemoveOpen(true));
              }}
            />
          )}
        </div>
      </AppDialog>
      {renaming ? (
        <RenameDialog
          key={renameOpens}
          title="Rename team"
          name={renaming.name}
          maxLength={255}
          open={renameOpen}
          swap={swapping}
          onClose={() => {
            setRenameOpen(false);
            swap(() => setOpen(true));
          }}
          onRename={async (name) => {
            await renameTeam(chrome.organizationId, renaming.id, name);
            refresh();
          }}
        />
      ) : null}
      <RemoveTeamDialog
        key={removeOpens}
        team={removing}
        open={removeOpen}
        swap={swapping}
        onOpenChange={(next) => {
          setRemoveOpen(next);
          if (!next) swap(() => setOpen(true));
        }}
      />
      <NewTeamDialog
        open={creating}
        swap={swapping}
        onOpenChange={(next) => {
          setCreating(next);
          // Back to Manage teams (still on Teams) once New team has closed.
          if (!next) swap(() => setOpen(true));
        }}
      />
    </>
  );
}
