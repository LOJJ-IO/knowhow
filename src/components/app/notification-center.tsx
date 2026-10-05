"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { Library, X } from "lucide-react";

import { Button } from "@/components/app/button";
import { NAV_STROKE } from "@/components/app/icon";
import { plural } from "@/components/app/screen-kit";
import { useUpdates } from "@/components/app/updates";
import type { Task } from "@/lib/tasks";
import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";

/** A macOS-style notification center (user 2026-10-02): a column headed by
 *  `label` with a close button, its cards (`NotificationCard`) in grey glass,
 *  over a feathered blur behind just the heading and cards (the rest of the
 *  screen stays sharp). A press outside the cards (which still reaches what
 *  was pressed), the close button or Escape genies every
 *  card into the topbar's bell (`[data-slot="notification-bell"]`) while the
 *  heading and the blur fade.
 *
 *  Each element marked `data-nc-pill` is one card. The genie is the scanline
 *  renderer from ui-layouts' mac-genie: snapshot the pill with html-to-image,
 *  then redraw it a row at a time on one full-screen canvas, each row narrowing
 *  and falling toward the bell on its own schedule, so the pill pinches into a
 *  funnel. Rows nearest the bell leave first. Reduced motion just fades.
 *
 *  Sits under the app's dialogs (`z-[500]`), so a pill's action can open one
 *  on top of it. */

/** One pill's flight into the bell. */
const GENIE_MS = 520;
/** Each later pill leaves this much after the one above it. */
const GENIE_STAGGER_MS = 70;
const FADE_MS = 200;
/** The pills' slide-in (`app-nc-pill-in`, 320ms + the second's 50ms delay),
 *  done before they're snapshotted. */
const PILLS_IN_MS = 450;
/** macOS's notification width. */
const COLUMN_PX = 360;
/** The column's gap from the window's right edge. */
const COLUMN_INSET_PX = 16;

type Pt = { x: number; y: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeInQuad = (t: number) => t * t;

/** Draws one pill (`src`, captured at `scale` px per CSS px) `t` of the way
 *  from `rect` into `to`. */
function drawGenie(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  scale: number,
  rect: DOMRect,
  to: Pt,
  t: number,
) {
  const rows = Math.ceil(rect.height);
  const targetAbove = to.y < rect.top;
  const place = (y: number) => {
    const r = y / rows;
    // How late this row leaves: the edge nearest the bell goes first.
    const lag = targetAbove ? r : 1 - r;
    const xStart = lag * 0.65;
    const xT = easeInOutCubic(clamp((t - xStart) / (1 - xStart), 0, 1));
    const yStart = lag * 0.2;
    const yT = easeInQuad(clamp((t - yStart) / (1 - yStart), 0, 1));
    return {
      left: lerp(rect.left, to.x, xT),
      right: lerp(rect.right, to.x, xT),
      top: lerp(rect.top + y, to.y, yT),
    };
  };
  // Rows fall at different speeds: they drift apart where the pill stretches
  // and pile up where it funnels. The pill is see-through (`bg-black/80`), so
  // every screen row is painted exactly once, in whole pixels: each source row
  // reaches down to where the next begins (no light gaps), and a row whose
  // pixels are already painted is skipped (no dark stacking).
  const painted = new Set<number>();
  let row = place(0);
  for (let y = 0; y < rows; y++) {
    const next = place(y + 1);
    const width = row.right - row.left;
    if (width >= 0.8) {
      const from = Math.round(Math.min(row.top, next.top));
      const end = Math.max(from + 1, Math.round(Math.max(row.top, next.top)));
      let top = from;
      while (top < end && painted.has(top)) top++;
      let bottom = top;
      while (bottom < end && !painted.has(bottom)) painted.add(bottom++);
      if (bottom > top)
        ctx.drawImage(src, 0, y * scale, src.width, scale, row.left, top, width, bottom - top);
    }
    row = next;
  }
}

/** Flies snapshots (`src`, taken at devicePixelRatio, of what sat at `rect`)
 *  into `to` on a page-level canvas, then calls `done`. The canvas is the
 *  page's, not a component's: clicking a sidebar tab unmounts the screen
 *  mid-flight, and the pills should still land in the bell over the next one
 *  (Ronald, 2026-10-04). Shared with the toasts (app-toasts.tsx). */
export function flyIntoBell(
  shots: { src: HTMLCanvasElement; rect: DOMRect }[],
  to: Pt,
  done: () => void,
  /** The pills fly under dialogs (400); toasts sit at 550. */
  zIndex = 400,
) {
  const scale = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    `position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:${zIndex}`;
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return done();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  document.body.appendChild(canvas);

  const total = GENIE_MS + GENIE_STAGGER_MS * (shots.length - 1);
  const start = performance.now();
  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    shots.forEach(({ src, rect }, i) => {
      const t = clamp((elapsed - i * GENIE_STAGGER_MS) / GENIE_MS, 0, 1);
      if (t < 1) drawGenie(ctx, src, scale, rect, to, t);
    });
    if (elapsed < total) requestAnimationFrame(frame);
    else {
      canvas.remove();
      done();
    }
  };
  // Draw the first frame now, so there's no blank frame between the pills
  // hiding and the canvas showing them.
  frame(start);
}

