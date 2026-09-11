"use client";

import { useEffect, useRef, useState } from "react";
import localFont from "next/font/local";
import { motion } from "framer-motion";
import { Liquid } from "liquid-gooey";
import { LogoMark, sohne } from "@/components/brand/logo-mark";
import { GuidelinesOverlay } from "@/components/brand/guidelines-overlay";
import { useHydrated } from "@/lib/use-hydrated";

const lojjFont = localFont({
  src: "../../fonts/logo/LOGO.otf",
  weight: "400",
  style: "normal",
});

const satoshi = localFont({
  src: [
    { path: "../../fonts/satoshi/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/satoshi/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/satoshi/Satoshi-Bold.woff2", weight: "700", style: "normal" },
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

const DECK_VARIANTS = ["left", "center", "right"] as const;
type DeckVariant = (typeof DECK_VARIANTS)[number];

const EDITING_MODE_ENABLED = process.env.NEXT_PUBLIC_EDITING_MODE_ENABLED === "true";

function Spinner({ size = 20, spinning = true }: { size?: number; spinning?: boolean }) {
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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={stroke} />
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
  "relative inline-flex h-[54.428px] min-h-[33.68px] min-w-[152.4px] items-center justify-center rounded-full bg-black/80 px-[1.474923rem] text-[1.290556rem] text-white shadow transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** One CTA body divides into two horizontally aligned daughters. */
const CTA_DIAMETER = 54;
const CTA_GAP = 8;
/** Half the final centre-to-centre distance. */
const CTA_OFFSET = (CTA_DIAMETER + CTA_GAP) / 2; // 31

/** Choreography, in order. Each phase is its own visual beat; the body stays a
 *  single pill until `splitting`. */
type CtaPhase = "idle" | "spinner" | "blank" | "arrows" | "splitting" | "controls";

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

function cssMs(name: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ms = raw.endsWith("ms") ? parseFloat(raw) : raw.endsWith("s") ? parseFloat(raw) * 1000 : NaN;
  return Number.isFinite(ms) ? ms : fallback;
}

/** Hold = --deck-rise-dur (the cards' spread delay), travel = --deck-spread-dur. */
function readSplitTiming() {
  return { hold: cssMs("--deck-rise-dur", 700), travel: cssMs("--deck-spread-dur", 1331) };
}

const CTA_DAUGHTER_CLASS =
  "rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const CTA_DAUGHTERS = [
  { key: "prev", label: "Show left card", dir: -1 },
  { key: "next", label: "Show right card", dir: 1 },
] as const;

/** Layers 2+3 — the pill divides in place. Each daughter starts as the WHOLE
 *  pill (`width: 100%` of the CTA box, so the two overlap into exactly the
 *  pill's silhouette) and, on the deck's spread timing, shrinks to a 54px
 *  circle while sliding to ±31: the middle pinches, necks and lets go. Both
 *  sit on one shared centre with a fixed 54px height and only `width` and
 *  `translateX` ever change, so the division can only be horizontal. The
 *  liquid follows their rendered rects (`observe`) and paints the surface. */
function CtaSplitLayer({
  spread,
  settled,
  onStep,
}: {
  spread: boolean;
  settled: boolean;
  onStep?: (side: "left" | "right") => void;
}) {
  const [timing] = useState(readSplitTiming);
  const move = (prop: string) => `${prop} ${timing.travel}ms ${CTA_SPLIT_EASE} ${timing.hold}ms`;
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
      >
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
                transform: `translateX(calc(-50% + ${spread ? dir * CTA_OFFSET : 0}px))`,
                transition: `${move("width")}, ${move("transform")}`,
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
}: {
  phase: CtaPhase;
  onClick: () => void;
  onStep?: (side: "left" | "right") => void;
}) {
  const splitting = phase === "splitting" || phase === "controls";
  const [spread, setSpread] = useState(false);

  useEffect(() => {
    if (!splitting) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSpread(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [splitting]);

  return (
    <div className="relative inline-flex h-[54.428px] items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={phase !== "idle"}
        aria-busy={phase === "spinner"}
        aria-hidden={splitting}
        className={CTA_CLASS}
        style={splitting ? { opacity: 0, pointerEvents: "none" } : undefined}
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
          <Spinner size={25.26} spinning={phase === "spinner"} />
        </span>
      </button>

      {splitting && (
        <CtaSplitLayer spread={spread} settled={phase === "controls"} onStep={onStep} />
      )}

      <span
        className="pointer-events-none absolute inset-0 text-white transition-opacity duration-200"
        style={{ opacity: phase === "arrows" || splitting ? 1 : 0 }}
        aria-hidden
      >
        {CTA_DAUGHTERS.map(({ key, dir }) => (
          <span
            key={key}
            className="absolute left-1/2 top-1/2 -ml-[9px] -mt-[9px] flex"
            style={{ transform: `translateX(${dir * CTA_OFFSET}px)` }}
          >
            {dir < 0 ? <ChevronLeftIcon size={18} /> : <ChevronRightIcon size={18} />}
          </span>
        ))}
      </span>
    </div>
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
    <div className="relative inline-block -translate-y-[10%] text-[#1c1917]" style={{ fontSize }}>
      <h1 className={`${sohne.className} m-0 inline-flex items-start leading-none tracking-tight`}>
        <span className="inline-flex items-center">
          Kn
          <LogoMark className="mx-[0.04em] h-[0.71em] w-[0.62em] shrink-0 translate-x-[8%] translate-y-[10%]" />
          how
        </span>
        <span className="ml-[0.02em] mt-[0.08em] text-[0.22em] leading-none" aria-hidden>
          ™
        </span>
      </h1>
      <p className="absolute right-[0.28em] top-[0.60em] m-0 whitespace-nowrap leading-none">
        <span className={`${sohne.className} text-[0.26em] tracking-tight`}>by </span>
        <span className={`${lojjFont.className} text-[0.26em]`}>LOJJ.io</span>
      </p>
    </div>
  );
}

function DeckChrome({ onDragPointerDown }: { onDragPointerDown?: (e: React.PointerEvent) => void }) {
  return (
    <div
      className="t-deck-titlebar"
      onPointerDown={onDragPointerDown}
      style={onDragPointerDown ? { touchAction: "none" } : undefined}
    >
      <div className="t-deck-traffic" aria-hidden>
        <span className="t-deck-dot t-deck-dot--close" />
        <span className="t-deck-dot t-deck-dot--min" />
        <span className="t-deck-dot t-deck-dot--max" />
      </div>
    </div>
  );
}

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const RESIZE_HANDLES: ResizeHandle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

type WindowBox = { x: number; y: number; w: number; h: number };

const DEFAULT_WINDOW_BOX: WindowBox = { x: 6.25, y: 6.25, w: 87.5, h: 87.5 };
const MIN_WINDOW_PCT = 32;

function clampWindowBox(box: WindowBox): WindowBox {
  const w = Math.min(100, Math.max(MIN_WINDOW_PCT, box.w));
  const h = Math.min(100, Math.max(MIN_WINDOW_PCT, box.h));
  const x = Math.min(100 - w, Math.max(0, box.x));
  const y = Math.min(100 - h, Math.max(0, box.y));
  return { x, y, w, h };
}

/** Inset mac window — drag via title bar; resize from all edges/corners. */
function InteractiveMacWindow() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<WindowBox>(DEFAULT_WINDOW_BOX);
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
      let next = { ...s };
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
      }}
    >
      <DeckChrome onDragPointerDown={(e) => beginInteraction(e, "drag")} />
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

const DECK_MAT: Record<DeckVariant, "blue" | "green" | "red"> = {
  left: "green",
  center: "blue",
  right: "red",
};

function DeckWindow({
  variant,
  focused = false,
}: {
  variant: DeckVariant;
  focused?: boolean;
}) {
  const mat = DECK_MAT[variant];
  return (
    <div
      className={`t-deck-card t-deck-card--${variant} t-deck-card--mat`}
      data-focus={focused ? "true" : "false"}
    >
      <div className={`t-deck-mat t-deck-mat--${mat}`} aria-hidden />
      <InteractiveMacWindow />
    </div>
  );
}

function ChevronLeftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
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
        strokeWidth="2"
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
        {DECK_VARIANTS.map((variant, i) => {
          const offset = i - activeIndex;
          const absOffset = Math.abs(offset);
          const isActive = offset === 0;
          const isPast = i < activeIndex;

          return (
            <motion.div
              key={variant}
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
              <DeckWindow variant={variant} focused={isActive} />
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
          {DECK_VARIANTS.map((variant, i) => (
            <button
              key={variant}
              type="button"
              aria-label={`Show card ${i + 1}`}
              className="t-deck-cover-dot"
              data-active={activeIndex === i ? "true" : "false"}
              onClick={() => onActiveIndexChange(i)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next card"
          disabled={activeIndex === DECK_VARIANTS.length - 1}
          onClick={() =>
            onActiveIndexChange(Math.min(DECK_VARIANTS.length - 1, activeIndex + 1))
          }
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}

function LandingHero() {
  const [editMode, setEditMode] = useState<boolean>(() => {
    if (!EDITING_MODE_ENABLED || typeof window === "undefined") return false;
    return localStorage.getItem("draggable:editMode") === "1";
  });
  const [ctaPhase, setCtaPhase] = useState<CtaPhase>("idle");
  const [nextOpen, setNextOpen] = useState(false);
  /** 0 left · 1 center · 2 right — driven by the split CTA arrows. */
  const [deckIndex, setDeckIndex] = useState(1);
  const mounted = useHydrated();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ctaTimers = useRef<number[]>([]);

  function focusDeckSide(side: "left" | "right") {
    setDeckIndex(side === "left" ? 0 : 2);
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

  function playClickSound() {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.08);
    } catch {
      // Web Audio unavailable/blocked — sound is a nice-to-have, fail silently
    }
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

  const openAttr = nextOpen ? "true" : "false";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#F9F8F6]">
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
          className="t-handoff-shrink t-handoff-shrink--subhead relative z-10 mx-auto w-full max-w-[min(90%,42rem)] translate-y-[3vh] px-6 text-center text-[#1c1917]"
          style={{ fontSize: MOBILE_SUBHEAD_FONT_SIZE }}
          data-open={openAttr}
        >
          <p className="leading-snug">
            <span className={`${sohne.className} tracking-tight`}>Take Control of your</span>
            <br />
            <GoogleWorkspaceMark />
          </p>
        </div>

        <div className="relative z-30 flex -translate-y-[2vh] justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
          <GetStartedCta phase={ctaPhase} onClick={handleCtaClick} onStep={focusDeckSide} />
        </div>
      </div>

      {/* ——— Desktop ——— */}
      <div className="pointer-events-none absolute inset-0 z-10 hidden md:block">
        <div className="pointer-events-auto absolute inset-x-0 top-[clamp(0.35rem,2.5vh,1.75rem)] z-30 flex -translate-y-[calc(10%+5vh)] items-center justify-between px-[clamp(0.75rem,2vw,1.5rem)] lg:px-6">
          <div
            className="t-handoff-shrink t-handoff-shrink--logo translate-y-[5vh]"
            data-open={openAttr}
          >
            <LogoLockup fontSize={DESKTOP_LOGO_FONT_SIZE} />
          </div>
          <div className="translate-y-[calc(-10%+3vh)]">
            <GetStartedCta phase={ctaPhase} onClick={handleCtaClick} onStep={focusDeckSide} />
          </div>
        </div>

        <div
          className="t-handoff-shrink t-handoff-shrink--subhead absolute bottom-[clamp(1.25rem,6vh,3.5rem)] left-1/2 z-10 w-max -translate-x-1/2 translate-y-[3vh] text-center"
          style={{ fontSize: DESKTOP_SUBHEAD_FONT_SIZE }}
          data-open={openAttr}
        >
          <p className="leading-none whitespace-nowrap text-[#1c1917]">
            <span className={`${sohne.className} tracking-tight`}>Take Control of your </span>
            <GoogleWorkspaceMark />
          </p>
        </div>
      </div>

      {/* Desktop: rise + linear spread (16:9) */}
      <div className="t-deck t-deck--desktop" data-open={openAttr} aria-hidden={!nextOpen}>
        <DeckWindow variant="left" focused={deckIndex === 0} />
        <DeckWindow variant="right" focused={deckIndex === 2} />
        <DeckWindow variant="center" focused={deckIndex === 1} />
      </div>

      {/* Mobile: phone-aspect Cover Flow stack */}
      <div className="t-deck t-deck--mobile" data-open={openAttr} aria-hidden={!nextOpen}>
        <DeckCoverFlow activeIndex={deckIndex} onActiveIndexChange={setDeckIndex} />
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
