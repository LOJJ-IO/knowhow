"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

type EmPos = { x: number; y: number };

function isEmPos(value: unknown): value is EmPos {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { x: unknown }).x === "number" &&
    typeof (value as { y: unknown }).y === "number" &&
    (value as { unit?: unknown }).unit === "em"
  );
}

/** Dev-only drag handle: click and drag to reposition (when `locked` is
 * false), position persists per-id in localStorage. Positions are stored in
 * `em` (relative to the element's own font-size, set via `style`) rather
 * than raw pixels, so a hardcoded `initial` still lines up correctly at
 * other viewport widths where `font-size: clamp(...)` resolves smaller or
 * larger. Not gated/hidden — remove before this ships past prototype. */
function Draggable({
  id,
  initial,
  locked,
  children,
  className,
  style: styleProp,
}: {
  id: string;
  initial: EmPos;
  locked: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const storageKey = `draggable:${id}`;
  const [pos, setPos] = useState<EmPos>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      return isEmPos(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; fontSizePx: number } | null>(
    null,
  );

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const fontSizePx = parseFloat(getComputedStyle(e.currentTarget).fontSize) || 16;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, fontSizePx };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const { startX, startY, origX, origY, fontSizePx } = dragRef.current;
    const dx = (e.clientX - startX) / fontSizePx;
    const dy = (e.clientY - startY) / fontSizePx;
    setPos({ x: origX + dx, y: origY + dy });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    setPos((p) => {
      localStorage.setItem(storageKey, JSON.stringify({ ...p, unit: "em" }));
      return p;
    });
  }

  const style: CSSProperties = {
    ...styleProp,
    position: "absolute",
    left: `${pos.x}em`,
    top: `${pos.y}em`,
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
          {pos.x.toFixed(3)}em, {pos.y.toFixed(3)}em
        </span>
      )}
    </div>
  );
}

export { Draggable };
