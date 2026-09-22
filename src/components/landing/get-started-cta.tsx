"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Liquid } from "liquid-gooey";
import { cn } from "@/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Spinner,
} from "@/components/ui/icons";
import { CTA_CLASS } from "@/components/ui/tokens";

/** The Get Started pill and the two buttons it divides into.
 *
 *  Its own file because it is one self-contained piece of motion: a liquid
 *  body that splits, carries its daughters out to their slots, and reverses.
 *  The landing page renders it and hands it a click. */

/** One CTA body divides into two horizontally aligned daughters. */
const CTA_DIAMETER = 47.896;
const CTA_GAP = 8;
/** Half the final centre-to-centre distance. */
const CTA_OFFSET = (CTA_DIAMETER + CTA_GAP) / 2;

/** Choreography, in order. Each phase is its own visual beat; the body stays a
 *  single pill until `splitting`. */
export type CtaPhase =
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

export const CTA_SPINNER_MS = 400;
export const CTA_BLANK_MS = 220;
export const CTA_ARROWS_MS = 280;
/** Grace after the daughters land before the goo hands off to real chrome. */
export const CTA_SETTLE_MS = 120;

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
export function readSplitTiming() {
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
export type CtaExtra = { key: string; label: string };

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
export function CtaSplitLayer({
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
                // pulling it towards where its box started. A literal px
                // offset, not `-50%` — see the `--cta-box-w` note above.
                translate: spread
                  ? `calc(${-CTA_DIAMETER / 2}px + ${dir * CTA_OFFSET}px) 0`
                  : "calc(var(--cta-box-w, 100%) * -0.5) 0",
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
export function GetStartedCta({
  phase,
  onClick,
  onStep,
  onExtraClick,
  extras = [],
}: {
  phase: CtaPhase;
  onClick: () => void;
  onStep?: (side: "left" | "right") => void;
  onExtraClick?: (key: string) => void;
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
  //
  // Also pin the pill's own width here (`--cta-box-w`): the daughters centre
  // themselves with `left: 50%; translate: calc(-50% + Npx)`, and while
  // un-spread their `width` is `100%` of this box. A CSS `%` in `translate`
  // resolves against the *element's own* box each frame — so mid-transition,
  // with `width` also animating, the browser has to resolve both from the
  // same live layout every frame. That's fine under a steady refresh, but a
  // real mobile browser can force a synchronous reflow mid-gesture (Safari's
  // address bar collapsing changes the viewport height it's animating
  // against) and the two dependent interpolations can read back
  // out-of-step for a frame — the pill visibly lurches to one side and
  // corrects itself next frame. Not reproducible in headless Chromium
  // (nothing there ever forces that reflow), only confirmed on a real phone.
  // Pinning the un-spread width as a *fixed* px custom property lets the
  // un-spread `translate` below use a literal number instead of a live `%`,
  // so it no longer depends on `width`'s own animated value at all.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!splitting || !box) return;
    const b = box.getBoundingClientRect();
    box.style.setProperty("--cta-box-w", `${b.width}px`);
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
          onClick={() => onExtraClick?.(key)}
          className={CTA_CLASS}
          style={{ visibility: phase === "controls" ? "visible" : "hidden" }}
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
