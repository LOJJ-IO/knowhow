"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { animate, motion, motionValue } from "framer-motion";
import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import { readSplitTiming } from "@/components/landing/get-started-cta";

const GOOGLE_LETTERS = [
  { char: "G", color: "#4285F4" },
  { char: "o", color: "#EA4335" },
  { char: "o", color: "#FBBC05" },
  { char: "g", color: "#4285F4" },
  { char: "l", color: "#34A853" },
  { char: "e", color: "#EA4335" },
] as const;

/** The card deck: the Mac-window cards, their Notes panel, the mobile cover
 *  flow and the desktop round-table ring.
 *
 *  One tenant, one file. The landing page mounts `DesktopDeck` / `DeckCoverFlow`
 *  and otherwise knows nothing about window chrome, dragging or folders. */

/** One feature per card; carousel is a round-table ring of all seven. First
 *  three rise/spread in; the rest park off-stage until seated. Mats cycle
 *  green / blue / red / yellow. `note` = proposal "Why It's Good" (Org-Chart
 *  uses the agreed Option A — proposal had no Why for that feature). */
export const DECK_CARDS = [
  {
    id: "unified",
    mat: "green",
    title: "Unified Workspace",
    entrance: "left",
    note: "Eliminates file clutter, ensures all Google Drive documents live in one predictable location, and prevents files from getting lost in personal drives.",
  },
  {
    id: "auto-own",
    mat: "blue",
    title: "Auto-Own",
    entrance: "center",
    note: "Top Leaders can edit or move documents instantly without asking for permission, and critical files never stay trapped under an individual's account.",
  },
  {
    id: "auto-share",
    mat: "red",
    title: "Auto-Share",
    entrance: "right",
    note: "Prevents human error, saves time spent asking for document links, and guarantees people have immediate access to the files they need.",
  },
  {
    id: "oversight",
    mat: "yellow",
    title: "Oversight",
    note: "Keeps Top Leaders fully informed without requiring individuals to send manual updates, links, or status emails.",
  },
  {
    id: "deepsearch",
    mat: "green",
    title: "DeepSearch",
    note: "Saves valuable work hours by allowing individuals and managers to instantly locate any document, even if it wasn't manually shared with them directly.",
  },
  {
    id: "org-chart",
    mat: "blue",
    title: "Org-Chart & Permissions",
    note: "Makes ownership and access rules follow your real teams, so the right people see the right work without anyone having to remember who to share with.",
  },
  {
    id: "offboard",
    mat: "red",
    title: "Instant Offboard",
    note: "Protects confidential company information, eliminates data leak security risks, and keeps all created assets safely inside the organization.",
  },
] as const;
type DeckCard = (typeof DECK_CARDS)[number];
type DeckEntrance = "left" | "center" | "right";



export function GoogleWorkspaceMark() {
  return (
    <>
      <span className={`${satoshi.className} font-bold`}>
        {GOOGLE_LETTERS.map(({ char, color }, i) => (
          <span key={i} style={{ color }}>
            {char}
          </span>
        ))}
      </span>
      <span className={`${satoshi.className} font-normal`}> Workspace</span>
    </>
  );
}

function DeckChrome({
  title,
  onDragPointerDown,
  onClose,
}: {
  title: string;
  onDragPointerDown?: (e: React.PointerEvent) => void;
  onClose?: () => void;
}) {
  return (
    <div
      className="t-deck-titlebar"
      onPointerDown={onDragPointerDown}
      style={onDragPointerDown ? { touchAction: "none" } : undefined}
    >
      <div className="t-deck-traffic" aria-hidden={!onClose}>
        {onClose ? (
          <button
            type="button"
            className="t-deck-dot t-deck-dot--close t-deck-dot--btn"
            aria-label="Close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <svg
              className="t-deck-dot-x"
              viewBox="0 0 12 12"
              aria-hidden
            >
              <path
                d="M3.2 3.2l5.6 5.6M8.8 3.2l-5.6 5.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : (
          <span className="t-deck-dot t-deck-dot--close" />
        )}
        <span className="t-deck-dot t-deck-dot--min" />
        <span className="t-deck-dot t-deck-dot--max" />
      </div>
      <span className={`${sohne.className} t-deck-title`}>{title}</span>
    </div>
  );
}

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const RESIZE_HANDLES: ResizeHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

