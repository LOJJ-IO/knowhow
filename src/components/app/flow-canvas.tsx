"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { EdgePulse } from "@/components/app/edge-pulse";

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
const PAD_X = 20;
const ROW_GAP = 72;
/** How far the gap between rows may stretch when the canvas has spare height.
 *  Without a ceiling the rows are pushed to the two ends of the window and the
 *  chart reads as two unrelated bands; this keeps the tree together near the
 *  top, which is where the user positioned it by hand (2026-09-22). */
const MAX_ROW_GAP = 240;
/** How far down the canvas the top row starts, as a fraction of the canvas's
 *  height. 0 puts it at `PAD_Y`. */
const TOP_SHIFT = 0.2;
/** How far the board may be zoomed. Far enough out to see a wide org, far
 *  enough in to read a card that has been dragged somewhere odd. */
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

/** Distance between the two live touch points. */
function touchDistance(points: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...points.values()];
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
}
/** Closest two cards in a spread row may sit. Below this the row stops
 *  spreading and the canvas scrolls sideways instead. */
const MIN_COL_GAP = 28;
/** Space left under the canvas, matching the page's own bottom padding. */
const BOTTOM_GUTTER = 24;

export type FlowNode = {
  id: string;
  /** Which band the node sits in. 0 is the top. */
  row: number;
  /** Centre of the node across the canvas, 0–1. Used when the row holds one
   *  node, or when the canvas isn't spreading. */
  x: number;
  /** Preferred width in px; capped to the canvas. */
  w: number;
};

export type FlowEdge = {
  from: string;
  to: string;
  /** Send a pulse along this connector — set only when something actually
   *  moved between these two nodes. An edge with no news stays a plain static
   *  line. See `EdgePulse`. */
  active?: boolean;
};

