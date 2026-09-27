"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { cn } from "@/lib/utils";
import {
  cancelDemoLead,
  fetchDemoResume,
  leadToFormState,
  readDemoResumeToken,
  touchDemoLead,
} from "@/lib/demo-lead";
import {
  DESKTOP_LOGO_FONT_SIZE,
  DESKTOP_SUBHEAD_FONT_SIZE,
  MOBILE_LOGO_FONT_SIZE,
  MOBILE_SUBHEAD_FONT_SIZE,
} from "@/components/landing/type-scale";

/** Desktop header buttons that appear only after Get Started divides. */
const DESKTOP_HEADER_EXTRAS: readonly CtaExtra[] = [
  { key: "login", label: "Log In" },
  { key: "demo", label: "Book a Demo" },
];

import { FooterStubLink } from "@/components/landing/footer-stub-link";
import { fetchMe } from "@/lib/remembered-accounts";
import { appEntryUrl } from "@/lib/origins";
import { ReservedCountdown } from "@/components/login/login-modal";
import { SignInSheet } from "@/components/login/sign-in-sheet";
import type { DemoFormInitial } from "@/components/demo/demo-form";
import {
  DECK_CARDS,
  DeckCoverFlow,
  DesktopDeck,
  GoogleWorkspaceMark,
  type DeckHandle,
} from "@/components/deck/deck";
import {
  CTA_ARROWS_MS,
  CTA_BLANK_MS,
  CTA_SETTLE_MS,
  CTA_SPINNER_MS,
  GetStartedCta,
  readSplitTiming,
  type CtaExtra,
  type CtaPhase,
} from "@/components/landing/get-started-cta";
import { SHEET_SLIDE_MS } from "@/components/ui/tokens";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import dynamic from "next/dynamic";

gsap.registerPlugin(SplitText, useGSAP);

/** Loaded on demand: not on screen until someone opens Book a Demo, so it
 *  doesn't belong in the landing page's bundle (user, 2026-09-21: "load only
 *  what is being used"). Sign-in and onboarding live on the app's origin now
 *  (ADR 0022). */
