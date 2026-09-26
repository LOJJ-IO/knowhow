"use client";

import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  Plus,
  UserPlus,
  UserRoundCog,
  Users,
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

/** The pop between two glyphs. Both stay mounted and only their scale and
 *  opacity move, so it can't get stuck.
 *
 *  It used to key-swap them through `AnimatePresence` (user 2026-09-26:
 *  "when I hover on the sidebar icons they either disappear or shrink", and
 *  buttons needing two clicks). A fast in-out interrupted the exit mid-way
 *  and left a glyph half-scaled or invisible, and a press that landed during
 *  the swap started on an element that was removed before pointerup, so the
 *  browser never dispatched the click. `pointer-events-none` also makes the
 *  press always start on the control itself. */
export function GlyphSwap({
  open,
  size,
  rest,
  hover,
}: {
  open: boolean;
  size: number;
  rest: ReactNode;
  hover: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {[
        { key: "rest", glyph: rest, shown: !open },
        { key: "hover", glyph: hover, shown: open },
      ].map(({ key, glyph, shown }) => (
        <motion.span
          key={key}
          initial={false}
          animate={{ scale: shown ? 1 : 0.5, opacity: shown ? 1 : 0 }}
          transition={POP}
          className="absolute inset-0 flex items-center justify-center"
        >
          {glyph}
        </motion.span>
      ))}
    </span>
  );
}

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
    <GlyphSwap open={open} size={size} rest={morph.rest} hover={morph.hover} />
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

/** Log out, which moves rather than swaps (user 2026-09-22): the door stays
 *  put and the arrow steps through it. Same spring as the gear's turn, since
 *  both travel rather than land.
 *
 *  Drawn here instead of using lucide's `LogOut` component because only the
 *  arrow may move — the icon is three paths and two of them are the doorway.
 *  Geometry is lucide's own (log-out, 24×24, MIT). */
export function LogOutIcon({
  open,
  size = 22,
}: {
  open: boolean;
  size?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={NAV_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block shrink-0"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <motion.g
        animate={{ x: open ? 3 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </motion.g>
    </svg>
  );
}

/** "Add another account": a plus that becomes a person being added. */
export function AddAccountIcon({
  open,
  size = 20,
}: {
  open: boolean;
  size?: number;
}) {
  return (
    <GlyphSwap
      open={open}
      size={size}
      rest={<Plus size={size} strokeWidth={NAV_STROKE} />}
      hover={<UserPlus size={size} strokeWidth={NAV_STROKE} />}
    />
  );
}

/** "Manage accounts": the accounts, then the cog that manages them. */
export function ManageAccountsIcon({
  open,
  size = 20,
}: {
  open: boolean;
  size?: number;
}) {
  return (
    <GlyphSwap
      open={open}
      size={size}
      rest={<Users size={size} strokeWidth={NAV_STROKE} />}
      hover={<UserRoundCog size={size} strokeWidth={NAV_STROKE} />}
    />
  );
}

/** A caret that leans the way it points while the row is hovered: the same
 *  gesture as the morphs, but a travel rather than a swap, because a caret
 *  has nothing to become. `direction` is where it points. */
export function CaretIcon({
  open,
  direction,
  size = 16,
}: {
  open: boolean;
  direction: "left" | "down";
  size?: number;
}) {
  const Glyph = direction === "left" ? ChevronLeft : ChevronDown;
  return (
    <motion.span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      animate={
        direction === "left" ? { x: open ? -3 : 0 } : { y: open ? 3 : 0 }
      }
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Glyph size={size} strokeWidth={NAV_STROKE + 0.25} />
    </motion.span>
  );
}
