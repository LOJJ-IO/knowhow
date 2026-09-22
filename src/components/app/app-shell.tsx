"use client";

import { useCallback, useRef, useState } from "react";

import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

/** The app's chrome, and the two pieces of state it owns.
 *
 *  **Visibility and width are separate, on purpose** (the VS Code / Cursor
 *  model, as the user set out on 2026-09-22):
 *
 *  | State | Job |
 *  | --- | --- |
 *  | `sidebarWidth` | How wide the sidebar is *when it exists*. Written only by a resize. |
 *  | `sidebarVisible` | Whether it exists at all. Written only by the toggle. |
 *
 *  Collapsing never writes over the width. Open it again and it comes back the
 *  size you left it — because collapse is not "set the width to zero", it is
 *  "stop rendering the track". Folding those into one number would silently
 *  destroy a preference the person set by hand, which is the same reason a
 *  window's minimise doesn't forget its geometry and an accordion's closed
 *  state doesn't forget its content height.
 *
 *  Hiding is done by the **grid track**, not by `display: none` on the panel:
 *  the column goes to `0px` and the centre's `minmax(0, 1fr)` takes the space.
 *  The resize handle is not rendered while the sidebar is hidden — an
 *  invisible 8px hit area at the screen edge is a trap, and it can push
 *  scrollbars around. Dragging the handle also forces the sidebar visible, so
 *  a resize can never happen to something nobody can see. */

/** Where the sidebar starts. 208px is the 13rem the old `--app-sidebar-w`
 *  token settled on after the user's sizing passes; the token is gone, because
 *  a resizable width belongs in state, not in CSS. */
const DEFAULT_SIDEBAR_W = 208;
/** Narrow enough that a label truncates, wide enough that it doesn't. */
const MIN_SIDEBAR_W = 168;
const MAX_SIDEBAR_W = 420;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_W);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [resizing, setResizing] = useState(false);
  const frame = useRef(0);

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    // A drag on the handle implies the sidebar is wanted.
    setSidebarVisible(true);
    setResizing(true);

    const move = (e: PointerEvent) => {
      // One update per frame: pointermove fires faster than paint, and the
      // grid template is a layout change.
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() =>
        setSidebarWidth(
          Math.min(Math.max(e.clientX, MIN_SIDEBAR_W), MAX_SIDEBAR_W),
        ),
      );
    };
    const stop = () => {
      cancelAnimationFrame(frame.current);
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }, []);

  return (
    <div
      className="grid h-dvh overflow-hidden bg-[var(--app-ground)]"
      style={{
        // The toggle decides which tracks exist; the resize decides how wide
        // they are when they do.
        gridTemplateColumns: `${sidebarVisible ? `${sidebarWidth}px` : "0px"} minmax(0, 1fr)`,
        // Snappy while dragging (no lag behind the pointer), eased when the
        // toggle flips it.
        transition: resizing
          ? "none"
          : "grid-template-columns 180ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="relative min-w-0 overflow-hidden">
        <Sidebar />
        {sidebarVisible ? (
          <button
            type="button"
            aria-label="Resize sidebar"
            onPointerDown={startResize}
            className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none bg-transparent"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col">
        <Topbar
          sidebarOpen={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible((visible) => !visible)}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