const DemoForm = dynamic(
  () => import("@/components/demo/demo-form").then((m) => m.DemoForm),
  { ssr: false },
);












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
  const [ctaPhase, setCtaPhase] = useState<CtaPhase>("idle");
  const [nextOpen, setNextOpen] = useState(false);
  /** The slide-up sheet (Log In / Book a Demo) is open. */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** What the sheet is for — kept after Close so it slides down intact. Log
   *  In only slides up here; the app's origin takes over at the top. */
  const [sheetKind, setSheetKind] = useState<"login" | "demo">("login");
  /** The sheet has finished sliding up — square corners from then on. */
  const [sheetAtTop, setSheetAtTop] = useState(false);
  /** The landing's own scroll container (the page doesn't scroll on <body>). */
  const pageRef = useRef<HTMLDivElement>(null);

  // The sheet reaches the top via its own `onTransitionEnd`, which only fires
  // if a transition actually runs. A sheet opened on load — resuming an
  // unfinished setup — can mount already open, so nothing transitions, the
  // handler never fires, and `LoginModal` stays the thin closed line with the
  // setup screen invisible behind it. Fall back to the slide's own duration;
  // when a real slide does happen it wins first and this is cleared.
  useEffect(() => {
    if (!sheetOpen || sheetAtTop) return;
    const id = window.setTimeout(() => setSheetAtTop(true), SHEET_SLIDE_MS + 60);
    return () => window.clearTimeout(id);
  }, [sheetOpen, sheetAtTop]);
  /** When Book a Demo first opened this visit — its "reserved" countdown
   *  runs from here and keeps running across Close / reopen. */
  const [demoReservedAt, setDemoReservedAt] = useState<number | null>(null);
  /** Prefill from `?demo_resume=` (abandoned-recovery email CTA). */
  const [demoInitial, setDemoInitial] = useState<DemoFormInitial | null>(null);
  const [demoFormKey, setDemoFormKey] = useState(0);
  /** Cover Flow index — driven by the split CTA arrows on mobile. */
  const [deckIndex, setDeckIndex] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const demoSheetRef = useRef<HTMLDivElement>(null);
  const ctaTimers = useRef<number[]>([]);

  const deckRef = useRef<DeckHandle>(null);
  const deskDeckEl = useRef<HTMLDivElement>(null);
  const mobDeckEl = useRef<HTMLDivElement>(null);
  const mobSubheadRef = useRef<HTMLParagraphElement>(null);
  const deskSubheadRef = useRef<HTMLParagraphElement>(null);
  useSubheadWave(mobSubheadRef);
  useSubheadWave(deskSubheadRef);
  const backdropDown = useRef<{ x: number; y: number } | null>(null);

  /** ← brings the left card to the centre — the cards travel right: right
   *  card off, centre to the right slot, left card to centre, the thrown card
   *  back in on the left. → mirrors. */
  function stepDesktopDeck(side: "left" | "right") {
    deckRef.current?.shift(side === "left" ? 1 : -1);
  }

  /** Mobile Cover Flow doesn't loop — ← / → move one card at a time, clamped
   *  to the ends, same as a swipe or tapping a side card. */
  function stepMobileDeck(side: "left" | "right") {
    setDeckIndex((i) =>
      Math.min(
        DECK_CARDS.length - 1,
        Math.max(0, i + (side === "left" ? -1 : 1)),
      ),
    );
  }

  useEffect(() => {
    const timers = ctaTimers.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  // Log In's sheet reached the top: the rest (sign-in, onboarding, Google's
  // answers) lives on the app's origin, which opens on this same sheet
  // already at the top (ADR 0022).
  useEffect(() => {
    if (sheetOpen && sheetAtTop && sheetKind === "login")
      window.location.assign(appEntryUrl());
  }, [sheetOpen, sheetAtTop, sheetKind]);

  // Back/forward can restore this page from the cache mid-handoff, with the
  // Log In sheet still up. Put the landing back.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setSheetAtTop(false);
      setSheetOpen(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Signed in already? Setup to resume, a join to finish, or the app
    // itself: all of it is on the app's origin now.
    void fetchMe().then((result) => {
      if (!cancelled && result) window.location.replace(appEntryUrl());
    });

    // Abandoned-demo email CTA: `?demo_resume=<token>`.
    const resumeToken = new URLSearchParams(window.location.search).get(
      "demo_resume",
    );
    if (resumeToken) {
      void fetchDemoResume(resumeToken)
        .then((lead) => {
          if (cancelled || !lead) return;
          setDemoInitial(leadToFormState(lead));
          setDemoFormKey((k) => k + 1);
          setSheetKind("demo");
          setSheetOpen(true);
          setDemoReservedAt((t) => t ?? Date.now());
          const url = new URL(window.location.href);
          url.searchParams.delete("demo_resume");
          window.history.replaceState(null, "", url);
        })
        .catch((err) => console.error("demo resume failed", err));
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // Sheet activity → reset the 20‑min idle timer (demo sheet only).
  useEffect(() => {
    if (!sheetOpen || sheetKind !== "demo") return;
    const root = demoSheetRef.current;
    if (!root) return;
    let lastSent = 0;
    const bump = () => {
      const token = readDemoResumeToken();
      if (!token) return;
      const now = Date.now();
      if (now - lastSent < 15_000) return;
      lastSent = now;
      void touchDemoLead(token);
    };
    root.addEventListener("pointerdown", bump);
    root.addEventListener("keydown", bump);
    return () => {
      root.removeEventListener("pointerdown", bump);
      root.removeEventListener("keydown", bump);
    };
  }, [sheetOpen, sheetKind]);

  // Pause the hero video while the Log In sheet is open: decoding it under
  // the recess scale halved the sheet's frame rate. Resumes on Close.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (sheetOpen) video.pause();
    else void video.play().catch(() => {});
  }, [sheetOpen]);

  // Lock the page while the sheet is up (user 2026-09-20: "disable scrolling
  // on the city backdrop") — a wheel over the backdrop, or a scroll chained
  // out of the Cal embed, moved the landing underneath. Restores whatever
  // `overflow` was there before.
  useEffect(() => {
    if (!sheetOpen) return;
    const { body } = document;
    const container = pageRef.current;
    const previousBody = body.style.overflow;
    const previousContainer = container?.style.overflowY ?? "";
    body.style.overflow = "hidden";
    // The landing scrolls inside this container, not on the document, so the
    // body lock alone let the backdrop keep moving under the sheet.
    if (container) container.style.overflowY = "hidden";
    return () => {
      body.style.overflow = previousBody;
      if (container) container.style.overflowY = previousContainer;
    };
  }, [sheetOpen]);

  function handleCtaClick() {
    if (ctaPhase !== "idle" || nextOpen) return;
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
          ...deck.querySelectorAll(".t-deck-card, [data-deck-label]"),
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

  /** Never while the Log In panel is up: it covers the whole page, so a click
   *  on it outside the card band would otherwise close the deck behind it. */
  function handleBackdropPointerDown(e: React.PointerEvent) {
    backdropDown.current =
      ctaPhase === "controls" &&
      !sheetOpen &&
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
    if (ctaPhase !== "controls" || sheetOpen || !down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    if (isDeckKeepZone(e.target, e.clientY)) return;
    reverseCta();
  }

  const openAttr = nextOpen ? "true" : "false";

  return (
    <div
      ref={pageRef}
      className="relative min-h-dvh overflow-hidden bg-[#F9F8F6]"
      onPointerDown={handleBackdropPointerDown}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "absolute inset-0 origin-center transition-transform duration-900 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sheetOpen ? "scale-[0.9]" : "scale-100"
        )}
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
        {/* Oil-paint grain finish over the video (under the UI). */}
        <div className="t-hero-grain" aria-hidden />
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
        </div>

        <div className="relative z-30 flex -translate-y-[2vh] justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-14">
          <GetStartedCta
            phase={ctaPhase}
            onClick={handleCtaClick}
            onStep={stepMobileDeck}
          />
        </div>

        <div
          className={`${satoshi.className} relative z-10 flex justify-between px-6 pb-[max(1rem,env(safe-area-inset-bottom))] text-[0.908552rem] font-bold text-[#1c1917]`}
        >
          <FooterStubLink>About Us</FooterStubLink>
          <div className="flex gap-4">
            <FooterStubLink href="/terms">Terms of Use</FooterStubLink>
            <FooterStubLink href="/privacy">Privacy Policy</FooterStubLink>
          </div>
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
              onExtraClick={(key) => {
                if (key === "login" || key === "demo") {
                  setSheetKind(key);
                  setSheetOpen(true);
                  if (key === "demo") {
                    setDemoReservedAt((t) => t ?? Date.now());
                    // Reopening Book a Demo cancels a pending recovery send.
                    const token = readDemoResumeToken();
                    if (token) void cancelDemoLead(token, "reopen");
                  }
                }
              }}
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
            <div className="flex gap-4 lg:gap-6">
              <FooterStubLink href="/terms">Terms of Use</FooterStubLink>
              <FooterStubLink href="/privacy">Privacy Policy</FooterStubLink>
            </div>
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

      </div>

      {/* The Veil */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[300] bg-[rgb(28_25_23/0.35)] transition-opacity duration-900 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sheetOpen ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      />

      {/* The Slide-Up Sheet (Book a Demo; Log In on its way to the app) */}
      <SignInSheet
        sheetRef={demoSheetRef}
        open={sheetOpen}
        atTop={sheetAtTop}
        // Log In hands off at the top, so its card never opens here.
        cardOpen={sheetAtTop && sheetKind === "demo"}
        onReachedTop={() => setSheetAtTop(true)}
        onClose={() => {
          setSheetAtTop(false);
          setSheetOpen(false);
        }}
        topLeft={
          sheetKind === "demo" && demoReservedAt != null ? (
            <ReservedCountdown startedAt={demoReservedAt} />
          ) : null
        }
      >
        {/* Nothing inside the sheet exists until Book a Demo opens it
            (user, 2026-09-21: "load only what is being used"). */}
        {sheetOpen && sheetKind === "demo" ? (
          <DemoForm key={demoFormKey} initial={demoInitial} />
        ) : null}
      </SignInSheet>
    </div>
  );
}

export { LandingHero };
