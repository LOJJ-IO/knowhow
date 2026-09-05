"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Dev-only drag handle: click and drag to reposition (when `locked` is
 * false), position persists per-id in localStorage. Not gated/hidden —
 * remove before this ships past prototype. */
function Draggable({
  id,
  initial,
  locked,
  children,
  className,
}: {
  id: string;
  initial: { x: number; y: number };
  locked: boolean;
  children: ReactNode;
  className?: string;
}) {
  const storageKey = `draggable:${id}`;
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as { x: number; y: number }) : initial;
    } catch {
      return initial;
    }
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    setPos((p) => {
      localStorage.setItem(storageKey, JSON.stringify(p));
      return p;
    });
  }

  const style: CSSProperties = {
    position: "absolute",
    left: pos.x,
    top: pos.y,
    cursor: locked ? "default" : dragging ? "grabbing" : "grab",
    touchAction: locked ? "auto" : "none",
    userSelect: "none",
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={className}
      style={style}
      suppressHydrationWarning
    >
      {children}
      {dragging && (
        <span className="pointer-events-none absolute -bottom-6 left-0 whitespace-nowrap rounded bg-black/75 px-1.5 py-0.5 font-mono text-xs text-white">
          {Math.round(pos.x)}, {Math.round(pos.y)}
        </span>
      )}
    </div>
  );
}

export { Draggable };
