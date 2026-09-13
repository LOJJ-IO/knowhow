"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import localFont from "next/font/local";
import { animate, motion, motionValue } from "framer-motion";
import { Liquid } from "liquid-gooey";
import { LogoMark, sohne } from "@/components/brand/logo-mark";
import { GuidelinesOverlay } from "@/components/brand/guidelines-overlay";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(SplitText, useGSAP);

const lojjFont = localFont({
  src: "../../fonts/logo/LOGO.otf",
  weight: "400",
  style: "normal",
});

const satoshi = localFont({
  src: [
    {
      path: "../../fonts/satoshi/Satoshi-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/satoshi/Satoshi-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/satoshi/Satoshi-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
});

/** Desktop — prior committed lockup scale (em-positioned composition), −15% then −10% then −10%. */
const DESKTOP_LOGO_FONT_SIZE = "clamp(2.168775rem,7.745625vw,7.745625rem)";
/** Desktop subhead sits bottom-center; size only (placement is CSS), −10% then −10%. */
const DESKTOP_SUBHEAD_FONT_SIZE = "clamp(0.98415rem,2.95245vw,2.95245rem)";

/** Mobile — Your Creative–style centered scale, −15% then −10% then −10%. */
const MOBILE_LOGO_FONT_SIZE = "clamp(3.09825rem,15.147vw,6.1965rem)";
const MOBILE_SUBHEAD_FONT_SIZE = "clamp(1.549773rem,5.072018vw,2.817788rem)";

const GOOGLE_LETTERS = [
  { char: "G", color: "#4285F4" },
  { char: "o", color: "#EA4335" },
  { char: "o", color: "#FBBC05" },
  { char: "g", color: "#4285F4" },
  { char: "l", color: "#34A853" },
  { char: "e", color: "#EA4335" },
] as const;

/** One feature per card; carousel is a round-table ring of all seven. First
 *  three rise/spread in; the rest park off-stage until seated. Mats cycle
 *  green / blue / red / yellow. `note` = proposal "Why It's Good" (Org-Chart
 *  uses the agreed Option A — proposal had no Why for that feature). */
const DECK_CARDS = [
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

const EDITING_MODE_ENABLED =
  process.env.NEXT_PUBLIC_EDITING_MODE_ENABLED === "true";

function Spinner({
  size = 20,
  spinning = true,
}: {
  size?: number;
  spinning?: boolean;
}) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      className={spinning ? "animate-spin" : undefined}
      aria-hidden
      style={spinning ? { animationDuration: "1.1s" } : undefined}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.28} ${c * 0.72}`}
      />
    </svg>
  );
}

const CTA_CLASS =
  "relative inline-flex h-[47.896px] min-h-[29.638px] min-w-[134.112px] cursor-pointer items-center justify-center rounded-full bg-black/80 px-[1.297932rem] text-[1.13569rem] font-bold text-white shadow transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** One CTA body divides into two horizontally aligned daughters. */
const CTA_DIAMETER = 47.896;
const CTA_GAP = 8;
/** Half the final centre-to-centre distance. */
const CTA_OFFSET = (CTA_DIAMETER + CTA_GAP) / 2;

/** Choreography, in order. Each phase is its own visual beat; the body stays a
 *  single pill until `splitting`. */
type CtaPhase =
  | "idle"
  | "spinner"
  | "blank"
  | "arrows"
  | "splitting"
  | "controls"
  // Reverse, after a click outside the open deck: the pieces flow back into
  // the pill while the cards fold in (merging), then it holds while the deck
  // sinks (sinking) — and back through arrows → blank → idle.
  | "merging"
  | "sinking";

/** Phases in which the liquid layer, not the Layer-1 pill, is the CTA. */
const CTA_LIQUID_PHASES: readonly CtaPhase[] = [
  "splitting",
  "controls",
  "merging",
  "sinking",
];

const CTA_SPINNER_MS = 400;
const CTA_BLANK_MS = 220;
const CTA_ARROWS_MS = 280;
/** Grace after the daughters land before the goo hands off to real chrome. */
const CTA_SETTLE_MS = 120;

/** The daughters divide on the deck's schedule: the pill holds while the cards
 *  rise, then pinches apart with exactly the delay/duration/easing that drives
 *  `.t-deck-card--left/--right`. Read from the CSS vars so retuning the deck
 *  retunes the CTA with it; the fallbacks mirror `globals.css`. */
const CTA_SPLIT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // --deck-spread-ease
/** Played backwards, a cubic-bezier (x1, y1, x2, y2) becomes
 *  (1−x2, 1−y2, 1−x1, 1−y1): what settled in on the way out accelerates away
 *  on the way back. */
const CTA_SPLIT_EASE_REVERSE = "cubic-bezier(0.64, 0, 0.78, 0)";

function cssMs(name: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const ms = raw.endsWith("ms")
    ? parseFloat(raw)
    : raw.endsWith("s")
      ? parseFloat(raw) * 1000
      : NaN;
  return Number.isFinite(ms) ? ms : fallback;
}

/** Hold = --deck-rise-dur (the cards' spread delay), travel = --deck-spread-dur. */
function readSplitTiming() {
  return {
    hold: cssMs("--deck-rise-dur", 700),
    travel: cssMs("--deck-spread-dur", 1331),
  };
}

/** `active:scale-95` is the same press as CTA_CLASS; its 150ms transition is
 *  inline (the button's `transition` also carries the split). */
const CTA_DAUGHTER_CLASS =
  "cursor-pointer rounded-full active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** The same press, on each arrow's chevron (it lives in its own layer so it
 *  could stay parked while the pill pinched) — driven by its circle's :active.
 *  Literal per key so Tailwind can see the classes. */
const CTA_CHEVRON_PRESS: Record<(typeof CTA_DAUGHTERS)[number]["key"], string> = {
  prev: "group-has-[[data-step=prev]:active]/cta:scale-95",
  next: "group-has-[[data-step=next]:active]/cta:scale-95",
};

const CTA_DAUGHTERS = [
  { key: "prev", label: "Show left card", dir: -1 },
  { key: "next", label: "Show right card", dir: 1 },
] as const;

/** Buttons that stay hidden until Get Started is clicked, then goo out of the
 *  pill into their own slots (left of it in the row) as the pill divides. */
type CtaExtra = { key: string; label: string };

/** Liquid copy of an extra: the real button's typography (from CTA_CLASS) with
 *  no surface of its own — the goo paints it while it travels. */
const CTA_EXTRA_LIQUID_CLASS = cn(
  CTA_CLASS,
  "absolute inset-y-0 left-1/2 min-w-0 bg-transparent px-0 shadow-none",
);

/** Goo is only drawn within `filterPadding` of the group's box (the pill), so
 *  while extras are travelling it has to reach their furthest slot (~360px
 *  left of the pill at current sizes). */
const CTA_EXTRAS_REACH = 440;

/** Layers 2+3 — the pill divides in place. Each daughter starts as the WHOLE
 *  pill (`width: 100%` of the CTA box, so the two overlap into exactly the
 *  pill's silhouette) and, on the deck's spread timing, shrinks to a CTA-diameter
 *  circle while sliding to ±offset: the middle pinches, necks and lets go. Both
 *  sit on one shared centre with a fixed CTA height and only `width` and
 *  `translateX` ever change, so the division can only be horizontal. The
 *  liquid follows their rendered rects (`observe`) and paints the surface. */
function CtaSplitLayer({
  spread,
  settled,
  reverse = false,
  onStep,
  extras = [],
}: {
  spread: boolean;
  settled: boolean;
  /** Flowing back into the pill: no hold up front — in reverse the hold comes
   *  after, while the deck sinks. */
  reverse?: boolean;
  onStep?: (side: "left" | "right") => void;
  extras?: readonly CtaExtra[];
}) {
  const [timing] = useState(readSplitTiming);
  const move = (prop: string) =>
    reverse
      ? `${prop} ${timing.travel}ms ${CTA_SPLIT_EASE_REVERSE}`
      : `${prop} ${timing.travel}ms ${CTA_SPLIT_EASE} ${timing.hold}ms`;
  // Same alpha as the Layer-1 pill (`bg-black/80`) — no darken on handoff.
  const liquid = settled ? "settled" : "live";

  return (
    <div
      className="pointer-events-none absolute inset-0 [&_[data-gooey-svg]]:opacity-80 data-[liquid=settled]:[&_[data-gooey-svg]]:opacity-0"
      data-liquid={liquid}
    >
      {/* Positioning goes through `style`, not a class: the group renders an
          inline `position: relative` that beats any class, which collapses it to
          0px tall (its children are all absolute) — and a 0-height SVG paints
          nothing. Its own style spreads after that default, so this wins. */}
      <Liquid
        style={{ position: "absolute", inset: 0 }}
        blur={6}
        contrast={18}
        fill="#000"
        shadow="0 1px 3px rgb(0 0 0 / 0.18)"
        filterPadding={extras.length && !settled ? CTA_EXTRAS_REACH : undefined}
      >
        {/* Extras start as copies of the whole pill and stream left into their
            slots (measured into --cta-x-<key>-dx / -w by GetStartedCta) on the
            same schedule as the pinch; each label fades in as it arrives. Once
            settled they hide behind the real buttons in those slots, ready to
            flow back into the pill if the handoff is reversed. */}
        {extras.map(({ key, label }) => (
            <Liquid.Item
              key={key}
              observe
              radius={CTA_DIAMETER / 2}
              style={{ display: "block", position: "absolute", inset: 0 }}
            >
              <div
                aria-hidden
                className={CTA_EXTRA_LIQUID_CLASS}
                style={{
                  visibility: settled ? "hidden" : "visible",
                  width: spread ? `var(--cta-x-${key}-w)` : "100%",
                  transform: `translateX(calc(-50% + ${spread ? `var(--cta-x-${key}-dx)` : "0px"}))`,
                  transition: `${move("width")}, ${move("transform")}`,
                }}
              >
                <span
                  className="whitespace-nowrap"
                  style={{
                    opacity: spread ? 1 : 0,
                    transition: reverse
                      ? "opacity 300ms ease-in"
                      : `opacity 400ms ease-out ${timing.hold + timing.travel * 0.55}ms`,
                  }}
                >
                  {label}
                </span>
              </div>
            </Liquid.Item>
          ))}
        {CTA_DAUGHTERS.map(({ key, label, dir }) => (
          <Liquid.Item
            key={key}
            observe
            radius={CTA_DIAMETER / 2}
            style={{ display: "block", position: "absolute", inset: 0 }}
          >
            <button
              type="button"
              aria-label={label}
              data-step={key}
              disabled={!settled}
              onClick={() => onStep?.(dir < 0 ? "left" : "right")}
              className={`${CTA_DAUGHTER_CLASS} ${settled ? "bg-black/80 shadow" : ""}`}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                height: CTA_DIAMETER,
                marginTop: -CTA_DIAMETER / 2,
                width: spread ? CTA_DIAMETER : "100%",
                // Position via `translate`, not `transform`: CSS applies
                // `scale` before `transform` but after `translate`, so the
                // press shrinks the circle about its own centre instead of
                // pulling it towards where its box started.
                translate: `calc(-50% + ${spread ? dir * CTA_OFFSET : 0}px) 0`,
                transition: `${move("width")}, ${move("translate")}, scale 150ms var(--default-transition-timing-function)`,
                pointerEvents: settled ? "auto" : "none",
              }}
            />
          </Liquid.Item>
        ))}
      </Liquid>
    </div>
  );
}

/** Layer 1 — the ordinary pill. It owns idle/spinner/blank; at the split it
 *  steps aside for the liquid copy of itself, which is identical at that
 *  instant. The arrows live in their own layer, parked at the daughters' final
 *  centres (±31) from the moment they appear, so the pill pinches apart around
 *  them and they never move. */
function GetStartedCta({
  phase,
  onClick,
  onStep,
  extras = [],
}: {
  phase: CtaPhase;
  onClick: () => void;
  onStep?: (side: "left" | "right") => void;
  /** Rendered as real buttons to the left, hidden until the pill has divided. */
  extras?: readonly CtaExtra[];
}) {
  /** Dividing, or divided. */
  const splitting = phase === "splitting" || phase === "controls";
  /** The liquid layer is the CTA — the split and its reverse. */
  const liquid = CTA_LIQUID_PHASES.includes(phase);
  const reverse = phase === "merging" || phase === "sinking";
  const [spread, setSpread] = useState(false);
  const spreadNow = splitting && spread;
  const boxRef = useRef<HTMLDivElement>(null);
  const extraRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // The extras already occupy their slots (just invisible), so their liquid
  // copies can be aimed at them exactly: offset of each slot's centre from the
  // pill's centre, and its width. Measured once, before the split first paints.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!splitting || !box) return;
    const b = box.getBoundingClientRect();
    extras.forEach(({ key }, i) => {
      const el = extraRefs.current[i];
      if (!el) return;
      const r = el.getBoundingClientRect();
      box.style.setProperty(
        `--cta-x-${key}-dx`,
        `${r.left + r.width / 2 - (b.left + b.width / 2)}px`,
      );
      box.style.setProperty(`--cta-x-${key}-w`, `${r.width}px`);
    });
  }, [splitting, extras]);

  // Spread a frame after the split mounts (the liquid snaps to its target on
  // first layout instead of animating). On the way back `spreadNow` drops at
  // once; the flag itself resets a frame later, ready for the next run.
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSpread(splitting));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [splitting]);

  return (
    <>
      {extras.map(({ key, label }, i) => (
        <button
          key={key}
          ref={(el) => {
            extraRefs.current[i] = el;
          }}
          type="button"
          className={CTA_CLASS}
          style={{ visibility: phase === "controls" ? "visible" : "hidden" }}
          onClick={() => playClickSound()}
        >
          {label}
        </button>
      ))}
      <div
        ref={boxRef}
        className="group/cta relative inline-flex h-[47.896px] items-center justify-center"
      >
        <button
          type="button"
          onClick={onClick}
          disabled={phase !== "idle"}
          aria-busy={phase === "spinner"}
          aria-hidden={liquid}
          className={CTA_CLASS}
          style={liquid ? { opacity: 0, pointerEvents: "none" } : undefined}
        >
          {/* In flow, so the pill keeps its natural idle width in every phase. */}
          <span
            className="t-shimmer t-shimmer-on-dark whitespace-nowrap transition-opacity duration-200"
            data-text="Get Started"
            style={{ opacity: phase === "idle" ? 1 : 0 }}
          >
            Get Started
          </span>

          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200"
            style={{ opacity: phase === "spinner" ? 1 : 0 }}
            aria-hidden
          >
            <Spinner size={22.229} spinning={phase === "spinner"} />
          </span>
        </button>

        {liquid && (
          <CtaSplitLayer
            spread={spreadNow}
            settled={phase === "controls"}
            reverse={reverse}
            onStep={onStep}
            extras={extras}
          />
        )}

        <span
          className="pointer-events-none absolute inset-0 text-white transition-opacity duration-200"
          style={{ opacity: phase === "arrows" || liquid ? 1 : 0 }}
          aria-hidden
        >
          {CTA_DAUGHTERS.map(({ key, dir }) => (
            <span
              key={key}
              className={`absolute left-1/2 top-1/2 -ml-[7.92px] -mt-[7.92px] flex transition-transform duration-150 ${CTA_CHEVRON_PRESS[key]}`}
              style={{ translate: `${dir * CTA_OFFSET}px 0` }}
            >
              {dir < 0 ? (
                <ChevronLeftIcon size={15.84} />
              ) : (
                <ChevronRightIcon size={15.84} />
              )}
            </span>
          ))}
        </span>
      </div>
    </>
  );
}

function GoogleWorkspaceMark() {
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

function LogoLockup({ fontSize }: { fontSize: string }) {
  return (
    <div
      className="relative inline-block -translate-y-[10%] text-[#1c1917]"
      style={{ fontSize }}
    >
      <h1
        className={`${sohne.className} m-0 inline-flex items-start leading-none tracking-tight`}
      >
        <span className="inline-flex items-center">
          Kn
          <LogoMark className="mx-[0.04em] h-[0.71em] w-[0.62em] shrink-0 translate-x-[5%] translate-y-[10%]" />
          how
        </span>
        <span
          className="ml-[0.02em] mt-[0.08em] text-[0.22em] leading-none"
          aria-hidden
        >
          ™
        </span>
      </h1>
      <p className="absolute right-[0.28em] top-[0.60em] m-0 whitespace-nowrap leading-none">
        <span className={`${sohne.className} text-[0.26em] tracking-tight`}>
          by{" "}
        </span>
        <span className={`${lojjFont.className} text-[0.26em]`}>LOJJ.io</span>
      </p>
    </div>
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
/** Notes opens at the resize floor (same as min w/h). Bottom-right overlap. */
const MIN_WINDOW_W_PCT = 39;
const MIN_WINDOW_H_PCT = 28;
const NOTES_WINDOW_BOX: WindowBox = {
  x: 57.7,
  y: 63.5,
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

/** Finder-style desktop folder — draggable; click toggles Notes. */
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
        playClickSound();
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/deck/folder.png"
            alt=""
            width={98}
            height={86}
            className="t-deck-folder-icon"
            draggable={false}
          />
        </span>
        <span className={`${sohne.className} t-deck-folder-label`}>Notes</span>
      </button>
      {open ? (
        <InteractiveMacWindow
          title="Notes"
          initialBox={NOTES_WINDOW_BOX}
          zIndex={4}
        >
          <p className={`${sohne.className} t-deck-notes-copy`}>{note}</p>
        </InteractiveMacWindow>
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
  const [notesOpen, setNotesOpen] = useState(false);

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

function ChevronLeftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mobile Cover Flow — phone-aspect mac windows (CardCoverFlow pattern). */
function DeckCoverFlow({
  activeIndex,
  onActiveIndexChange,
}: {
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}) {
  return (
    <div className="t-deck-cover">
      <div className="t-deck-cover-stage">
        {DECK_CARDS.map((card, i) => {
          const offset = i - activeIndex;
          const absOffset = Math.abs(offset);
          const isActive = offset === 0;
          const isPast = i < activeIndex;

          return (
            <motion.div
              key={card.id}
              className="t-deck-cover-item"
              initial={false}
              animate={{
                x: offset * 42,
                rotateY: isActive ? 0 : isPast ? 38 : -38,
                z: isActive ? 50 : -absOffset * 50,
                scale: isActive ? 1.08 : 1 - absOffset * 0.08,
                opacity: absOffset > 2 ? 0 : 1 - absOffset * 0.22,
              }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              style={{ zIndex: 100 - absOffset }}
              onClick={() => onActiveIndexChange(i)}
            >
              <DeckWindow card={card} focused={isActive} />
            </motion.div>
          );
        })}
      </div>

      <div className="t-deck-cover-nav">
        <button
          type="button"
          aria-label="Previous card"
          disabled={activeIndex === 0}
          onClick={() => onActiveIndexChange(Math.max(0, activeIndex - 1))}
        >
          <ChevronLeftIcon />
        </button>
        <div className="t-deck-cover-dots">
          {DECK_CARDS.map((card, i) => (
            <button
              key={card.id}
              type="button"
              aria-label={`Show ${card.title}`}
              className="t-deck-cover-dot"
              data-active={activeIndex === i ? "true" : "false"}
              onClick={() => onActiveIndexChange(i)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next card"
          disabled={activeIndex === DECK_CARDS.length - 1}
          onClick={() =>
            onActiveIndexChange(Math.min(DECK_CARDS.length - 1, activeIndex + 1))
          }
        >
          <ChevronRightIcon />
        </button>
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

type DeckHandle = { shift: (dir: -1 | 1) => void; close: () => void };

/** Desktop deck. The CSS entrance (rise + spread) plays untouched; once
 *  `seated`, each card's position is a motion value in slot units and `shift`
 *  rotates the ring: the leading card is thrown off, the rest step one slot,
 *  and the thrown card comes back in from the trailing edge. Interruptible —
 *  a click mid-flight retargets from the current position and velocity. */
function DesktopDeck({
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

let clickAudio: AudioContext | null = null;

/** Short sine tick (880→220Hz, 80ms). One shared AudioContext: a fresh one per
 *  click leaks, and browsers cap how many can exist — which matters once the
 *  deck arrows get clicked in quick succession. Must wait for `resume()` when
 *  suspended (autoplay policy) or the oscillator runs silently. */
function playClickSound() {
  try {
    clickAudio ??= new AudioContext();
    const ctx = clickAudio;
    const start = () => {
      const t = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, t);
      oscillator.frequency.exponentialRampToValueAtTime(220, t + 0.08);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(t);
      oscillator.stop(t + 0.08);
    };
    if (ctx.state === "suspended") {
      void ctx.resume().then(start);
    } else {
      start();
    }
  } catch {
    // Web Audio unavailable/blocked — sound is a nice-to-have, fail silently
  }
}

/** Stub footer destinations — buttons until real routes exist (avoids App
 *  Router soft-nav on `<a href="#…">` during Fast Refresh). */
function FooterStubLink({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="cursor-pointer underline underline-offset-2 transition-transform duration-150 active:scale-95"
      onClick={() => playClickSound()}
    >
      {children}
    </button>
  );
}

/** Desktop header buttons that appear only after Get Started divides. */
const DESKTOP_HEADER_EXTRAS: readonly CtaExtra[] = [
  { key: "login", label: "Log In" },
  { key: "demo", label: "Talk to Sales" },
];

/** Subhead wave — a crest that travels left → right through the characters,
 *  once every `every` seconds. Tune here. */
const SUBHEAD_WAVE = {
  /** px each character lifts at the crest. */
  amplitude: 12,
  /** s to rise to the crest — and the same again to settle back. */
  duration: 0.45,
  /** s between neighbouring characters: how fast the crest travels. */
  stagger: 0.035,
  ease: "sine.inOut",
  /** deg of tilt at the crest; 0 = none (keep within ±2–4 if used). */
  rotation: 0,
  /** s from the start of one wave to the start of the next. */
  every: 8,
} as const;

/** Where each visible glyph of `el` sits (document order), from the live text. */
function glyphBoxes(el: HTMLElement) {
  const out: { x: number; y: number }[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const text = n.textContent ?? "";
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) continue;
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const r = range.getBoundingClientRect();
      out.push({ x: r.left, y: r.top });
    }
  }
  return out;
}

/** Splitting into inline-block characters loses kerning (browsers don't kern
 *  across element boundaries) — ~10px wider on this line. Give each character
 *  the margin that restores the gap to its left neighbour, so every advance,
 *  the line's width and therefore its centring match the unsplit text. In em,
 *  so it holds as the vw-based font size changes. */
function restoreGlyphAdvances(el: HTMLElement, chars: Element[], before: { x: number; y: number }[]) {
  if (chars.length !== before.length) return;
  const zoom = el.getBoundingClientRect().width / el.offsetWidth || 1;
  const now = chars.map((c) => c.getBoundingClientRect().left);
  chars.forEach((c, i) => {
    if (i === 0 || Math.abs(before[i].y - before[i - 1].y) > 1) return; // line start
    const gap = before[i].x - before[i - 1].x - (now[i] - now[i - 1]);
    if (Math.abs(gap) < 0.01) return;
    const em = parseFloat(getComputedStyle(c).fontSize) || 16;
    (c as HTMLElement).style.marginLeft = `${gap / zoom / em}em`;
  });
}

/** Runs the subhead wave on `ref`'s text. SplitText splits it into characters
 *  in place — no copy; spaces stay real text nodes between words; screen
 *  readers still get the sentence via aria-label — and one repeating timeline
 *  lifts them with a stagger, so the crest travels without per-character
 *  timers. Split once the fonts are in (glyph positions depend on them).
 *  `useGSAP` reverts the split (margins included) and kills the timeline on
 *  unmount — and between Strict Mode's double mount — so nothing duplicates. */
function useSubheadWave(ref: React.RefObject<HTMLElement | null>) {
  useGSAP(
    (_, contextSafe) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let live = true;
      const start = contextSafe!(() => {
        const el = ref.current;
        if (!live || !el) return;
        const { amplitude, duration, stagger, ease, rotation, every } =
          SUBHEAD_WAVE;
        const before = glyphBoxes(el);
        // <span>s keep the <p> valid; SplitText only sets display on <div>
        // wrappers, and a transform needs an inline-block box (words too, so
        // a wrapping subhead can't break mid-word).
        const { chars } = SplitText.create(el, {
          type: "words, chars",
          tag: "span",
          wordsClass: "inline-block",
          charsClass: "inline-block",
        });
        restoreGlyphAdvances(el, chars, before);
        const wave = gsap.timeline({ repeat: -1, delay: every });
        wave.to(chars, {
          y: -amplitude,
          ...(rotation ? { rotation } : {}),
          duration,
          ease,
          // Each character rises then settles (yoyo), starting `stagger`
          // after its left neighbour.
          stagger: { each: stagger, repeat: 1, yoyo: true },
        });
        // No inline transform left on any character between waves.
        wave.set(chars, { clearProps: "transform" });
        wave.repeatDelay(Math.max(0, every - wave.duration()));
      });
      document.fonts.ready.then(start);
      return () => {
        live = false;
      };
    },
    { scope: ref },
  );
}

function LandingHero() {
  const [editMode, setEditMode] = useState<boolean>(() => {
    if (!EDITING_MODE_ENABLED || typeof window === "undefined") return false;
    return localStorage.getItem("draggable:editMode") === "1";
  });
  const [ctaPhase, setCtaPhase] = useState<CtaPhase>("idle");
  const [nextOpen, setNextOpen] = useState(false);
  /** Cover Flow index — driven by the split CTA arrows on mobile. */
  const [deckIndex, setDeckIndex] = useState(1);
  const mounted = useHydrated();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ctaTimers = useRef<number[]>([]);

  const deckRef = useRef<DeckHandle>(null);
  const deskDeckEl = useRef<HTMLDivElement>(null);
  const mobDeckEl = useRef<HTMLDivElement>(null);
  const mobSubheadRef = useRef<HTMLParagraphElement>(null);
  const deskSubheadRef = useRef<HTMLParagraphElement>(null);
  useSubheadWave(mobSubheadRef);
  useSubheadWave(deskSubheadRef);
  const backdropDown = useRef<{ x: number; y: number } | null>(null);

  function focusDeckSide(side: "left" | "right") {
    setDeckIndex(side === "left" ? 0 : DECK_CARDS.length - 1);
  }

  /** ← brings the left card to the centre — the cards travel right: right
   *  card off, centre to the right slot, left card to centre, the thrown card
   *  back in on the left. → mirrors. */
  function stepDesktopDeck(side: "left" | "right") {
    playClickSound();
    deckRef.current?.shift(side === "left" ? 1 : -1);
  }

  function stepMobileDeck(side: "left" | "right") {
    playClickSound();
    focusDeckSide(side);
  }

  useEffect(() => {
    const timers = ctaTimers.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  function toggleEditMode() {
    setEditMode((v) => {
      const next = !v;
      localStorage.setItem("draggable:editMode", next ? "1" : "0");
      return next;
    });
  }

  function handleCtaClick() {
    if (ctaPhase !== "idle" || nextOpen) return;
    playClickSound();
    setCtaPhase("spinner");

    const at = (ms: number, run: () => void) => {
      ctaTimers.current.push(window.setTimeout(run, ms));
    };
    const blankAt = CTA_SPINNER_MS;
    const arrowsAt = blankAt + CTA_BLANK_MS;
    const splitAt = arrowsAt + CTA_ARROWS_MS;

    at(blankAt, () => setCtaPhase("blank"));
    at(arrowsAt, () => setCtaPhase("arrows"));
    // data-open flips with the split, not with the click — same commit.
    at(splitAt, () => {
      setCtaPhase("splitting");
      setNextOpen(true);
    });
    const { hold, travel } = readSplitTiming();
    at(splitAt + hold + travel + CTA_SETTLE_MS, () => setCtaPhase("controls"));
  }

  /** The Get Started handoff, backwards: the pieces flow back into the pill
   *  as the side cards fold under the centre card; then the pill holds while
   *  the deck sinks and the logo + subhead grow back; then the arrows fade and
   *  Get Started returns. The spinner is a loading beat, not part of the
   *  morph, so it isn't replayed. */
  function reverseCta() {
    const at = (ms: number, run: () => void) => {
      ctaTimers.current.push(window.setTimeout(run, ms));
    };
    const { hold, travel } = readSplitTiming();
    const sinkAt = travel;
    const pillAt = sinkAt + hold;
    const blankAt = pillAt + CTA_ARROWS_MS;
    const idleAt = blankAt + CTA_BLANK_MS;

    setCtaPhase("merging");
    deckRef.current?.close();
    at(sinkAt, () => {
      setCtaPhase("sinking");
      setNextOpen(false);
    });
    at(pillAt, () => setCtaPhase("arrows"));
    at(blankAt, () => setCtaPhase("blank"));
    at(idleAt, () => {
      setCtaPhase("idle");
      setDeckIndex(1);
    });
  }

  /** Where a click never closes the deck: any control (incl. the header
   *  button row), the logo lockup, or anywhere in the band the open deck's
   *  cards occupy — its Features label and Cover Flow bar included. */
  function isDeckKeepZone(target: EventTarget | null, y: number) {
    if (
      target instanceof Element &&
      target.closest("button, a, [data-cta-row], .t-handoff-shrink--logo")
    )
      return true;
    const deck = [deskDeckEl.current, mobDeckEl.current].find(
      (d) => d && getComputedStyle(d).display !== "none",
    );
    const rects = deck
      ? [
          ...deck.querySelectorAll(
            ".t-deck-card, .t-deck-cover-nav, [data-deck-label]",
          ),
        ]
          .map((n) => n.getBoundingClientRect())
          .filter(
            (r) => r.width > 0 && r.right > 0 && r.left < window.innerWidth,
          )
      : [];
    if (!rects.length) return false;
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return y >= top && y <= bottom;
  }

  function handleBackdropPointerDown(e: React.PointerEvent) {
    backdropDown.current =
      ctaPhase === "controls" &&
      e.button === 0 &&
      !isDeckKeepZone(e.target, e.clientY)
        ? { x: e.clientX, y: e.clientY }
        : null;
  }

  /** A click — not the end of a drag, e.g. resizing a window and letting go
   *  outside it — that starts and ends outside the keep zones reverses. */
  function handleBackdropClick(e: React.MouseEvent) {
    const down = backdropDown.current;
    backdropDown.current = null;
    if (ctaPhase !== "controls" || !down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    if (isDeckKeepZone(e.target, e.clientY)) return;
    reverseCta();
  }

  const openAttr = nextOpen ? "true" : "false";

  return (
    <div
      className="relative min-h-dvh overflow-hidden bg-[#F9F8F6]"
      onPointerDown={handleBackdropPointerDown}
      onClick={handleBackdropClick}
    >
      {/* Background video — keeps playing under the card deck */}
      <div className="absolute inset-0 z-0 isolate" aria-hidden>
        <video
          ref={videoRef}
          className="absolute inset-0 z-0 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero/onboarding-loop-poster.jpg"
          aria-hidden
        >
          <source src="/hero/onboarding-loop.webm" type="video/webm" />
          <source src="/hero/onboarding-loop.mp4" type="video/mp4" />
        </video>
        {/* Oil-paint grain finish over the video (under guidelines / UI). */}
        <div className="t-hero-grain" aria-hidden />
        <GuidelinesOverlay editable={EDITING_MODE_ENABLED && editMode} />
      </div>

      {/* ——— Mobile ——— */}
      <div className="relative z-10 flex min-h-dvh flex-col md:hidden">
        <header className="relative z-10 flex -translate-y-[5vh] flex-col items-center px-6 pt-[clamp(1rem,3vh,2.5rem)]">
          <div
            className="t-handoff-shrink t-handoff-shrink--logo translate-y-[5vh]"
            data-open={openAttr}
          >
            <LogoLockup fontSize={MOBILE_LOGO_FONT_SIZE} />
          </div>
        </header>

        <div className="relative z-0 min-h-[20vh] flex-1" aria-hidden />

        <div
          className="relative z-10 w-full translate-y-[3vh] text-[#1c1917]"
          data-open={openAttr}
        >
          <div
            className="t-handoff-shrink t-handoff-shrink--subhead mx-auto w-full max-w-[min(90%,42rem)] px-6 text-center"
            style={{ fontSize: MOBILE_SUBHEAD_FONT_SIZE }}
            data-open={openAttr}
          >
            <p ref={mobSubheadRef} className="leading-snug">
              <span className={`${sohne.className} tracking-tight`}>
                Take Control of your
              </span>
              <br />
              <GoogleWorkspaceMark />
            </p>
          </div>
          <div
            className={`${satoshi.className} mt-[2px] flex justify-between px-6 text-[0.908552rem] font-bold`}
          >
            <FooterStubLink>About Us</FooterStubLink>
            <FooterStubLink>Privacy Policy</FooterStubLink>
          </div>
        </div>

        <div className="relative z-30 flex -translate-y-[2vh] justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
          <GetStartedCta
            phase={ctaPhase}
            onClick={handleCtaClick}
            onStep={stepMobileDeck}
          />
        </div>
      </div>

      {/* ——— Desktop ——— */}
      <div className="pointer-events-none absolute inset-0 z-10 hidden md:block">
        <div className="pointer-events-auto absolute inset-x-0 top-[clamp(0.35rem,2.5vh,1.75rem)] z-30 flex -translate-y-[calc(10%+5vh)] items-center justify-between gap-4 px-[clamp(0.75rem,2vw,1.5rem)] lg:px-6">
          <div
            className="t-handoff-shrink t-handoff-shrink--logo translate-y-[5vh]"
            data-open={openAttr}
          >
            <LogoLockup fontSize={DESKTOP_LOGO_FONT_SIZE} />
          </div>
          <div
            data-cta-row
            className={`${satoshi.className} flex translate-y-[calc(-10%+3vh)] items-center gap-2`}
          >
            <GetStartedCta
              phase={ctaPhase}
              onClick={handleCtaClick}
              onStep={stepDesktopDeck}
              extras={DESKTOP_HEADER_EXTRAS}
            />
          </div>
        </div>

        <div
          className="pointer-events-auto absolute inset-x-0 bottom-[clamp(1.25rem,6vh,3.5rem)] z-10 translate-y-[3vh] text-[#1c1917]"
          data-open={openAttr}
        >
          <div
            className="t-handoff-shrink t-handoff-shrink--subhead mx-auto w-max text-center"
            style={{ fontSize: DESKTOP_SUBHEAD_FONT_SIZE }}
            data-open={openAttr}
          >
            <p
              ref={deskSubheadRef}
              className="leading-none whitespace-nowrap"
            >
              <span className={`${sohne.className} tracking-tight`}>
                Take Control of your{" "}
              </span>
              <GoogleWorkspaceMark />
            </p>
          </div>
          <div
            className={`${satoshi.className} mt-[2px] flex justify-between px-[clamp(0.75rem,2vw,1.5rem)] text-[0.908552rem] font-bold lg:px-6`}
          >
            <FooterStubLink>About Us</FooterStubLink>
            <FooterStubLink>Privacy Policy</FooterStubLink>
          </div>
        </div>
      </div>

      {/* Desktop: rise + linear spread (16:9) */}
      <div
        ref={deskDeckEl}
        className="t-deck t-deck--desktop group"
        data-open={openAttr}
        aria-hidden={!nextOpen}
      >
        <DesktopDeck
          ref={deckRef}
          seated={
            ctaPhase === "controls" ||
            ctaPhase === "merging" ||
            ctaPhase === "sinking"
          }
          onCardStep={ctaPhase === "controls" ? stepDesktopDeck : undefined}
        />
        {/* "Features" — the subhead's type (face, tracking, colour, and its
            open-state size), just above the middle card. Anchored to the
            card's top edge in deck coordinates so it rides the deck's
            height-fit scale, then counter-scaled so the type stays true size.
            Fades in as the card seats; out as the deck closes. */}
        <div
          className="pointer-events-none absolute left-1/2 z-[200] h-0 w-0 opacity-0 transition-opacity duration-300 group-data-[open=true]:opacity-100 group-data-[open=true]:delay-500"
          style={{
            top: "calc(50% + var(--deck-band-y) - var(--deck-card-w) * 9 / 32)",
            scale: "calc(1 / var(--deck-fit, 1))",
            transformOrigin: "0 0",
          }}
        >
          <p
            data-deck-label
            className={`${sohne.className} absolute bottom-[0.5em] left-0 m-0 -translate-x-1/2 whitespace-nowrap leading-none tracking-tight text-[#1c1917]`}
            style={{
              fontSize: `calc(${DESKTOP_SUBHEAD_FONT_SIZE} * var(--logo-shrink))`,
            }}
          >
            Features
          </p>
        </div>
      </div>

      {/* Mobile: phone-aspect Cover Flow stack */}
      <div
        ref={mobDeckEl}
        className="t-deck t-deck--mobile"
        data-open={openAttr}
        aria-hidden={!nextOpen}
      >
        <DeckCoverFlow
          activeIndex={deckIndex}
          onActiveIndexChange={setDeckIndex}
        />
      </div>

      {EDITING_MODE_ENABLED && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            type="button"
            onClick={toggleEditMode}
            className="min-h-11 rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {mounted && editMode ? "Done editing" : "Edit grid"}
          </button>
        </div>
      )}
    </div>
  );
}

export { LandingHero };