type WindowBox = { x: number; y: number; w: number; h: number };

/** Main feature window — matches reference (wide, top-left inset). */
const DEFAULT_WINDOW_BOX: WindowBox = { x: 5.1, y: 8.9, w: 80.4, h: 79.8 };
/** Resize floor (width was 39, −10%). Notes opens at it. */
const MIN_WINDOW_W_PCT = 35.1;
const MIN_WINDOW_H_PCT = 28;
/** Notes opens at the resize floor (same as min w/h). Bottom-right overlap. */
const NOTES_WINDOW_BOX: WindowBox = {
  x: 61.7,
  y: 66,
  w: MIN_WINDOW_W_PCT,
  h: MIN_WINDOW_H_PCT,
};

function clampWindowBox(box: WindowBox): WindowBox {
  const w = Math.min(100, Math.max(MIN_WINDOW_W_PCT, box.w));
  const h = Math.min(100, Math.max(MIN_WINDOW_H_PCT, box.h));
  const x = Math.min(100 - w, Math.max(0, box.x));
  const y = Math.min(100 - h, Math.max(0, box.y));
  return { x, y, w, h };
}

/** Inset mac window — drag via title bar; resize from all edges/corners. */
function InteractiveMacWindow({
  title,
  initialBox = DEFAULT_WINDOW_BOX,
  zIndex = 1,
  onClose,
  children,
}: {
  title: string;
  initialBox?: WindowBox;
  zIndex?: number;
  onClose?: () => void;
  children?: React.ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<WindowBox>(initialBox);
  const interactionRef = useRef<{
    mode: "drag" | "resize";
    handle?: ResizeHandle;
    startX: number;
    startY: number;
    start: WindowBox;
    parentW: number;
    parentH: number;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    function clearDragChrome() {
      document.documentElement.classList.remove("t-deck-dragging");
      document.body.classList.remove("t-deck-dragging");
      document.body.style.removeProperty("user-select");
    }

    function onMove(e: PointerEvent) {
      const active = interactionRef.current;
      if (!active || e.pointerId !== active.pointerId) return;
      const dx = ((e.clientX - active.startX) / active.parentW) * 100;
      const dy = ((e.clientY - active.startY) / active.parentH) * 100;
      const s = active.start;

      if (active.mode === "drag") {
        setBox(clampWindowBox({ ...s, x: s.x + dx, y: s.y + dy }));
        return;
      }

      const handle = active.handle!;
      const next = { ...s };
      if (handle.includes("e")) next.w = s.w + dx;
      if (handle.includes("w")) {
        next.x = s.x + dx;
        next.w = s.w - dx;
      }
      if (handle.includes("s")) next.h = s.h + dy;
      if (handle.includes("n")) {
        next.y = s.y + dy;
        next.h = s.h - dy;
      }
      setBox(clampWindowBox(next));
    }

    function onUp(e: PointerEvent) {
      const active = interactionRef.current;
      if (!active) {
        clearDragChrome();
        return;
      }
      if (e.pointerId !== active.pointerId) return;
      interactionRef.current = null;
      clearDragChrome();
    }

    function onLostCapture() {
      if (!interactionRef.current) return;
      interactionRef.current = null;
      clearDragChrome();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onLostCapture);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onLostCapture);
      clearDragChrome();
    };
  }, []);

  function beginInteraction(
    e: React.PointerEvent,
    mode: "drag" | "resize",
    handle?: ResizeHandle,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const parent = shellRef.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const target = e.currentTarget as HTMLElement;
    interactionRef.current = {
      mode,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      start: box,
      parentW: rect.width,
      parentH: rect.height,
      pointerId: e.pointerId,
    };
    document.body.style.userSelect = "none";
    if (mode === "drag") {
      document.documentElement.classList.add("t-deck-dragging");
      document.body.classList.add("t-deck-dragging");
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can fail on some targets — drag still works via window listeners
      }
      const onLost = () => {
        target.removeEventListener("lostpointercapture", onLost);
        if (interactionRef.current?.pointerId === e.pointerId) {
          interactionRef.current = null;
        }
        document.documentElement.classList.remove("t-deck-dragging");
        document.body.classList.remove("t-deck-dragging");
        document.body.style.removeProperty("user-select");
      };
      target.addEventListener("lostpointercapture", onLost);
    }
  }

  return (
    <div
      ref={shellRef}
      className="t-deck-window t-deck-window--interactive"
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.w}%`,
        height: `${box.h}%`,
        zIndex,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <DeckChrome
        title={title}
        onDragPointerDown={(e) => beginInteraction(e, "drag")}
        onClose={onClose}
      />
      {children ? <div className="t-deck-window-body">{children}</div> : null}
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          className={`t-deck-resize t-deck-resize--${handle}`}
          onPointerDown={(e) => beginInteraction(e, "resize", handle)}
          aria-hidden
        />
      ))}
    </div>
  );
}

const DEFAULT_FOLDER_POS = { x: 86, y: 3 };
const FOLDER_DRAG_THRESHOLD = 6;

/** Finder-style desktop folder — draggable; click toggles the Notes window.
 *  Desktop-only: on mobile the folder is hidden (`globals.css`) and the
 *  active card's note shows automatically in a panel below the Cover Flow
 *  stage instead (`DeckCoverFlow`) — a tiny landscape card has no room for a
 *  second floating, draggable window, and there's no need to tap for it. */
function NotesFolder({
  note,
  open,
  onOpenChange,
}: {
  note: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const folderRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState(DEFAULT_FOLDER_POS);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    parentW: number;
    parentH: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    function clearDragChrome() {
      document.documentElement.classList.remove("t-deck-dragging");
      document.body.classList.remove("t-deck-dragging");
      document.body.style.removeProperty("user-select");
    }

    function onMove(e: PointerEvent) {
      const active = dragRef.current;
      if (!active || e.pointerId !== active.pointerId) return;
      const dxPx = e.clientX - active.startX;
      const dyPx = e.clientY - active.startY;
      if (
        !active.moved &&
        Math.hypot(dxPx, dyPx) > FOLDER_DRAG_THRESHOLD
      ) {
        active.moved = true;
        document.documentElement.classList.add("t-deck-dragging");
        document.body.classList.add("t-deck-dragging");
      }
      if (!active.moved) return;
      const dx = (dxPx / active.parentW) * 100;
      const dy = (dyPx / active.parentH) * 100;
      setPos({
        x: Math.min(92, Math.max(0, active.originX + dx)),
        y: Math.min(88, Math.max(0, active.originY + dy)),
      });
    }

    function onUp(e: PointerEvent) {
      const active = dragRef.current;
      if (!active || e.pointerId !== active.pointerId) return;
      const wasDrag = active.moved;
      dragRef.current = null;
      clearDragChrome();
      if (!wasDrag) {
        onOpenChange(!open);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      clearDragChrome();
    };
  }, [onOpenChange, open]);

  function onFolderPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const parent = folderRef.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      parentW: rect.width,
      parentH: rect.height,
      pointerId: e.pointerId,
      moved: false,
    };
    document.body.style.userSelect = "none";
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // capture optional — window listeners still drive the drag
    }
  }

  return (
    <>
      <button
        ref={folderRef}
        type="button"
        className="t-deck-folder"
        aria-label={open ? "Close Notes" : "Open Notes"}
        aria-expanded={open}
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        onPointerDown={onFolderPointerDown}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="t-deck-folder-hit">
          <picture>
            <source srcSet="/deck/folder.avif" type="image/avif" />
            <source srcSet="/deck/folder.webp" type="image/webp" />
            { }
            <img
              src="/deck/folder.png"
              alt=""
              width={98}
              height={86}
              className="t-deck-folder-icon"
              draggable={false}
            />
          </picture>
        </span>
        <span className={`${sohne.className} t-deck-folder-label`}>Notes</span>
      </button>
      {open ? (
        <div className="hidden md:contents">
          <InteractiveMacWindow
            title="Notes"
            initialBox={NOTES_WINDOW_BOX}
            zIndex={4}
          >
            <p className={`${sohne.className} t-deck-notes-copy`}>{note}</p>
          </InteractiveMacWindow>
        </div>
      ) : null}
    </>
  );
}

function DeckWindow({
  card,
  parkSlot,
  focused = false,
  ref,
  style,
  onPointerDownCapture,
  onClickCapture,
}: {
  card: DeckCard;
  /** Off-stage slot while CSS entrance plays (cards without an entrance seat). */
  parkSlot?: number;
  focused?: boolean;
  ref?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  onPointerDownCapture?: (e: React.PointerEvent) => void;
  /** Side-slot swipe: use capture so window/folder stopPropagation can't block it. */
  onClickCapture?: (e: React.MouseEvent) => void;
}) {
  const entrance = "entrance" in card ? (card.entrance as DeckEntrance) : null;
  // Notes window starts open; the folder toggles it closed/open.
  const [notesOpen, setNotesOpen] = useState(true);

  return (
    <div
      ref={ref}
      style={
        parkSlot != null
          ? { ...style, ["--deck-park-slot" as string]: parkSlot }
          : style
      }
      onPointerDownCapture={onPointerDownCapture}
      onClickCapture={onClickCapture}
      className={[
        "t-deck-card",
        "t-deck-card--mat",
        `t-deck-card--${card.mat}`,
        entrance ? `t-deck-card--${entrance}` : null,
        parkSlot != null ? "t-deck-card--park" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-focus={focused ? "true" : "false"}
    >
      <div className={`t-deck-mat t-deck-mat--${card.mat}`} aria-hidden />
      <InteractiveMacWindow title={card.title} />
      <NotesFolder
        note={card.note}
        open={notesOpen}
        onOpenChange={setNotesOpen}
      />
    </div>
  );
}



/** Swipe past this many px, more horizontal than vertical, to step the deck. */
const COVER_SWIPE_THRESHOLD = 40;
/** Below this, a pointer down/up counts as a tap (select the tapped card). */
const COVER_TAP_THRESHOLD = 8;

/** Mobile Cover Flow — landscape mac windows, same as desktop, scaled down
 *  (CardCoverFlow pattern). Navigation is the split Get Started arrows below
 *  it (no separate nav bar) plus a swipe on the stage itself. `InteractiveMacWindow`
 *  stops propagation on its own pointerdown (so it isn't misread as a deck
 *  click elsewhere) — same reason `DesktopDeck`'s card-step detection uses
 *  capture, so it does here too. A down that starts on a titlebar (window
 *  drag), the Notes folder, or a resize handle never starts a swipe, so
 *  those gestures don't fight it. */
export function DeckCoverFlow({
  activeIndex,
  onActiveIndexChange,
}: {
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}) {
  const swipeStart = useRef<{ x: number; y: number; id: number } | null>(
    null,
  );

  function onStagePointerDownCapture(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (
      (e.target as HTMLElement).closest(
        ".t-deck-titlebar, .t-deck-folder, .t-deck-resize",
      )
    ) {
      swipeStart.current = null;
      return;
    }
    swipeStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  function onStagePointerUpCapture(e: React.PointerEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (
      Math.abs(dx) > COVER_SWIPE_THRESHOLD &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      const dir = dx < 0 ? 1 : -1;
      onActiveIndexChange(
        Math.min(DECK_CARDS.length - 1, Math.max(0, activeIndex + dir)),
      );
      return;
    }
    if (Math.hypot(dx, dy) > COVER_TAP_THRESHOLD) return;
    const target = (e.target as HTMLElement).closest("[data-cover-index]");
    if (!target) return;
    onActiveIndexChange(Number(target.getAttribute("data-cover-index")));
  }

  return (
    <div className="t-deck-cover">
      <div
        className="t-deck-cover-stage"
        onPointerDownCapture={onStagePointerDownCapture}
        onPointerUpCapture={onStagePointerUpCapture}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {DECK_CARDS.map((card, i) => {
          const offset = i - activeIndex;
          const absOffset = Math.abs(offset);
          const isActive = offset === 0;
          const isPast = i < activeIndex;

          return (
            <motion.div
              key={card.id}
              data-cover-index={i}
              className="t-deck-cover-item"
              initial={false}
              animate={{
                x: offset * 80,
                rotateY: isActive ? 0 : isPast ? 38 : -38,
                z: isActive ? 50 : -absOffset * 50,
                scale: isActive ? 1.08 : 1 - absOffset * 0.08,
                opacity: absOffset > 2 ? 0 : 1 - absOffset * 0.22,
              }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              style={{ zIndex: 100 - absOffset }}
            >
              <DeckWindow card={card} focused={isActive} />
            </motion.div>
          );
        })}
      </div>

      {/* Auto-open: the active card's note shows here without a tap — a
       *  landscape card this small has no room for a second floating window,
       *  and the folder-click affordance is desktop-only (hidden here). */}
      <div className="t-deck-cover-notes">
        <p className={`${sohne.className} t-deck-cover-notes-title`}>
          {DECK_CARDS[activeIndex].title}
        </p>
        <p className={`${sohne.className} t-deck-cover-notes-copy`}>
          {DECK_CARDS[activeIndex].note}
        </p>
      </div>
    </div>
  );
}

/** Desktop carousel — feature order as first seated, left → right → off-stage. */
const DESKTOP_DECK = DECK_CARDS;
const DESKTOP_DECK_N = DESKTOP_DECK.length;

/** Every on-screen move shares one spring (ζ≈0.91: soft, no wobble on a
 *  surface this big, ~0.6s to rest), including the card thrown off-stage — so
 *  it can never be slower than the cards following it, even mid-flight on rapid
 *  clicks. Moves cascade 70ms apart in the direction of travel. The cascade also keeps layering clean: incoming and outgoing centre
 *  cards overlap at rest, but by the time they're equidistant from centre —
 *  where they swap which is on top — the lag has pulled them ~92vw apart,
 *  wider than a card at every desktop width, so the swap happens in clear air. */
const DECK_SPRING = {
  type: "spring",
  stiffness: 120,
  damping: 20,
  restDelta: 0.0005,
  restSpeed: 0.005,
} as const;
const DECK_STAGGER_S = 0.07;
/** Cap on the throw speed carried through the wrap, slots/s. */
const DECK_MAX_CARRY = 6;
/** |slot| past which a card is fully off-screen at every desktop width. */
const DECK_OFFSTAGE = 1.6;
/** The thrown card re-enters no earlier than this after the click, so it's the
 *  last beat: it slides into the trailing slot as the card ahead clears it. */
const DECK_ENTER_AT_MS = 340;
/** Closing is the entrance backwards: time-reversed --deck-spread-ease for the
 *  fold, time-reversed --deck-rise-ease for the sink. */
const DECK_FOLD_EASE = [0.64, 0, 0.78, 0] as const;
const DECK_SINK_EASE = [0.7, 0, 0.75, 0.15] as const;

/** Slot → transform, in slot units: −1 left, 0 centre, +1 right, ±2 off-stage.
 *  At whole slots this is exactly where the CSS entrance leaves each card
 *  (`t-deck-spread-*` in globals.css), so seating is seamless; between slots x
 *  scales linearly and the side drop ramps in over the first slot. */
/*  `sink` (0 → 1) lowers the deck to where the rise starts: at p = 0, sink = 1
 *  this is exactly the CSS base transform (−50%, −50% + --deck-sunk). */
function deckTransform(p: number, sink = 0) {
  const drop = Math.min(Math.abs(p), 1);
  return `translate3d(calc(-50% + var(--deck-side-x) * ${p}), calc(-50% + var(--deck-band-y) + var(--deck-side-drop) * ${drop} + (var(--deck-sunk, 110vh) - var(--deck-band-y)) * ${sink}), 0)`;
}

/** Closer to centre = on top; `bias` breaks the tie when cards converge. */
function deckLayer(p: number, bias = 0) {
  return String(Math.round(100 - Math.abs(p) * 20) + bias);
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export type DeckHandle = { shift: (dir: -1 | 1) => void; close: () => void };

/** Desktop deck. The CSS entrance (rise + spread) plays untouched; once
 *  `seated`, each card's position is a motion value in slot units and `shift`
 *  rotates the ring: the leading card is thrown off, the rest step one slot,
 *  and the thrown card comes back in from the trailing edge. Interruptible —
 *  a click mid-flight retargets from the current position and velocity. */
export function DesktopDeck({
  seated,
  ref,
  onCardStep,
}: {
  seated: boolean;
  ref: React.Ref<DeckHandle>;
  /** Clicking the card in the left / right slot does what that arrow does. */
  onCardStep?: (side: "left" | "right") => void;
}) {
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const cardDown = useRef<{ x: number; y: number } | null>(null);
  const [slots] = useState(() =>
    DESKTOP_DECK.map((_, i) => motionValue(i - 1)),
  );
  const offset = useRef(0);
  const runs = useRef(DESKTOP_DECK.map(() => 0));
  const detach = useRef<((() => void) | undefined)[]>([]);
  const [sink] = useState(() => motionValue(0));
  /** While closing: −1 on every card but the centre one, so it stays on top
   *  as the others fold under it. */
  const bias = useRef(DESKTOP_DECK.map(() => 0));

  // Take over from the CSS entrance: the inline transform lands on its final
  // frame in the same commit that drops the animation, so nothing moves.
  // Cards without an entrance seat park off-stage via CSS until seating.
  useLayoutEffect(() => {
    if (!seated) return;
    // Snapshot the nodes now: the card ref callbacks are recreated every
    // render, so by the time this cleanup runs React has already called them
    // with null — reading `cards.current` then found no nodes, the inline
    // z-index from the close survived, and the next Get Started rose the
    // centre card under the side cards.
    const els = [...cards.current];
    const paint = (i: number) => {
      const el = els[i];
      if (!el) return;
      const p = slots[i].get();
      el.style.transform = deckTransform(p, sink.get());
      el.style.zIndex = deckLayer(p, bias.current[i]);
    };
    const paintAll = () => slots.forEach((_, i) => paint(i));
    paintAll();
    const offs = [
      ...slots.map((mv, i) => mv.on("change", () => paint(i))),
      sink.on("change", paintAll),
    ];
    const pending = runs.current;
    const listeners = detach.current;
    return () => {
      offs.forEach((off) => off());
      // Unseated only once the deck has closed and sunk — exactly where the
      // CSS base transform parks every card — so hand back to CSS and reset
      // the ring for the next Get Started.
      slots.forEach((mv, i) => {
        pending[i]++;
        listeners[i]?.();
        mv.jump(i - 1);
        els[i]?.style.removeProperty("transform");
        els[i]?.style.removeProperty("z-index");
      });
      sink.jump(0);
      bias.current = DESKTOP_DECK.map(() => 0);
      offset.current = 0;
    };
  }, [seated, slots, sink]);

  useImperativeHandle(
    ref,
    () => ({
      /** `dir` is the way the cards travel: −1 sends them left. */
      shift(dir) {
        if (!seated) return;
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const clickAt = performance.now();
        const prev = offset.current;
        offset.current = prev - dir;
        DESKTOP_DECK.forEach((_, i) => {
          const from = mod(i - prev, DESKTOP_DECK_N) - 1;
          const to = mod(i - offset.current, DESKTOP_DECK_N) - 1;
          const mv = slots[i];
          const run = ++runs.current[i];
          detach.current[i]?.();
          if (reduce) {
            mv.set(to);
            return;
          }
          // Leading card first; anything already moving retargets at once.
          const rank = 1 - from * dir;
          const delay = mv.isAnimating() ? 0 : rank * DECK_STAGGER_S;
          const wraps = dir < 0 ? to > mv.get() : to < mv.get();
          if (!wraps) {
            animate(mv, to, { ...DECK_SPRING, delay });
            return;
          }
          // Thrown off the leading edge, re-enters from the trailing one. The
          // swap happens the moment it's fully off-screen, between two
          // off-screen positions. `jump` (not `set`) so the spring doesn't read
          // the 4-slot leap as velocity and fling the card hundreds of slots;
          // off-screen it can wait for its cue, else it keeps its real speed.
          const reenter = () => {
            const v = mv.getVelocity();
            mv.jump(-2 * dir);
            const wait = Math.max(
              0,
              clickAt + DECK_ENTER_AT_MS - performance.now(),
            );
            const carry =
              wait === 0 && Math.sign(v) === dir
                ? Math.min(Math.abs(v), DECK_MAX_CARRY) * dir
                : 0;
            animate(mv, to, {
              ...DECK_SPRING,
              velocity: carry,
              delay: wait / 1000,
            });
          };
          // Already off-screen on the leading side (e.g. parked waiting for its
          // cue when the direction reverses): there's nothing to exit — swap now.
          if (mv.get() * dir >= DECK_OFFSTAGE) {
            reenter();
            return;
          }
          const exit = animate(mv, 2 * dir, { ...DECK_SPRING, delay });
          const off = mv.on("change", (p) => {
            if (p * dir < DECK_OFFSTAGE) return;
            off();
            if (runs.current[i] !== run) return;
            exit.stop();
            reenter();
          });
          detach.current[i] = off;
        });
      },
      /** The entrance backwards: everything on the band folds in under the
       *  centre card (parked cards stay off-stage), then the stack sinks. */
      close() {
        if (!seated) return;
        const { hold, travel } = readSplitTiming();
        const centre = slots.reduce(
          (best, mv, i) =>
            Math.abs(mv.get()) < Math.abs(slots[best].get()) ? i : best,
          0,
        );
        bias.current = DESKTOP_DECK.map((_, i) => (i === centre ? 0 : -1));
        slots.forEach((mv, i) => {
          runs.current[i]++;
          detach.current[i]?.();
          if (Math.abs(mv.get()) >= DECK_OFFSTAGE) {
            mv.stop();
            return;
          }
          animate(mv, 0, { duration: travel / 1000, ease: DECK_FOLD_EASE });
        });
        animate(sink, 1, {
          duration: hold / 1000,
          ease: DECK_SINK_EASE,
          delay: travel / 1000,
        });
      },
    }),
    [seated, slots, sink],
  );

  return (
    <>
      {DESKTOP_DECK.map((card, i) => (
        <DeckWindow
          key={card.id}
          card={card}
          parkSlot={"entrance" in card ? undefined : i - 1}
          ref={(el) => {
            cards.current[i] = el;
          }}
          style={seated ? { animation: "none" } : undefined}
          // Capture on the card: side-slot swipe fires for wallpaper, window,
          // folder — children's stopPropagation can't block capture. Centre
          // slot never steps (p ≈ 0). Drags (>6px) don't count as a click.
          onPointerDownCapture={(e) => {
            cardDown.current =
              e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
          }}
          onClickCapture={(e) => {
            const down = cardDown.current;
            cardDown.current = null;
            if (!onCardStep || !down) return;
            if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
            const p = slots[i].get();
            if (Math.abs(p + 1) < 0.5) onCardStep("left");
            else if (Math.abs(p - 1) < 0.5) onCardStep("right");
          }}
        />
      ))}
    </>
  );
}
