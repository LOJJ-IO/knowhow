"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** A number in a capsule: − on the left, the value in the middle, + on the
 *  right, and the whole capsule draggable sideways to move faster.
 *
 *  A primitive, not a screen: it owns a number and nothing else. It reports
 *  itself as a `spinbutton` so a screen reader announces the value rather
 *  than the gesture, and arrow keys do what the two buttons do.
 */
export function DragStepper({
  value,
  min,
  max,
  label,
  onChange,
  className,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
  className?: string;
}) {
  const drag = useRef<{ x: number; from: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Travel per step: short enough to feel direct, long enough that a small
   *  jitter doesn't move the number. */
  const STEP_PX = 28;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const nudge = (by: number) => onChange(clamp(value + by));

  const sideButton = (by: number, glyph: string, name: string) => (
    <button
      type="button"
      aria-label={name}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => nudge(by)}
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[1.25rem] leading-none text-[#1c1917]/50 transition-colors hover:text-[#1c1917] disabled:opacity-30"
      disabled={by < 0 ? value <= min : value >= max}
    >
      {glyph}
    </button>
  );

  return (
    <div
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          nudge(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          nudge(-1);
        }
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, from: value };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        onChange(clamp(d.from + Math.round((e.clientX - d.x) / STEP_PX)));
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      className={cn(
        "flex h-14 w-full touch-none select-none items-center justify-between rounded-full bg-[#1c1917]/[0.06] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917]/20",
        dragging ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
    >
      {sideButton(-1, "−", `Fewer ${label}`)}
      {/* Tabular figures so the number doesn't shuffle as it changes. */}
      <span className="flex-1 text-center text-[1.5rem] font-bold leading-none text-[#1c1917] tabular-nums">
        {value}
      </span>
      {sideButton(1, "+", `More ${label}`)}
    </div>
  );
}