export function FlowCanvas({
  nodes,
  edges,
  estimatedHeight = 96,
  spread = false,
  pulseKey = 0,
  renderNode,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Height used for the first paint, before anything is measured. */
  estimatedHeight?: number;
  /** Lay each row out across the full width — equal gutters at the edges and
   *  between cards — instead of honouring each node's `x` fraction. Fractions
   *  leave the row clustered in the middle with the ends of the canvas empty
   *  (user 2026-09-22). A row with one node stays centred either way. */
  spread?: boolean;
  /** Bump to replay every active edge's pulse from the start. The pulses are
   *  periodic on their own; this is what "play it again" writes to. */
  pulseKey?: number;
  renderNode: (node: FlowNode, state: { selected: boolean }) => ReactNode;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [width, setWidth] = useState(0);
  /** How much height there is between the canvas's top and the bottom of the
   *  window. Measured rather than inherited: a percentage height only resolves
   *  if every ancestor has a definite one, and one `flex` link missing that
   *  silently collapses the canvas to its content. Measuring can't collapse. */
  const [available, setAvailable] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [offsets, setOffsets] = useState<
    Record<string, { dx: number; dy: number }>
  >({});
  /** Which card is on top. State rather than the drag ref, because render
   *  can't read a ref — the original this was adapted from did, which React
   *  now flags. */
  const [lifted, setLifted] = useState<string | null>(null);
  /** How far the board has been dragged, Figma-style: grab the empty canvas
   *  and the whole chart moves with you (user 2026-09-22). The dots move too,
   *  because a grid that stays put while its contents slide reads as the
   *  contents being dragged *over* a surface rather than the surface moving. */
  const [pan, setPan] = useState({ x: 0, y: 0 });
  /** Board zoom. Pinch on a trackpad (which arrives as ctrl+wheel) or with
   *  two fingers on a touchscreen; the point under the fingers stays put
   *  (user 2026-09-22). Clamped so the chart can't be lost in either
   *  direction. */
  const [scale, setScale] = useState(1);
  /** Live touch points, for the two-finger pinch. */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  /** The zoom as it stands this render, for the native wheel listener below:
   *  that listener is bound once and would otherwise close over a stale
   *  scale. */
  const zoomRef = useRef<
    (factor: number, clientX: number, clientY: number) => void
  >(() => {});
  const panDrag = useRef<{
    x: number;
    y: number;
    baseX: number;
    baseY: number;
  } | null>(null);
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
      // Distance from the canvas's top edge to the bottom of the viewport,
      // less the page's own bottom gutter.
      const top = canvas.getBoundingClientRect().top;
      setAvailable(Math.max(0, window.innerHeight - top - BOTTOM_GUTTER));
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
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /** React binds `onWheel` **passively**, so a handler bound that way can't
     *  call `preventDefault` — and without that the browser runs its own page
     *  zoom on a trackpad pinch on top of ours, which zooms the whole window
     *  (user 2026-09-22). A native non-passive listener is the only way to
     *  take the gesture. */
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // A trackpad pinch reaches the browser as ctrl+wheel; anything else is
      // an ordinary scroll, which pans.
      if (event.ctrlKey || event.metaKey) {
        zoomRef.current(
          Math.exp(-event.deltaY / 220),
          event.clientX,
          event.clientY,
        );
        return;
      }
      setPan((current) => ({
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const heightOf = (id: string) => heights[id] ?? estimatedHeight;

  const rows = [...new Set(nodes.map((n) => n.row))].sort((a, b) => a - b);
  const rowH = rows.map((r) =>
    Math.max(...nodes.filter((n) => n.row === r).map((n) => heightOf(n.id))),
  );
  // The height the rows need at their natural gap.
  const contentH = rows.length
    ? rows.reduce((total, _, i) => total + rowH[i], 0) +
      ROW_GAP * Math.max(rows.length - 1, 0) +
      PAD_Y * 2
    : 240;

  // Fit the window (user 2026-09-22): when the parent gives the canvas more
  // height than the rows need, the gap grows to use it — but only up to
  // MAX_ROW_GAP, so the rows stay a tree near the top rather than being flung
  // to the top and bottom edges. When the height falls short, the natural gap
  // stands and the canvas scrolls — a chart that shrinks until it is
  // unreadable is worse than one you scroll.
  /** The whole tree sits a fifth of the canvas down from the top (user
   *  2026-09-22), rather than starting at `PAD_Y`. The canvas grows to keep
   *  the bottom row inside it, so moving the chart down never clips it. */
  const fitted = Math.max(available || 0, contentH);
  const topShift = fitted * TOP_SHIFT;
  const canvasH = Math.max(fitted, contentH + topShift);
  const gap =
    rows.length > 1
      ? Math.min(
          MAX_ROW_GAP,
          Math.max(
            ROW_GAP,
            (canvasH -
              topShift -
              PAD_Y * 2 -
              rowH.reduce((total, h) => total + h, 0)) /
              (rows.length - 1),
          ),
        )
      : ROW_GAP;

  const rowY: number[] = [];
  rows.forEach((_, i) => {
    rowY[i] = i === 0 ? PAD_Y + topShift : rowY[i - 1] + rowH[i - 1] + gap;
  });

  const cw = width || 720;
  const widthOf = (n: FlowNode) => Math.min(n.w, cw * 0.92);

  /** Where each node's centre sits, before any drag. When spreading, a row's
   *  cards are distributed across the full width: the first starts at the left
   *  gutter, the last ends at the right one, and what is left over becomes the
   *  gaps between them. */
  const baseCx = (n: FlowNode) => {
    const peers = nodes.filter((p) => p.row === n.row);
    if (!spread || peers.length < 2) return n.x * cw;
    const widths = peers.map(widthOf);
    const total = widths.reduce((sum, w) => sum + w, 0);
    const gap = Math.max(
      MIN_COL_GAP,
      (cw - PAD_X * 2 - total) / (peers.length - 1),
    );
    const index = peers.indexOf(n);
    const before = widths.slice(0, index).reduce((sum, w) => sum + w, 0);
    return PAD_X + before + gap * index + widths[index] / 2;
  };

  const place = (n: FlowNode) => {
    const off = offsets[n.id];
    return {
      w: widthOf(n),
      cx: baseCx(n) + (off?.dx ?? 0),
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
      setLifted(node.id);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    };

  const onPointerMove =
    (node: FlowNode) => (event: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || d.id !== node.id) return;
      const dx = d.baseDx + (event.clientX - d.startX) / scale;
      const dy = d.baseDy + (event.clientY - d.startY) / scale;
      // A few pixels of slop, so a click with a shaky hand is still a click.
      if (!d.moved && Math.hypot(dx - d.baseDx, dy - d.baseDy) < 3) return;
      d.moved = true;

      const { w } = place(node);
      const h = heightOf(node.id);
      const base = baseCx(node);
      const baseTop = rowY[rows.indexOf(node.row)];
      const cx = Math.min(Math.max(base + dx, w / 2 + 8), cw - w / 2 - 8);
      const top = Math.min(Math.max(baseTop + dy, 8), canvasH - h - 8);
      setOffsets((current) => ({
        ...current,
        [node.id]: { dx: cx - base, dy: top - baseTop },
      }));
    };

  const onPointerUp = (node: FlowNode) => () => {
    const d = drag.current;
    if (d?.id !== node.id) return;
    setLifted(null);
    // Let the click handler see that this was a drag before clearing it.
    if (d.moved) setTimeout(() => (drag.current = null), 0);
    else drag.current = null;
  };

  /** Zoom about a point in client space, keeping what is under it under it. */
  const zoomAt = (next: number, clientX: number, clientY: number) => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box) return;
    const clamped = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
    const x = clientX - box.left;
    const y = clientY - box.top;
    setPan((current) => ({
      x: x - ((x - current.x) * clamped) / scale,
      y: y - ((y - current.y) * clamped) / scale,
    }));
    setScale(clamped);
  };

  // Kept fresh for the native wheel listener, which is bound once.
  useLayoutEffect(() => {
    zoomRef.current = (factor, clientX, clientY) =>
      zoomAt(scale * factor, clientX, clientY);
  });

  const onBoardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch")
      touches.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    // Two fingers is a pinch, not a pan.
    if (touches.current.size === 2) {
      panDrag.current = null;
      pinch.current = { distance: touchDistance(touches.current), scale };
      return;
    }
    // Only the empty canvas pans; a card handles its own drag.
    if (event.target !== event.currentTarget) return;
    panDrag.current = {
      x: event.clientX,
      y: event.clientY,
      baseX: pan.x,
      baseY: pan.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onBoardPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && touches.current.has(event.pointerId))
      touches.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

    const gesture = pinch.current;
    if (gesture && touches.current.size === 2) {
      const points = [...touches.current.values()];
      const distance = touchDistance(touches.current);
      if (gesture.distance > 0)
        zoomAt(
          (gesture.scale * distance) / gesture.distance,
          (points[0].x + points[1].x) / 2,
          (points[0].y + points[1].y) / 2,
        );
      return;
    }

    const d = panDrag.current;
    if (!d) return;
    setPan({
      x: d.baseX + event.clientX - d.x,
      y: d.baseY + event.clientY - d.y,
    });
  };

  const onBoardPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    panDrag.current = null;
  };

  const lit = (edge: FlowEdge) =>
    selected === edge.from || selected === edge.to;

  return (
    <div
      ref={canvasRef}
      onPointerDown={onBoardPointerDown}
      onPointerMove={onBoardPointerMove}
      onPointerUp={onBoardPointerUp}
      onPointerCancel={onBoardPointerUp}
      className="relative w-full shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-[32px] bg-[var(--app-ground)] shadow-[inset_0_0_0_1px_var(--app-border)] active:cursor-grabbing"
      style={{
        height: canvasH,
        backgroundImage:
          "radial-gradient(var(--app-dot) 1px, transparent 1.25px)",
        // The grid slides *and* scales with the board, so the dots stay part
        // of the surface rather than a texture printed on the window.
        backgroundSize: `${22 * scale}px ${22 * scale}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          width={cw}
          height={canvasH}
          className="pointer-events-none absolute inset-0"
        >
          {edges.map((edge, i) => {
            const d = bezier(edge);
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={d}
                  fill="none"
                  stroke={lit(edge) ? "#1c1917" : "var(--app-dot)"}
                  strokeWidth={lit(edge) ? 1.75 : 1.25}
                  className="transition-[stroke,stroke-width] duration-150"
                />
                {edge.active ? (
                  // Staggered so several active edges never fire in lockstep,
                  // which is what would make them read as decoration.
                  <EdgePulse key={pulseKey} d={d} delay={i * 900} />
                ) : null}
              </g>
            );
          })}
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
              className="pointer-events-auto absolute flex -translate-x-1/2 cursor-grab touch-none flex-col items-stretch active:cursor-grabbing"
              style={{
                left: cx,
                top,
                width: w,
                zIndex: lifted === node.id ? 2 : 1,
              }}
            >
              {renderNode(node, { selected: active })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
