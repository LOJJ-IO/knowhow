"use client";

import { useState } from "react";
import localFont from "next/font/local";
import { LogoMark, sohne } from "@/components/brand/logo-mark";
import { Draggable } from "@/components/brand/draggable";
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

const LOGO_FONT_SIZE = "clamp(3.15rem,11.25vw,11.25rem)";
const SUBHEAD_FONT_SIZE = "clamp(1.215rem,3.645vw,3.645rem)";

// G/o/o/g/l/e colored per the real Google logotype, using the same exact hex
// values as the cube mark in logo-mark.tsx (not the --gblue/etc. oklch
// tokens elsewhere in the app, which are a slightly different palette).
const GOOGLE_LETTERS = [
  { char: "G", color: "#4285F4" },
  { char: "o", color: "#EA4335" },
  { char: "o", color: "#FBBC05" },
  { char: "g", color: "#4285F4" },
  { char: "l", color: "#34A853" },
  { char: "e", color: "#EA4335" },
] as const;

const DRAGGABLE_IDS = [
  "landing-logo-text",
  "landing-logo-mark",
  "landing-logo-tm",
  "landing-logo-tagline",
  "landing-hero-subhead",
  "landing-hero-cta",
] as const;

function readCurrentConfig() {
  const config: Record<string, { x: number; y: number } | null> = {};
  for (const id of DRAGGABLE_IDS) {
    const saved = localStorage.getItem(`draggable:${id}`);
    config[id] = saved ? JSON.parse(saved) : null;
  }
  return config;
}

const EDITING_MODE_ENABLED = process.env.NEXT_PUBLIC_EDITING_MODE_ENABLED === "true";

function Spinner({ size = 20 }: { size?: number }) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="animate-spin" style={{ animationDuration: "1.1s" }}>
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

function LandingHero() {
  const [editMode, setEditMode] = useState<boolean>(() => {
    if (!EDITING_MODE_ENABLED || typeof window === "undefined") return false;
    return localStorage.getItem("draggable:editMode") === "1";
  });
  const [configText, setConfigText] = useState<string | null>(null);
  const [ctaLoading, setCtaLoading] = useState(false);
  // See the matching comment in GuidelinesOverlay: `editMode` can diverge
  // between server and first client render, so anything that structurally
  // mounts/unmounts based on it (like the "Copy config" button below) needs
  // to wait for `mounted` to avoid a hydration mismatch.
  const mounted = useHydrated();

  function toggleEditMode() {
    setEditMode((v) => {
      const next = !v;
      localStorage.setItem("draggable:editMode", next ? "1" : "0");
      if (!next) setConfigText(null);
      return next;
    });
  }

  // Synthesized via Web Audio instead of an audio file — no asset to source/license.
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

  // No real destination yet, so there's nothing to await — this just demos
  // the spinner state for a fixed duration until the button is wired up.
  function handleCtaClick() {
    playClickSound();
    setCtaLoading(true);
    setTimeout(() => setCtaLoading(false), 1500);
  }

  async function copyConfig() {
    const config = readCurrentConfig();
    const text = JSON.stringify(config, null, 2);
    setConfigText(text);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard permission denied — the text is still shown on-page to copy manually
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <video
        className="absolute inset-0 -z-10 size-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster="/hero/onboarding-loop-poster.jpg"
      >
        <source src="/hero/onboarding-loop.webm" type="video/webm" />
        <source src="/hero/onboarding-loop.mp4" type="video/mp4" />
      </video>

      <GuidelinesOverlay editable={EDITING_MODE_ENABLED && editMode} />

      <Draggable
        id="landing-logo-text"
        initial={{ x: 0.07626364087301586, y: -0.3182669890873016 }}
        locked={!editMode}
        style={{ fontSize: LOGO_FONT_SIZE }}
      >
        <span className={`${sohne.className} inline-flex items-center gap-2 leading-none tracking-tight text-[#1c1917]`}>
          Kn
          <span className="inline-block w-[0.62em]" />
          how
        </span>
      </Draggable>

      <Draggable
        id="landing-logo-mark"
        initial={{ x: 1.36804046792328, y: -0.3315213018077601 }}
        locked={!editMode}
        style={{ fontSize: LOGO_FONT_SIZE }}
      >
        <LogoMark className="h-[0.71em] w-[0.62em]" />
      </Draggable>

      <Draggable
        id="landing-logo-tm"
        initial={{ x: 3.839686535493827, y: -0.8957165591931218 }}
        locked={!editMode}
        style={{ fontSize: LOGO_FONT_SIZE }}
      >
        <span className={`${sohne.className} leading-none tracking-tight text-[#1c1917]`}>
          <span className="text-[0.16em] leading-none">™</span>
        </span>
      </Draggable>

      <Draggable
        id="landing-logo-tagline"
        initial={{ x: 3.0792584325396835, y: -0.11720920138888889 }}
        locked={!editMode}
        style={{ fontSize: LOGO_FONT_SIZE }}
      >
        <span className="leading-none text-[#1c1917]">
          <span className={`${sohne.className} text-[0.162em] tracking-tight`}>by </span>
          <span className={`${lojjFont.className} text-[0.162em]`}>LOJJ.io</span>
        </span>
      </Draggable>

      <Draggable
        id="landing-hero-subhead"
        initial={{ x: 3.8317713691700956, y: 13.44483307494094 }}
        locked={!editMode}
        style={{ fontSize: SUBHEAD_FONT_SIZE }}
        className="w-max"
      >
        <span className="leading-none whitespace-nowrap text-[#1c1917]">
          <span className={`${sohne.className} tracking-tight`}>Take Control of your </span>
          <span className={`${satoshi.className} font-bold`}>
            {GOOGLE_LETTERS.map(({ char, color }, i) => (
              <span key={i} style={{ color }}>
                {char}
              </span>
            ))}
          </span>
          <span className={`${satoshi.className} font-normal`}> Workspace</span>
        </span>
      </Draggable>

      <Draggable
        id="landing-hero-cta"
        initial={{ x: 77.228271484375, y: 3.373046875 }}
        locked={!editMode}
        className="w-max"
      >
        {/* No destination yet — placeholder button, per explicit instruction not to wire a link until asked.
            Styled to match the "Edit positions" button (rounded-full bg-black/80 px-4 py-2 text-sm), scaled up then −10% from the prior committed size. */}
        <button
          type="button"
          onClick={handleCtaClick}
          disabled={ctaLoading}
          className="inline-flex h-[49.5px] min-w-[138.6px] items-center justify-center rounded-full bg-black/80 px-[1.34136rem] text-[1.17369rem] text-white shadow transition-transform duration-150 active:scale-95 disabled:opacity-80"
        >
          {ctaLoading ? (
            <Spinner size={23} />
          ) : (
            <span className="t-shimmer t-shimmer-on-dark" data-text="Get Started">
              Get Started
            </span>
          )}
        </button>
      </Draggable>

      {EDITING_MODE_ENABLED && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
          {configText && (
            <pre className="max-w-sm overflow-auto rounded-lg bg-black/85 p-3 font-mono text-[11px] text-white">
              {configText}
            </pre>
          )}
          <div className="flex gap-2">
            {mounted && editMode && (
              <button
                type="button"
                onClick={copyConfig}
                className="rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow"
              >
                Copy config
              </button>
            )}
            <button
              type="button"
              onClick={toggleEditMode}
              className="rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow"
            >
              {mounted && editMode ? "Done editing" : "Edit positions"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { LandingHero };
