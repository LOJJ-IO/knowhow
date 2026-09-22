"use client";

import { cn } from "@/lib/utils";

/** A selectable pill. A primitive: it renders a choice and reports a click.
 *  Picking one is never a screen's action — the screen's single button is. */
export function ChoicePill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-fit max-w-[min(70%,24ch)] shrink-0 cursor-pointer items-center rounded-full border px-3.5 text-[0.85rem] font-bold transition-colors duration-150 active:scale-[0.98]",
        selected
          ? "border-[#1c1917] bg-[#1c1917] text-white"
          : "border-[#d9d9de] bg-white text-[#1c1917]",
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
