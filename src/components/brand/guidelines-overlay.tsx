"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";

/** Permanent design element: divides the hero into an N×M grid, like design
 * software's layout guides, sitting at the same z-level as the background
 * video (behind the logo) — the grid lines themselves are always visible.
 * Column/row counts persist in localStorage; the numbered cells and the +/-
 * controls to tune them are dev-only and stay behind `editable`, since bare
 * numbers on the grid aren't part of the shipped design. */
function readCount(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = localStorage.getItem(key);
    return saved ? Number(saved) : fallback;
  } catch {
    return fallback;
  }
}

function GuidelinesOverlay({ editable }: { editable: boolean }) {
  // Column/row counts are read from localStorage and so can differ between
  // the server render and the client's first (hydration) render. Gating the
  // displayed counts on `mounted` keeps that first client render at the same
  // fallback the server used, then updates to the real value as a normal
  // post-hydration render — avoiding a hydration mismatch.
  const mounted = useHydrated();

  const [columns, setColumns] = useState<number>(() => readCount("guidelines:columns", 3));
  const [rows, setRows] = useState<number>(() => readCount("guidelines:rows", 3));

  function updateColumns(next: number) {
    const clamped = Math.max(1, next);
    setColumns(clamped);
    localStorage.setItem("guidelines:columns", String(clamped));
  }

  function updateRows(next: number) {
    const clamped = Math.max(1, next);
    setRows(clamped);
    localStorage.setItem("guidelines:rows", String(clamped));
  }

  const displayColumns = mounted ? columns : 3;
  const displayRows = mounted ? rows : 3;
  const showControls = mounted && editable;
  const cells = Array.from({ length: displayColumns * displayRows }, (_, i) => i + 1);

  return (
    <>
      <div className="pointer-events-none absolute inset-0 -z-10" suppressHydrationWarning>
        <div
          className="grid size-full"
          style={{
            gridTemplateColumns: `repeat(${displayColumns}, 1fr)`,
            gridTemplateRows: `repeat(${displayRows}, 1fr)`,
          }}
        >
          {cells.map((n) => (
            <div key={n} className="flex items-start justify-start border border-white/40 p-2">
              {showControls && <span className="font-mono text-xs text-white/70">{n}</span>}
            </div>
          ))}
        </div>
      </div>

      {showControls && (
        <div className="fixed bottom-20 left-4 z-50 flex flex-col gap-2 rounded-lg bg-black/80 p-3 text-sm text-white shadow">
          <div className="flex items-center justify-between gap-3">
            <span>Columns</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateColumns(columns - 1)}
                className="size-6 rounded-full bg-white/20 leading-none"
              >
                −
              </button>
              <span className="w-4 text-center font-mono">{columns}</span>
              <button
                type="button"
                onClick={() => updateColumns(columns + 1)}
                className="size-6 rounded-full bg-white/20 leading-none"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Rows</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateRows(rows - 1)}
                className="size-6 rounded-full bg-white/20 leading-none"
              >
                −
              </button>
              <span className="w-4 text-center font-mono">{rows}</span>
              <button
                type="button"
                onClick={() => updateRows(rows + 1)}
                className="size-6 rounded-full bg-white/20 leading-none"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { GuidelinesOverlay };
