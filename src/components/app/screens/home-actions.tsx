"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play } from "lucide-react";

import { Button } from "@/components/app/button";
import { NAV_STROKE } from "@/components/app/icon";
import { TeamIcon } from "@/components/identity/team-icon";
import { cn } from "@/lib/utils";

/** The two controls in the top right of Home (user 2026-09-22).
 *
 *  Both are `secondary` in the button taxonomy ([[0020-button-taxonomy]]):
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

/** The **icon** wears the colour of what it plays, and only while it is
 *  playing it (user 2026-09-22): a light that is on during the run, not a
 *  green button sitting there. The label stays ink — colouring the whole
 *  control made it read as a state the screen was in. */
const PLAY_TONE = "text-[var(--app-play)]";

const POP = { type: "spring", stiffness: 600, damping: 25 } as const;

/** Replays the day's updates: the pulses travelling up each changed team's
 *  connector, from the start, staggered as they were the first time.
 *
 *  The icon is the user's supplied Play/Pause morph on its 600/25 spring,
 *  driven by **the run and nothing else** (user 2026-09-22): Play at rest,
 *  Pause while a replay is travelling, back to Play when the last pulse
 *  lands. The hover swap it also had was removed — with the run driving the
 *  glyph, a pointer that changed it too was saying something that wasn't
 *  true.
 *
 *  Pressing it restarts the pulses rather than resuming them, because "again"
 *  is the point: a replay picking up halfway would show what was left, not
 *  the window. The label says which button this is; the glyph is the gesture. */
export function ReplayUpdatesButton({
  playing,
  running,
  onToggle,
  windowLabel,
}: {
  playing: boolean;
  /** A replay is in flight. Green for exactly this long. */
  running: boolean;
  onToggle: () => void;
  /** How far back the updates being played reach — "last hour", "last 6
   *  hours", and so on. Null when nothing has happened at all. */
  windowLabel: string | null;
}) {
  return (
    <Button
      variant="secondary"
      onClick={onToggle}
      aria-label={
        windowLabel
          ? `${playing ? "Stop" : "Replay"} updates from the ${windowLabel}`
          : "No recent updates to replay"
      }
      title={windowLabel ? `Updates from the ${windowLabel}` : "No updates yet"}
      className={cn("gap-2.5", ON_CANVAS)}
    >
      <span
        className={cn(
          "relative flex size-[18px] shrink-0 items-center justify-center transition-colors duration-150",
          running && PLAY_TONE,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={running ? "pause" : "play"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={POP}
            className="absolute inset-0 flex items-center justify-center"
          >
            {running ? (
              <Pause size={18} strokeWidth={NAV_STROKE} />
            ) : (
              <Play size={18} strokeWidth={NAV_STROKE} />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      Recent updates
    </Button>
  );
}

/** Manage teams. The teams themselves are the icon: their generated marks
 *  overlapped into a stack, the way a shared-with row shows its people.
 *
 *  **Disabled on purpose** (user 2026-09-22): the button was asked for, the
 *  screen behind it has not been specified, and a control that opens nothing
 *  is worse than one that says it isn't ready yet. */
export function ManageTeamsButton({ teams }: { teams: { name: string }[] }) {
  return (
    <Button
      variant="secondary"
      disabled
      title="Not built yet"
      className={cn("gap-2.5 pl-2", ON_CANVAS)}
    >
      <span className="flex shrink-0 items-center">
        {/* Three at most: a fourth reads as a crowd rather than a stack. */}
        {teams.slice(0, 3).map((team, i) => (
          <TeamIcon
            key={team.name}
            name={team.name}
            size={22}
            className={i === 0 ? "" : "-ml-2 ring-2 ring-[var(--app-active)]"}
          />
        ))}
      </span>
      Manage teams
    </Button>
  );
}
