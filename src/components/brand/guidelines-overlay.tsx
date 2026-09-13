"use client";

import { useState, useSyncExternalStore } from "react";
import { useHydrated } from "@/lib/use-hydrated";

/** Permanent design element: divides the hero into an N×M grid, like design
 * software's layout guides, sitting at the same z-level as the background
 * video (behind the logo) — the grid lines themselves are always visible.
 * Column/row counts persist in localStorage; the numbered cells and the +/-
 * controls to tune them are dev-only and stay behind `editable`, since bare
 * numbers on the grid aren't part of the shipped design.
 *
 * Shipped (non-edit) layout picks cols/rows from the viewport aspect so cells
 * stay roughly square. Edit mode still lets you override on desktop. */
/** Cells along the short viewport side — sets grid density. */
const TARGET_SHORT = 5;
/** SSR / pre-hydration fallback assumes 16:9 (≈ square cells). */
const DEFAULT_ROWS = TARGET_SHORT;
const DEFAULT_COLUMNS = Math.round(TARGET_SHORT * (16 / 9));

function readCount(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = localStorage.getItem(key);
    return saved ? Number(saved) : fallback;
  } catch {
    return fallback;
  }
}

function subscribeViewport(onChange: () => void) {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

function useViewportMetrics() {
  const isMobile = useSyncExternalStore(
    subscribeViewport,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
  const widthOverHeight = useSyncExternalStore(
    subscribeViewport,
    () => window.innerWidth / Math.max(window.innerHeight, 1),
    () => 16 / 9,
  );
  return { isMobile, widthOverHeight };
}

/** cols/rows so each cell ≈ square given viewport aspect (W/H). */
function squareCounts(widthOverHeight: number) {
  if (widthOverHeight >= 1) {
    const rows = TARGET_SHORT;
    const cols = Math.max(1, Math.round(TARGET_SHORT * widthOverHeight));
    return { cols, rows };
  }
  const cols = TARGET_SHORT;
  const rows = Math.max(1, Math.round(TARGET_SHORT / widthOverHeight));
  return { cols, rows };
}

function GuidelinesOverlay({ editable }: { editable: boolean }) {
  // Column/row counts are read from localStorage and so can differ between
  // the server render and the client's first (hydration) render. Gating the
  // displayed counts on `mounted` keeps that first client render at the same
  // fallback the server used, then updates to the real value as a normal
  // post-hydration render — avoiding a hydration mismatch.
  const mounted = useHydrated();
  const { isMobile, widthOverHeight } = useViewportMetrics();
  const auto = squareCounts(widthOverHeight);

  const [columns, setColumns] = useState<number>(() =>
    readCount("guidelines:columns", DEFAULT_COLUMNS),
  );
  const [rows, setRows] = useState<number>(() =>
    readCount("guidelines:rows", DEFAULT_ROWS),
  );

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

  // Shipped grid is always aspect-square. Manual counts only while editing
  // on desktop (mobile stays auto so the overlay doesn't go rectangular).
  const useManual = mounted && editable && !isMobile;
  const displayColumns = mounted
    ? useManual
      ? columns
      : auto.cols
    : DEFAULT_COLUMNS;
  const displayRows = mounted
    ? useManual
      ? rows
      : auto.rows
    : DEFAULT_ROWS;
  const showControls = mounted && editable;
  const cells = Array.from(
    { length: displayColumns * displayRows },
    (_, i) => i + 1,
  );

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        suppressHydrationWarning
      >
        <div
          className="grid size-full"
          style={{
            gridTemplateColumns: `repeat(${displayColumns}, 1fr)`,
            gridTemplateRows: `repeat(${displayRows}, 1fr)`,
          }}
        >
          {cells.map((n) => (
            <div
              key={n}
              className="flex items-start justify-start border border-white/40 p-2"
            >
              {showControls && (
                <span className="font-mono text-xs text-white/70">{n}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {showControls && (
        <div className="fixed bottom-20 left-4 z-50 flex flex-col gap-2 rounded-lg bg-black/80 p-3 text-sm text-white shadow">
          <div className="flex items-center justify-between gap-3">
            <span>Columns{isMobile ? " (auto)" : ""}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateColumns(columns - 1)}
                disabled={isMobile}
                className="size-6 rounded-full bg-white/20 leading-none disabled:opacity-40"
              >
                −
              </button>
              <span className="w-4 text-center font-mono">{displayColumns}</span>
              <button
                type="button"
                onClick={() => updateColumns(columns + 1)}
                disabled={isMobile}
                className="size-6 rounded-full bg-white/20 leading-none disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Rows{isMobile ? " (auto)" : ""}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateRows(rows - 1)}
                disabled={isMobile}
                className="size-6 rounded-full bg-white/20 leading-none disabled:opacity-40"
              >
                −
              </button>
              <span className="w-4 text-center font-mono">{displayRows}</span>
              <button
                type="button"
                onClick={() => updateRows(rows + 1)}
                disabled={isMobile}
                className="size-6 rounded-full bg-white/20 leading-none disabled:opacity-40"
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
