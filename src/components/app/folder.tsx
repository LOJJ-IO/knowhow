"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/** The folder the user supplied (2026-09-26), kept to its drawing and its
 *  springs. Changes on the way in, per UI-Consistency-Rules:
 *
 *  - `motion/react` → `framer-motion` (same API, already a dependency).
 *  - **Blue only** (user). The black and white themes are gone.
 *  - SVG filter ids came hard-coded (`filter0_i_171_13`), so two folders on
 *    one page shared, and fought over, one filter. They're per instance now.
 *  - It was a `div` that opened on click and **closed on mouseleave**, which
 *    touch and keyboard can't do. It's a `button` now: hover or focus lifts
 *    the cards, a press fans them out and then calls `onOpen`.
 *  - The three cards drew placeholder lines. Each now carries a real file's
 *    name, and a folder shows only as many cards as it has files (up to
 *    three), so an empty folder looks empty.
 *  - Reduced motion: no springs, no fan; a press opens straight away. */

const THEME = {
  backFill: "#50B1FD",
  backInsetShadow: "inset 0 0 6px 2px rgba(255,255,255,0.35)",
  flapFill: "#3a9ae8",
  flapFillOpacity: 0.45,
  flapStroke: "#7ec8ff",
  flapInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.12 0",
  cardFill: "#F1F1F1",
  cardStroke: "#E0E0E0",
  cardLineFill: "#D4D4D4",
  cardInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0",
} as const;

const SIZE_SCALE = { sm: 0.6, md: 1, lg: 1.35 } as const;

const BASE_WIDTH = 321;
const BASE_HEIGHT = 270;

const FLAP_PATH =
  "M0 25C0 11.1929 11.1929 0 25 0H136.084C143.044 0 149.689 2.90139 154.42 8.00608L178.08 33.5343C182.811 38.639 189.456 41.5404 196.416 41.5404H296C309.807 41.5404 321 52.7333 321 66.5404V216C321 229.807 309.807 241 296 241H25C11.1929 241 0 229.807 0 216V25Z";

/** Resting and lifted (hover/focus) pose for each card. On hover the papers
 *  rise and spread out, which is the "papers move up and around" the user
 *  asked for. There is no flap-open on click (the folder just opens), so the
 *  cover only tilts a little to let the papers show. */
const CARD_POSES = [
  {
    rest: { y: -10, x: 40, rotate: 10 },
    lift: { y: -46, x: 56, rotate: 16 },
    delay: 0.09,
  },
  {
    rest: { y: -20, x: 3, rotate: 2 },
    lift: { y: -58, x: 2, rotate: -2 },
    delay: 0.04,
  },
  {
    rest: { y: -22, x: -40, rotate: -5 },
    lift: { y: -50, x: -56, rotate: -12 },
    delay: 0,
  },
] as const;

