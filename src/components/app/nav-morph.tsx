"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CircleHelp,
  MessageCircleQuestion,
  Settings,
  Folder,
  FolderOpen,
  Link,
  Send,
  Shield,
  ShieldCheck,
  User,
  UserX,
} from "lucide-react";
import type { ReactNode } from "react";

import { CODICONS, NAV_STROKE } from "@/components/app/icon";

/** Nav icons that change while their row is hovered.
 *
 *  One pattern, supplied by the user (2026-09-22): the resting icon scales out
 *  as the hovered one scales in, on a stiff spring, so the row's icon reads as
 *  the same object doing something — the folder opens, the house lights up,
 *  the link becomes a send. Colour never changes, on any row: Offboarding was
 *  tried in `--app-danger` and taken back out (user 2026-09-22). The glyph
 *  carries the meaning.
 *
 *  Pairs live here rather than in `nav-icons.ts` because they are components,
 *  and that module is imported by Server Components. */
const POP = { type: "spring", stiffness: 600, damping: 25 } as const;

/** Home's pair is the codicon house with its doorway empty, then filled —
 *  lucide has no open-house counterpart, and the codicon's own path leaves the
 *  doorway as a void (x 6→10, y 8.5→13), so the fill lands exactly in it. */
const HOUSE_DOOR = "M6 13V10A1.5 1.5 0 0 1 7.5 8.5H8.5A1.5 1.5 0 0 1 10 10V13Z";

function House({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="100%" height="100%" fill="currentColor">
      <path d={CODICONS.home} />
      {lit ? <path d={HOUSE_DOOR} /> : null}
    </svg>
  );
}

/** Route → what the icon does on hover. A route with no entry keeps its
 *  static icon. */
export const NAV_MORPH: Record<string, { rest: ReactNode; hover: ReactNode }> =
  {
    "/home": {
      rest: <House lit={false} />,
      hover: <House lit />,
    },
    "/workspace": {
      rest: <Folder size="100%" strokeWidth={NAV_STROKE} />,
      hover: <FolderOpen size="100%" strokeWidth={NAV_STROKE} />,
    },
    "/ownership": {
      rest: <Shield size="100%" strokeWidth={NAV_STROKE} />,
      hover: <ShieldCheck size="100%" strokeWidth={NAV_STROKE} />,
    },
    "/sharing": {
      rest: <Link size="100%" strokeWidth={NAV_STROKE} />,
      hover: <Send size="100%" strokeWidth={NAV_STROKE} />,
    },
    "/help": {
      rest: <CircleHelp size="100%" strokeWidth={NAV_STROKE} />,
      hover: <MessageCircleQuestion size="100%" strokeWidth={NAV_STROKE} />,
    },
    "/offboarding": {
      rest: <User size="100%" strokeWidth={NAV_STROKE} />,
      hover: <UserX size="100%" strokeWidth={NAV_STROKE} />,
    },
  };

export function MorphIcon({
  href,
  open,
  size = 22,
}: {
  href: string;
  open: boolean;
  size?: number;
}) {
  const morph = NAV_MORPH[href];
  if (!morph) return null;

  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={open ? "hover" : "rest"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={POP}
          className="absolute inset-0 flex items-center justify-center"
        >
          {open ? morph.hover : morph.rest}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Settings, which turns rather than swaps (pattern supplied by the user
 *  2026-09-22): a gear's own affordance is that it rotates, so a second glyph
 *  would be saying the same thing twice. Half a turn on a looser spring than
 *  the pops above, since it travels rather than lands. */
export function SettingsIcon({
  open,
  size = 22,
}: {
  open: boolean;
  size?: number;
}) {
  return (
    <motion.span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Settings size={size} strokeWidth={NAV_STROKE} />
    </motion.span>
  );
}