/** The bell's centre, where a genie lands; null when there's no bell. */
export function bellCentre(): Pt | null {
  const el = document.querySelector<HTMLElement>('[data-slot="notification-bell"]');
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

export function NotificationCenter({
  open,
  onClosed,
  label,
  children,
}: {
  open: boolean;
  /** The pills are in the bell; unmount them. */
  onClosed: () => void;
  label: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const fontCss = useRef<Promise<string> | null>(null);
  /** Snapshots of the pills, taken while they're up, so a close can start
   *  flying in the same press: a sidebar click leaves this screen right
   *  after, and the pills are gone before an on-demand snapshot would land. */
  const shotsRef = useRef<HTMLCanvasElement[] | null>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  /** Pills are on the canvas now, not in the DOM column. */
  const [flying, setFlying] = useState(false);
  const [bell, setBell] = useState<{ right: number; top: number } | null>(null);

  // Where the column hangs: 5% down the screen's window
  // (`[data-app-window]`), off the topbar's right gutter.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const w = document.querySelector<HTMLElement>("[data-app-window]")?.getBoundingClientRect();
      const el = document.querySelector<HTMLElement>('[data-slot="notification-bell"]');
      if (!el) return setBell(null);
      const b = el.getBoundingClientRect();
      // The topbar's right-hand cluster (bell, New, profile) ends on the
      // page's gutter; the header itself runs to the window edge.
      const header = el.closest("header");
      const cluster = el.closest("header > div")?.getBoundingClientRect();
      const bottom = header?.getBoundingClientRect().bottom;
      setBell({
        right: cluster ? window.innerWidth - cluster.right : 12,
        // 5% of the way down the window (Ronald, 2026-10-02, tuned by eye:
        // 30%, 15%, 10%, then 5%).
        top: w ? w.top + w.height * 0.05 : bottom ? bottom + 8 : b.bottom + 16,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  const capture = useCallback(async (pills: HTMLElement[]) => {
    const fontEmbedCSS = (await fontCss.current) || undefined;
    const pixelRatio = window.devicePixelRatio || 1;
    return Promise.all(pills.map((el) => toCanvas(el, { pixelRatio, fontEmbedCSS })));
  }, []);

  // Embedding the app's fonts is the slow part of a snapshot, so do it once,
  // while the pills are up, not at the moment someone clicks away. Then
  // snapshot the pills once they've slid in, and again if what they say
  // changes.
  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root || reduced) return;
    fontCss.current = getFontEmbedCSS(root).catch(() => "");
    let timer = 0;
    const take = (delay: number) => {
      window.clearTimeout(timer);
      shotsRef.current = null;
      timer = window.setTimeout(() => {
        if (closingRef.current) return;
        const pills = [...root.querySelectorAll<HTMLElement>("[data-nc-pill]")];
        capture(pills)
          .then((shots) => {
            if (!closingRef.current) shotsRef.current = shots;
          })
          .catch(() => {});
      }, delay);
    };
    take(PILLS_IN_MS);
    const observer = new MutationObserver(() => take(150));
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [open, reduced, capture]);

  const close = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);

    const root = rootRef.current;
    const bellEl = document.querySelector<HTMLElement>('[data-slot="notification-bell"]');
    const pills = root ? [...root.querySelectorAll<HTMLElement>("[data-nc-pill]")] : [];
    const rects = pills.map((el) => el.getBoundingClientRect());
    const finish = () => {
      closingRef.current = false;
      setClosing(false);
      setFlying(false);
      onClosed();
    };

    if (reduced || !bellEl || !pills.length) {
      window.setTimeout(finish, FADE_MS);
      return;
    }

    const b = bellEl.getBoundingClientRect();
    const to = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    let srcs = shotsRef.current;
    if (srcs?.length !== pills.length) {
      try {
        srcs = await capture(pills);
      } catch {
        window.setTimeout(finish, FADE_MS);
        return;
      }
    }

    setFlying(true);
    flyIntoBell(
      srcs.map((src, i) => ({ src, rect: rects[i] })),
      to,
      finish,
    );
  }, [onClosed, reduced, capture]);

  // A press anywhere off the cards closes it, without eating the press: the
  // overlay lets clicks through, so a sidebar tab or button still works on the
  // first click (Ronald, 2026-10-04). Not while a dialog opened from a pill is up.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-nc-pill]")) return;
      // Switching tabs isn't putting the pills away: they go with the screen,
      // no genie, and the next tab brings up its own (Ronald, 2026-10-04).
      const link = target?.closest?.<HTMLAnchorElement>("a[href]");
      if (link && link.pathname !== window.location.pathname) return;
      if (document.querySelector(".app-modal-backdrop")) return;
      void close();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  // Escape closes it too, unless a dialog opened from a pill is the one up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".app-modal-backdrop")) return;
      void close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  // macOS's width.
  const columnWidth = Math.min(COLUMN_PX, window.innerWidth - 32);
  // Inset from the window's right edge, as macOS keeps its column off the
  // screen edge.
  const right = (bell?.right ?? 12) + COLUMN_INSET_PX;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-label={label}
      data-closing={closing ? "" : undefined}
      className="app-nc pointer-events-none fixed inset-0 z-[400]"
    >
      <div
        className="pointer-events-auto absolute flex flex-col gap-2.5"
        style={{ top: bell?.top ?? 72, right, width: columnWidth }}
      >
        {/* Blur only behind what's in the column (Ronald): the heading and
            cards' box plus a feathered margin, not the empty column below. */}
        <div aria-hidden className="app-nc-blur" />
        <div className="app-nc-heading flex items-center justify-between px-1 pb-1">
          <h2 className={`${sohne.className} text-[1.25rem] tracking-tight text-[#1c1917]`}>
            {label}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              void close();
            }}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/10 text-[#44403c] transition-colors duration-150 hover:bg-black/15"
          >
            <X size={14} strokeWidth={2.25} />
          </button>
        </div>
        <div
          className="flex flex-col gap-2.5"
          style={{ visibility: flying ? "hidden" : undefined }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** One notice in the center: macOS's notification card in the landing's Get
 *  Started black, with the count line (user 2026-10-02: a fixed template, no
 *  generated copy) and one white button that does it. */
export function NotificationCard({
  icon,
  title,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div
      data-nc-pill=""
      className={`${satoshi.className} flex w-full items-center gap-3 rounded-[22px] bg-black/80 p-3 text-white shadow-[0_8px_24px_rgb(0_0_0/0.18)] backdrop-blur-xl`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12">
        {icon}
      </span>
      <span className={`${sohne.className} min-w-0 flex-1 truncate text-[1rem] tracking-tight`}>
        {title}
      </span>
      <Button size="sm" className="bg-white text-[#1c1917] hover:bg-white/90" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

/** Which tab each Librarian task belongs to: its pill pops up there, and
 *  Notifications groups the Librarian rows by it (Ronald 2026-10-04). */
export const LIBRARIAN_GROUPS: { label: string; href: string; kinds: Task["kind"][] }[] = [
  { label: "Workspace", href: "/workspace", kinds: ["librarian_sort", "librarian_review"] },
  { label: "Ownership", href: "/ownership", kinds: ["ownership_review", "ownership_stuck"] },
  { label: "Sharing", href: "/sharing", kinds: ["share_suggestions"] },
  { label: "Offboarding", href: "/offboarding", kinds: ["offboarded"] },
];

/** A pill's title and button for one Librarian task. */
function pillFor(task: Task): { title: string; action: string } | null {
  switch (task.kind) {
    case "librarian_sort":
      return { title: `${plural(task.count, "file", "files")} to sort`, action: "Sort" };
    case "librarian_review":
      return { title: `${plural(task.count, "file", "files")} to review`, action: "Review" };
    case "ownership_review":
      return {
        title: `${plural(task.count, "file", "files")} to ${task.toName ?? "a new owner"}`,
        action: "Review",
      };
    case "ownership_stuck":
      return {
        // Short enough for the pill (Ronald 2026-10-04: "too long").
        title: `${plural(task.count, "file", "files")} stuck`,
        action: task.count === 1 ? "See it" : "See them",
      };
    case "share_suggestions":
      return { title: `${plural(task.count, "file", "files")} to share`, action: "Review" };
    case "offboarded":
      return { title: `${task.personName ?? "Someone"} was offboarded`, action: "Clear" };
    default:
      return null;
  }
}

/** The genie librarian on a tab (user 2026-10-02, every tab per Ronald
 *  2026-10-04): when this tab has Librarian tasks, their pills pop up once
 *  per visit, then genie into the bell, where Notifications keeps them. */
export function LibrarianPopup({
  kinds,
  onAction,
}: {
  kinds: Task["kind"][];
  onAction: (task: Task) => void;
}) {
  const { tasks } = useUpdates();
  const mine = tasks.filter((t) => kinds.includes(t.kind));
  /** `waiting` until this tab first has something; `open` while the pills
   *  are up; `tucked` once they've gone into the bell (for this visit). */
  const [state, setState] = useState<"waiting" | "open" | "tucked">("waiting");
  const show = mine.length > 0;
  useEffect(() => {
    // Tasks arrive from the app-wide fetch; the first time this tab has any,
    // the pills come up.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (show) setState((s) => (s === "waiting" ? "open" : s));
  }, [show]);

  return (
    <NotificationCenter
      open={state === "open"}
      onClosed={() => setState("tucked")}
      label="Your Librarian"
    >
      {mine.map((task) => {
        const pill = pillFor(task);
        return pill ? (
          <NotificationCard
            key={`${task.kind}-${task.id}`}
            icon={<Library size={20} strokeWidth={NAV_STROKE} />}
            title={pill.title}
            action={pill.action}
            onAction={() => onAction(task)}
          />
        ) : null;
      })}
    </NotificationCenter>
  );
}