export function Folder({
  label,
  fileNames = [],
  size = "sm",
  onOpen,
  className,
}: {
  /** Accessible name: the folder's name. Shown by the caller, not here. */
  label: string;
  /** Up to three file names, drawn on the cards peeking out. */
  fileNames?: string[];
  size?: keyof typeof SIZE_SCALE;
  onOpen?: () => void;
  className?: string;
}) {
  const scale = SIZE_SCALE[size];
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const [lifted, setLifted] = useState(false);

  // The folder's front card is drawn last, so the first file sits in front.
  const cards = fileNames.slice(0, 3);
  // Empty folders flap too — the user is fine with that (2026-09-29).
  const active = lifted;
  const pose = active ? "lift" : "rest";

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onOpen?.()}
      onPointerEnter={() => setLifted(true)}
      onPointerLeave={() => setLifted(false)}
      onFocus={() => setLifted(true)}
      onBlur={() => setLifted(false)}
      className={cn(
        "relative block cursor-pointer rounded-[20px] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1917]",
        className,
      )}
      style={{
        width: BASE_WIDTH * scale,
        height: BASE_HEIGHT * scale,
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
          perspective: 800 * scale,
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            style={{
              width: BASE_WIDTH,
              height: BASE_HEIGHT,
              borderRadius: 25,
              backgroundColor: THEME.backFill,
              boxShadow: THEME.backInsetShadow,
            }}
          />
        </div>

        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          {cards
            .map((name, i) => ({ name, i }))
            .reverse()
            .map(({ name, i }) => {
              const p = CARD_POSES[i];
              return (
                <motion.div
                  key={i}
                  className="absolute"
                  initial={false}
                  animate={p[pose]}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : {
                          type: "spring",
                          stiffness: 120,
                          damping: 13,
                          delay: pose === "lift" ? p.delay : 0,
                        }
                  }
                >
                  <Card filterId={`${uid}-card-${i}`} name={name} />
                </motion.div>
              );
            })}
        </div>

        <motion.div
          className="absolute top-1/2 left-1/2 mt-4 -translate-x-1/2 -translate-y-1/2"
          style={{
            transformOrigin: "bottom center",
            transformStyle: "preserve-3d",
            width: 321,
            height: 241,
          }}
          initial={false}
          animate={{ rotateX: active ? -30 : -15 }}
          transition={
            reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 14 }
          }
        >
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              clipPath: `path('${FLAP_PATH}')`,
              WebkitClipPath: `path('${FLAP_PATH}')`,
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              willChange: "transform",
            }}
          />
          <svg
            className="absolute inset-0"
            width="321"
            height="241"
            viewBox="0 0 321 241"
            fill="none"
            aria-hidden
          >
            <g filter={`url(#${uid}-flap)`}>
              <path
                d={FLAP_PATH}
                fill={THEME.flapFill}
                fillOpacity={THEME.flapFillOpacity}
              />
              <path
                d="M25 0.5H136.084C142.905 0.5 149.417 3.3431 154.054 8.3457L177.713 33.874C182.539 39.0808 189.317 42.04 196.416 42.04H296C309.531 42.04 320.5 53.0092 320.5 66.54V216C320.5 229.531 309.531 240.5 296 240.5H25C11.469 240.5 0.5 229.531 0.5 216V25C0.5 11.469 11.469 0.5 25 0.5Z"
                stroke={THEME.flapStroke}
              />
            </g>
            <defs>
              <filter
                id={`${uid}-flap`}
                x="-25.4"
                y="-25.4"
                width="371.8"
                height="291.8"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="BackgroundImageFix"
                  result="shape"
                />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset />
                <feGaussianBlur stdDeviation="2.65" />
                <feComposite
                  in2="hardAlpha"
                  operator="arithmetic"
                  k2="-1"
                  k3="1"
                />
                <feColorMatrix type="matrix" values={THEME.flapInsetColor} />
                <feBlend mode="normal" in2="shape" result="innerShadow" />
              </filter>
            </defs>
          </svg>
        </motion.div>
      </div>
    </button>
  );
}

/** Body lines under a card's title, as in the original drawing. */
const LINE_ROWS = [60.99, 75.11, 89.23, 103.35, 117.47, 131.59, 145.7, 159.82, 173.94];

function Card({ filterId, name }: { filterId: string; name: string }) {
  return (
    <svg width="164" height="214" viewBox="0 0 164 214" fill="none" aria-hidden>
      <g filter={`url(#${filterId})`}>
        <rect width="163.078" height="213.262" rx="20" fill={THEME.cardFill} />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="162.078"
        height="212.262"
        rx="19.5"
        stroke={THEME.cardStroke}
      />
      {/* The file's name where the drawing had its heading bar. */}
      <foreignObject x="14" y="22" width="135" height="30">
        <div
          style={{
            fontSize: 13,
            lineHeight: "15px",
            fontWeight: 600,
            color: "#44403c",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
          }}
        >
          {name}
        </div>
      </foreignObject>
      {LINE_ROWS.map((y) => (
        <g key={y}>
          <rect x="14.83" y={y} width="64.52" height="5.88" rx="2.94" fill={THEME.cardLineFill} />
          <rect x="84.43" y={y} width="64.52" height="5.88" rx="2.94" fill={THEME.cardLineFill} />
        </g>
      ))}
      <defs>
        <filter
          id={filterId}
          x="0"
          y="0"
          width="166.078"
          height="218.262"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feMorphology radius="2" operator="erode" in="SourceAlpha" result="eroded" />
          <feOffset dx="3" dy="5" />
          <feGaussianBlur stdDeviation="3.05" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values={THEME.cardInsetColor} />
          <feBlend mode="normal" in2="shape" result="innerShadow" />
        </filter>
      </defs>
    </svg>
  );
}
