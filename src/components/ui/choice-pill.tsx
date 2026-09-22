"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A selectable pill. A primitive: it renders a choice and reports a click.
 *  Picking one is never a screen's action — the screen's single button is. */
export function ChoicePill({
  label,
  selected,
  leading,
  onClick,
}: {
  label: string;
  selected: boolean;
  /** Something small before the label — a team's generated icon, normally. */
  leading?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-fit max-w-[min(70%,24ch)] shrink-0 cursor-pointer items-center gap-2 rounded-full border text-[0.85rem] font-bold transition-transform duration-150 active:scale-95",
        leading ? "pr-3.5 pl-1.5" : "px-3.5",
        selected
          ? "border-[#1c1917] bg-[#1c1917] text-white"
          : "border-[#d9d9de] bg-white text-[#1c1917]",
      )}
    >
      {leading}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
