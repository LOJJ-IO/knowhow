"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/** A dotted editor canvas: cards in rows, joined by measured connectors, each
 *  card draggable anywhere on the canvas with the connectors following.
 *
 *  Adapted from a flowchart the user supplied (2026-09-21) — its mechanics are
 *  the valuable part and they are kept: node heights are **measured** rather
 *  than assumed (a card whose content wraps still connects correctly), row
 *  offsets are derived from those measurements, connectors are beziers between
 *  anchor points, dragging clamps the card inside the canvas, and a real drag
 *  is not allowed to also toggle selection. Retokenised onto Knohow's own
 *  surfaces and fonts; the condition/dropdown machinery in the original was
 *  for its own domain and is gone.
 *
 *  Generic on purpose: it knows about rows, widths and edges, and nothing
 *  about organizations. The caller renders each card. */

const PAD_Y = 28;
const ROW_GAP = 72;

export type FlowNode = {
  id: string;
  /** Which band the node sits in. 0 is the top. */
  row: number;
  /** Centre of the node across the canvas, 0–1. Spread these to give a row
   *  its breadth. */
  x: number;
  /** Preferred width in px; capped to the canvas. */
  w: number;
};

export type FlowEdge = { from: string; to: string };

export function FlowCanvas({
  nodes,
  edges,
  estimatedHeight = 96,
  renderNode,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Height used for the first paint, before anything is measured. */
  estimatedHeight?: number;
  renderNode: (node: FlowNode, state: { selected: boolean }) => ReactNode;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [offsets, setOffsets] = useState<
    Record<string, { dx: number; dy: number }>
  >({});
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    baseDx: number;
    baseDy: number;
    moved: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const measure = () => {
      setWidth(canvas.clientWidth);
      setHeights((previous) => {
        const next = { ...previous };
        let changed = false;
        nodeRefs.current.forEach((el, id) => {
          const h = el.offsetHeight;
          if (h && Math.abs(h - (next[id] ?? 0)) > 0.5) {
            next[id] = h;
            changed = true;
          }
        });
        return changed ? next : previous;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    nodeRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [nodes]);

  const heightOf = (id: string) => heights[id] ?? estimatedHeight;

  const rows = [...new Set(nodes.map((n) => n.row))].sort((a, b) => a - b);
  const rowH = rows.map((r) =>
    Math.max(...nodes.filter((n) => n.row === r).map((n) => heightOf(n.id))),
  );
  const rowY: number[] = [];
  rows.forEach((_, i) => {
    rowY[i] = i === 0 ? PAD_Y : rowY[i - 1] + rowH[i - 1] + ROW_GAP;
  });
  const canvasH = rows.length
    ? rowY[rows.length - 1] + rowH[rows.length - 1] + PAD_Y
    : 240;

  const cw = width || 720;
  const place = (n: FlowNode) => {
    const w = Math.min(n.w, cw * 0.92);
    const off = offsets[n.id];
    return {
      w,
      cx: n.x * cw + (off?.dx ?? 0),
      top: rowY[rows.indexOf(n.row)] + (off?.dy ?? 0),
    };
  };

  const anchors = (n: FlowNode) => {
    const { cx, top } = place(n);
    return {
      top: { x: cx, y: top },
      bottom: { x: cx, y: top + heightOf(n.id) },
    };
  };

  const bezier = (edge: FlowEdge) => {
    const fromNode = nodes.find((n) => n.id === edge.from);
    const toNode = nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) return "";
    const from = anchors(fromNode).bottom;
    const to = anchors(toNode).top;
    const k = Math.min(Math.max(Math.abs(to.y - from.y) * 0.55, 24), 84);
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + k}, ${to.x} ${to.y - k}, ${to.x} ${to.y}`;
  };

  const onPointerDown =
    (node: FlowNode) => (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as Element).closest("[data-ui]")) return;
      const off = offsets[node.id];
      drag.current = {
        id: node.id,
        startX: event.clientX,
        startY: event.clientY,
        baseDx: off?.dx ?? 0,
        baseDy: off?.dy ?? 0,
        moved: false,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    };

  const onPointerMove =
    (node: FlowNode) => (event: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || d.id !== node.id) return;
      const dx = d.baseDx + event.clientX - d.startX;
      const dy = d.baseDy + event.clientY - d.startY;
      // A few pixels of slop, so a click with a shaky hand is still a click.
      if (!d.moved && Math.hypot(dx - d.baseDx, dy - d.baseDy) < 3) return;
      d.moved = true;

      const { w } = place(node);
      const h = heightOf(node.id);
      const baseCx = node.x * cw;
      const baseTop = rowY[rows.indexOf(node.row)];
      const cx = Math.min(Math.max(baseCx + dx, w / 2 + 8), cw - w / 2 - 8);
      const top = Math.min(Math.max(baseTop + dy, 8), canvasH - h - 8);
      setOffsets((current) => ({
        ...current,
        [node.id]: { dx: cx - baseCx, dy: top - baseTop },
      }));
    };

  const onPointerUp = (node: FlowNode) => () => {
    const d = drag.current;
    if (d?.id !== node.id) return;
    // Let the click handler see that this was a drag before clearing it.
    if (d.moved) setTimeout(() => (drag.current = null), 0);
    else drag.current = null;
  };

  const lit = (edge: FlowEdge) =>
    selected === edge.from || selected === edge.to;

  return (
    <div
      ref={canvasRef}
      className="relative w-full select-none overflow-hidden rounded-[16px] bg-[var(--app-ground)] shadow-[inset_0_0_0_1px_var(--app-border)]"
      style={{
        height: canvasH,
        backgroundImage:
          "radial-gradient(var(--app-dot) 1px, transparent 1.25px)",
        backgroundSize: "22px 22px",
        backgroundPosition: "center",
      }}
    >
      <svg
        width={cw}
        height={canvasH}
        className="pointer-events-none absolute inset-0"
      >
        {edges.map((edge) => (
          <path
            key={`${edge.from}-${edge.to}`}
            d={bezier(edge)}
            fill="none"
            stroke={lit(edge) ? "#1c1917" : "var(--app-dot)"}
            strokeWidth={lit(edge) ? 1.75 : 1.25}
            className="transition-[stroke,stroke-width] duration-150"
          />
        ))}
      </svg>

      {nodes.map((node) => {
        const { w, cx, top } = place(node);
        const active = selected === node.id;
        return (
          <div
            key={node.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(node.id, el);
              else nodeRefs.current.delete(node.id);
            }}
            onPointerDown={onPointerDown(node)}
            onPointerMove={onPointerMove(node)}
            onPointerUp={onPointerUp(node)}
            onClick={() => {
              if (drag.current?.moved) return;
              setSelected(active ? null : node.id);
            }}
            className="absolute flex -translate-x-1/2 cursor-grab touch-none flex-col items-stretch active:cursor-grabbing"
            style={{
              left: cx,
              top,
              width: w,
              zIndex: drag.current?.id === node.id ? 2 : 1,
            }}
          >
            {renderNode(node, { selected: active })}
          </div>
        );
      })}
    </div>
  );
}
