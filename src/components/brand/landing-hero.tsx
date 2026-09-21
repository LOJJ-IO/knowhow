"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { animate, motion, motionValue } from "framer-motion";
import { Liquid } from "liquid-gooey";
import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { cn } from "@/lib/utils";
import {
  cancelDemoLead,
  fetchDemoResume,
  leadToFormState,
  patchDemoLead,
  readDemoResumeToken,
  touchDemoLead,
  upsertDemoLead,
  writeDemoResumeToken,
  type DemoLeadStep,
} from "@/lib/demo-lead";
import Link from "next/link";
import { UserRoundX } from "lucide-react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import dynamic from "next/dynamic";
import { DemoBookingSlot } from "@/components/brand/demo-booking-slot";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

/** Cal.com's embed is ~100KB of the landing bundle and is only ever needed
 *  on the last Book a Demo step, so it loads on demand (user 2026-09-20:
 *  "the site feels noticeably slower"). No SSR — the embed is browser-only.
 *  `loading` keeps the fixed slot, so the modal still grows exactly once. */
const DemoBookingStep = dynamic(
  () =>
    import("@/components/brand/demo-booking-step").then(
      (m) => m.DemoBookingStep,
    ),
  { ssr: false, loading: () => <DemoBookingSlot /> },
);

gsap.registerPlugin(SplitText, useGSAP);

/** FastAPI backend origin (`backend/`). Sign-in is a full-page redirect to it — see Architecture-Overview's "Backend integration contract". */
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;

/** Hands the browser to the backend's Google sign-in. `/onboarding/signup` signs in existing members and bootstraps new ones, so one button covers both.
 *  An invite token (from a forwarded `?invite=` link) pre-selects the invited Google account. */
function continueWithGoogle(inviteToken?: string | null, emailHint?: string | null) {
  if (!BACKEND_API_URL) {
    console.error("NEXT_PUBLIC_BACKEND_API_URL is not set — cannot start Google sign-in.");
    return;
  }
  // `email` only pre-selects the account at Google (login_hint) — Google
  // still decides who signs in, so a remembered row grants nothing.
  const params = new URLSearchParams();
  if (inviteToken) params.set("invite", inviteToken);
  if (emailHint) params.set("email", emailHint);
  const query = params.size ? `?${params}` : "";
  // External origin (the backend), not a Next.js route — a router push can't leave the app.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${BACKEND_API_URL}/onboarding/signup${query}`);
}

/** `?invite=<token>` from a forwarded owner / Super Admin link. The backend
 *  also sends `?invite=wrong_account`, which is a result, not a token. */
function readInviteToken(): string | null {
  const invite = new URLSearchParams(window.location.search).get("invite");
  return invite && invite !== "wrong_account" ? invite : null;
}

/** Sends the browser to Google to confirm the signed-in person is a Super
 *  Admin of their Workspace; the backend comes back with `?admin_proof=…`. */
function startAdminProof() {
  if (!BACKEND_API_URL) return;
  // External origin (the backend), not a Next.js route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${BACKEND_API_URL}/auth/admin-proof/start`);
}

/** The backend's `/auth/me` — who's signed in, if anyone. */
type Me = {
  id: string;
  organization_id: string;
  organization_name: string;
  organization_domain: string | null;
  email: string;
  standing: "approved" | "auto_affiliated";
  is_owner: boolean;
  needs_org_setup: boolean;
  /** Where setup stopped, if it did: "orgName" | "teams" | "ownTeam".
   *  Null when there's nothing to resume. */
  setup_step: string | null;
  is_super_admin: boolean;
};

/** Calls the backend with its session cookies (they live on the backend's origin). */
function backendFetch(path: string, init?: RequestInit) {
  return fetch(`${BACKEND_API_URL}${path}`, { ...init, credentials: "include" });
}

/** A readable message from a failed backend response. FastAPI sends
 *  `detail` as a string for our own errors and as a list of field errors
 *  for validation failures (422). */
async function backendError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string")
    return detail[0].msg;
  return `Request failed (${res.status})`;
}

/** One account this browser has signed in with before — the Log In picker.
 *  The backend keys these to an opaque device cookie, not to a person:
 *  Knohow can't tell that two Google accounts are the same human. */
/** One row in the picker: an organization this browser has signed in to.
 *  Signing in is signing in to an org (user 2026-09-20), so the org's name
 *  leads and the person's name is the subtext — two companies plus a personal
 *  org is three rows. */
type RememberedOrg = {
  member_id: string;
  organization_name: string;
  person_name: string | null;
  email: string;
  /** "org" — a Workspace account. "personal" — any non-Workspace account,
   *  whichever org it belongs to (user 2026-09-20), so a contractor's Gmail
   *  inside a company org reads as personal. */
  kind: "org" | "personal";
  /** Addresses proved to be this person's that have no org of their own, so
   *  they get no row. They show as a Personal (n) chip on each of the
   *  person's rows (user 2026-09-20), which is why the same list can repeat. */
  linked_personal_emails: string[];
};

async function fetchRememberedOrgs(): Promise<RememberedOrg[]> {
  if (!BACKEND_API_URL) return [];
  try {
    const res = await backendFetch("/auth/remembered-accounts");
    if (!res.ok) return [];
    return ((await res.json()) as { organizations: RememberedOrg[] }).organizations;
  } catch {
    // Backend down — the picker just doesn't appear, and Log In falls back
    // to "Continue with Google".
    return [];
  }
}

/** Forgets the named rows on this browser, or all of them when none are
 *  named. Members, organizations and linked identities are untouched. */
/** Forgets remembered rows, hides linked personal addresses, or both.
 *  Passing neither forgets everything on this browser. A linked address has
 *  no row of its own, so removing one from the sign-in screen is a hide on
 *  this device, never an unlink (user, 2026-09-21). */
async function forgetRememberedAccounts(
  memberIds?: string[],
  emails?: string[],
): Promise<void> {
  if (!BACKEND_API_URL) return;
  try {
    await backendFetch("/auth/remembered-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_ids: memberIds ?? null,
        emails: emails ?? null,
      }),
    });
  } catch {
    // Nothing to recover: the caller updates the list either way.
  }
}

async function fetchMe(): Promise<Me | null> {
  if (!BACKEND_API_URL) return null;
  try {
    const res = await backendFetch("/auth/me");
    return res.ok ? ((await res.json()) as Me) : null;
  } catch {
    return null; // backend not running — the landing works without it
  }
}

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
function GetStartedCta({
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
function DeckCoverFlow({
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

/** Log In panel sky — deterministic (seeded) so server and client render the
 *  same stars. Stars sit in the top half, where signinbg.png is dark blue, and
 *  thin out towards the horizon glow. */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeding alone isn't enough: `Math.pow` can differ in the last bit between
 *  Node and the browser, and a style string that differs by one digit is a
 *  hydration mismatch. Rounding every value makes them identical. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const LOGIN_STARS = (() => {
  const rand = seeded(7);
  return Array.from({ length: 90 }, () => {
    const y = Math.pow(rand(), 1.6) * 52;
    return {
      x: round3(rand() * 100),
      y: round3(y),
      size: rand() < 0.15 ? 2.5 : rand() < 0.5 ? 1.75 : 1.25,
      /** Dimmer lower down, where the sky is lighter. */
      peak: round3(0.95 - (y / 52) * 0.55),
      dur: round3(2.5 + rand() * 4),
      delay: round3(-rand() * 6),
    };
  });
})();

/** Each streak runs on its own long loop and is only visible for the first
 *  few percent of it, so they cross at staggered, irregular-feeling times. */
const LOGIN_SHOOTING_STARS = [
  { x: 22, y: 6, loop: 7, delay: 1.2, len: 140 },
  { x: 55, y: 12, loop: 11, delay: 4.5, len: 110 },
  { x: 8, y: 22, loop: 13, delay: 8, len: 170 },
];

/** Google's multicolour "G" (standard sign-in mark). */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const DEMO_FIELDS = [
  { name: "firstName", label: "First name", type: "text", autoComplete: "given-name" },
  { name: "lastName", label: "Last name", type: "text", autoComplete: "family-name" },
  { name: "email", label: "Work email", type: "email", autoComplete: "email" },
  { name: "website", label: "Company website", type: "text", autoComplete: "url" },
] as const;

/** ms an error stays up before border + message fade back (`--revert-hold`). */
const DEMO_ERROR_HOLD_MS = 3000;

/** Fields shown per step: names first, then + work email, then + website. */
const DEMO_STEP_FIELD_COUNT = [2, 3, 4] as const;

/** Book a Demo sheet's form. Starts with the name fields; each valid Continue
 *  adds the next field (the modal's `.t-resize` tweens the growth) until the
 *  website is in. After a valid work email, progress is upserted to the backend
 *  for abandoned-recovery Resend ([[FEAT-landing-book-a-demo]]). */
type DemoFormInitial = ReturnType<typeof leadToFormState>;

function DemoForm({ initial }: { initial?: DemoFormInitial | null }) {
  const wraps = useRef<Record<string, HTMLDivElement | null>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const timers = useRef<Record<string, number>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [step, setStep] = useState(initial?.fieldStep ?? 0);
  const [values, setValues] = useState({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    email: initial?.email ?? "",
    website: initial?.website ?? "",
  });
  const [resumeToken, setResumeToken] = useState<string | null>(
    initial?.resumeToken ?? readDemoResumeToken(),
  );
  const [phase, setPhase] = useState<"fields" | "segment" | "size" | "booking">(
    initial?.phase ?? "fields",
  );
  const [segment, setSegment] = useState<string | null>(initial?.segment ?? null);
  const [other, setOther] = useState(initial?.other ?? "");
  const [teamSize, setTeamSize] = useState<string | null>(initial?.size ?? null);
  const shown = DEMO_FIELDS.slice(0, DEMO_STEP_FIELD_COUNT[step]);

  useEffect(() => {
    if (step === 0 || phase !== "fields") return;
    const added = DEMO_FIELDS[DEMO_STEP_FIELD_COUNT[step] - 1];
    inputs.current[added.name]?.focus();
  }, [step, phase]);

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach((id) => window.clearTimeout(id));
  }, []);

  function flagError(name: string, message: string) {
    const wrap = wraps.current[name];
    const input = inputs.current[name];
    if (!wrap || !input) return;
    setMessages((m) => ({ ...m, [name]: message }));
    wrap.classList.add("is-error");
    input.classList.add("is-error");
    input.setAttribute("aria-invalid", "true");
    input.classList.remove("is-shaking");
    void input.offsetWidth;
    input.classList.add("is-shaking");
    window.clearTimeout(timers.current[name]);
    timers.current[name] = window.setTimeout(
      () => clearError(name),
      DEMO_ERROR_HOLD_MS,
    );
  }

  function clearError(name: string) {
    window.clearTimeout(timers.current[name]);
    wraps.current[name]?.classList.remove("is-error");
    inputs.current[name]?.classList.remove("is-error");
    inputs.current[name]?.removeAttribute("aria-invalid");
  }

  async function syncLead(nextStep: DemoLeadStep, extra?: {
    segment?: string | null;
    other_text?: string | null;
    team_size?: string | null;
  }) {
    const email = values.email.trim();
    if (!email || !email.includes("@")) return;
    try {
      if (!resumeToken) {
        const lead = await upsertDemoLead({
          email,
          first_name: values.firstName,
          last_name: values.lastName,
          website: values.website || null,
          segment: extra?.segment ?? segment,
          other_text: extra?.other_text ?? (other || null),
          team_size: extra?.team_size ?? teamSize,
          step: nextStep,
        });
        if (lead) {
          setResumeToken(lead.resume_token);
          writeDemoResumeToken(lead.resume_token);
        }
      } else {
        await patchDemoLead(resumeToken, {
          first_name: values.firstName,
          last_name: values.lastName,
          website: values.website || null,
          segment: extra?.segment ?? segment,
          other_text: extra?.other_text ?? (other || null),
          team_size: extra?.team_size ?? teamSize,
          step: nextStep,
        });
      }
    } catch (e) {
      console.error("demo lead sync failed", e);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let first: HTMLInputElement | null = null;
    for (const { name } of shown) {
      const input = inputs.current[name];
      if (!input) continue;
      if (input.checkValidity()) {
        clearError(name);
        continue;
      }
      flagError(name, input.validationMessage);
      first ??= input;
    }
    if (first) {
      first.focus();
      return;
    }
    const nextValues = {
      firstName: inputs.current.firstName?.value ?? values.firstName,
      lastName: inputs.current.lastName?.value ?? values.lastName,
      email: inputs.current.email?.value ?? values.email,
      website: inputs.current.website?.value ?? values.website,
    };
    setValues(nextValues);

    if (step < DEMO_STEP_FIELD_COUNT.length - 1) {
      const nextStepIndex = step + 1;
      setStep(nextStepIndex);
      // Arm recovery once work email is on the form and valid (leaving the
      // email step → website step).
      if (nextStepIndex === 2 && nextValues.email.includes("@")) {
        void (async () => {
          try {
            const lead = await upsertDemoLead({
              email: nextValues.email,
              first_name: nextValues.firstName,
              last_name: nextValues.lastName,
              website: nextValues.website || null,
              step: "website",
            });
            if (lead) {
              setResumeToken(lead.resume_token);
              writeDemoResumeToken(lead.resume_token);
            }
          } catch (err) {
            console.error("demo lead sync failed", err);
          }
        })();
      } else if (resumeToken && nextStepIndex === 1) {
        void patchDemoLead(resumeToken, {
          first_name: nextValues.firstName,
          last_name: nextValues.lastName,
          step: "email",
        }).catch((err) => console.error("demo lead sync failed", err));
      }
    } else {
      void syncLead("website").then(() => setPhase("segment"));
    }
  }

  if (phase === "booking") return <DemoBookingStep />;
  if (phase === "size")
    return (
      <DemoSizeStep
        initial={teamSize}
        onPick={(size) => {
          setTeamSize(size);
          void syncLead("size", { team_size: size });
        }}
        onContinue={() => {
          void syncLead("booking", { team_size: teamSize }).then(() =>
            setPhase("booking"),
          );
        }}
      />
    );
  if (phase === "segment")
    return (
      <DemoSegmentStep
        initialPicked={segment}
        initialOther={other}
        onPick={(id, otherText) => {
          setSegment(id);
          setOther(otherText);
          void syncLead("segment", {
            segment: id,
            other_text: otherText || null,
          });
        }}
        onContinue={(id, otherText) => {
          setSegment(id);
          setOther(otherText);
          void syncLead("size", {
            segment: id,
            other_text: otherText || null,
          }).then(() => setPhase("size"));
        }}
      />
    );

  return (
    <form noValidate onSubmit={handleSubmit}>
      <h2
        className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
      >
        Book a Demo
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-x-2 gap-y-1">
        {shown.map((f, i) => (
          <div
            key={f.name}
            ref={(el) => {
              wraps.current[f.name] = el;
            }}
            className={cn(
              `t-input-wrap ${satoshi.className} flex min-w-0 flex-col`,
              i > 1 && "col-span-2",
            )}
          >
            <label
              htmlFor={`demo-${f.name}`}
              className="mb-1.5 text-[0.8rem] text-[rgb(28_25_23/0.6)]"
            >
              {f.label}
            </label>
            <input
              ref={(el) => {
                inputs.current[f.name] = el;
              }}
              id={`demo-${f.name}`}
              name={f.name}
              type={f.type}
              autoComplete={f.autoComplete}
              inputMode={f.name === "website" ? "url" : undefined}
              required
              defaultValue={
                f.name === "firstName"
                  ? values.firstName
                  : f.name === "lastName"
                    ? values.lastName
                    : f.name === "email"
                      ? values.email
                      : values.website
              }
              onInput={(e) => {
                const v = e.currentTarget.value;
                setValues((prev) => ({
                  ...prev,
                  ...(f.name === "firstName"
                    ? { firstName: v }
                    : f.name === "lastName"
                      ? { lastName: v }
                      : f.name === "email"
                        ? { email: v }
                        : { website: v }),
                }));
                if (e.currentTarget.checkValidity()) clearError(f.name);
              }}
              aria-describedby={`demo-${f.name}-error`}
              className="t-input t-demo-input h-10 w-full min-w-0 rounded-[var(--login-button-radius)] border bg-white px-3 text-[0.95rem] text-[#1c1917] outline-none"
            />
            <p
              id={`demo-${f.name}-error`}
              aria-live="polite"
              className="t-error-msg m-0 mt-1 min-h-[1.2rem] text-[0.75rem] leading-[1.2rem] text-[#EA4335]"
            >
              {messages[f.name]}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className={cn(CTA_CLASS, satoshi.className, "bg-black")}
        >
          Continue
        </button>
      </div>
    </form>
  );
}

/** The segments offered on the Book a Demo industry step. Labels, blurbs
 *  and icons are placeholder copy until the user writes them. */
const DEMO_SEGMENTS = [
  {
    id: "agencies",
    label: "Agencies",
    blurb: "Keep client IP under your control.",
    icon: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    ),
  },
  {
    id: "startups",
    label: "Startups",
    blurb: "Own your files from day one.",
    icon: (
      <>
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91 0z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </>
    ),
  },
  {
    id: "nonprofits",
    label: "Nonprofits",
    blurb: "Never lose work when people leave.",
    icon: (
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    ),
  },
  {
    id: "other",
    label: "Other",
    blurb: "Tell us below.",
    icon: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
  },
] as const;

/** Segment card — the setup steps' choice button, grown to hold an outline
 *  icon, a title and a blurb. Picked = the hairline darkens to the text
 *  colour; nothing else changes. */
const DEMO_SEGMENT_CLASS = `relative flex w-full cursor-pointer items-start gap-3 rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white p-4 text-left text-[#1c1917] transition-[transform,border-color] duration-150 active:scale-[0.98]`;

/** Last Book a Demo field step: which kind of organization this is. One
 *  choice, skippable. Continue / Skip → team-size step → Cal. */
function DemoSegmentStep({
  initialPicked,
  initialOther,
  onPick,
  onContinue,
}: {
  initialPicked: string | null;
  initialOther: string;
  onPick: (id: string | null, other: string) => void;
  onContinue: (id: string | null, other: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(initialPicked);
  const [other, setOther] = useState(initialOther);
  const otherRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (picked === "other") otherRef.current?.focus();
  }, [picked]);

  return (
    <div>
      <h2
        className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
      >
        Who&rsquo;s this for?
      </h2>
      <div className={`${satoshi.className} mt-6 flex flex-col gap-3`}>
        {DEMO_SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={picked === s.id}
            onClick={() => {
              setPicked(s.id);
              onPick(s.id, other);
            }}
            className={cn(
              DEMO_SEGMENT_CLASS,
              picked === s.id && s.id !== "other" && "border-[#1c1917]",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-[2px] size-5 shrink-0"
              aria-hidden
            >
              {s.icon}
            </svg>
            <span className="flex min-w-0 flex-col">
              <span className="text-[1rem] font-bold leading-[1.2]">
                {s.label}
              </span>
              <span className="mt-1 text-[0.8rem] leading-[1.35] text-[rgb(28_25_23/0.6)]">
                {s.blurb}
              </span>
            </span>
          </button>
        ))}
      </div>
      {picked === "other" ? (
        <div className={`t-input-wrap ${satoshi.className} mt-3 flex flex-col`}>
          <input
            ref={otherRef}
            type="text"
            aria-label="Who this is for"
            value={other}
            onChange={(e) => {
              setOther(e.target.value);
              onPick("other", e.target.value);
            }}
            className="t-input t-demo-input is-picked h-10 w-full min-w-0 rounded-[var(--login-button-radius)] border bg-white px-3 text-[0.95rem] text-[#1c1917] outline-none"
          />
        </div>
      ) : null}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onContinue(picked, other)}
          className={cn(CTA_CLASS, satoshi.className, "bg-black")}
        >
          {picked ? "Continue" : "Skip"}
        </button>
      </div>
    </div>
  );
}

/** Team-size chips — ranges from the hotel reference UI; question copy
 *  affirmed by the user 2026-09-20. */
const DEMO_SIZES = ["1", "2–5", "6–20", "21–50", "51–100", "100+"] as const;

const DEMO_SIZE_CLASS = `flex h-11 min-w-0 cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white px-1 text-[0.9rem] font-bold text-[#1c1917] transition-[transform,border-color] duration-150 active:scale-[0.98]`;

/** After industry: how many people. Skippable like the segment step; then Cal. */
function DemoSizeStep({
  initial,
  onPick,
  onContinue,
}: {
  initial: string | null;
  onPick: (size: string) => void;
  onContinue: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(initial);

  return (
    <div>
      <h2
        className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
      >
        How many people on your team?
      </h2>
      <div
        className={`${satoshi.className} mt-6 grid grid-cols-3 gap-2`}
        role="group"
        aria-label="Team size"
      >
        {DEMO_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={picked === size}
            onClick={() => {
              setPicked(size);
              onPick(size);
            }}
            className={cn(
              DEMO_SIZE_CLASS,
              picked === size && "border-[#1c1917]",
            )}
          >
            {size}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className={cn(CTA_CLASS, satoshi.className, "bg-black")}
        >
          {picked ? "Continue" : "Skip"}
        </button>
      </div>
    </div>
  );
}

/** Choice buttons in the setup steps — the Continue with Google button's look. */
const SETUP_CHOICE_CLASS = `relative flex h-12 w-full cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white text-[1rem] font-bold text-[#1c1917] transition-transform duration-150 active:scale-[0.98] disabled:cursor-default disabled:opacity-60`;

const setupHeading = (text: string) => (
  <h2
    className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
  >
    {text}
  </h2>
);

const setupBody = (text: string) => (
  <p
    className={`${sohne.className} mt-6 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
  >
    {text}
  </p>
);

type SetupStep =
  | "owner"
  | "knowOwnerEmail"
  | "ownerEmail"
  | "superAdmin"
  | "verifyAdmin"
  | "orgName"
  | "teams"
  | "ownTeam"
  | "inviteLink"
  | "done";

/** First sign-in for a new organization: the owner and Super Admin
 *  questions (FEAT-workspace-onboarding-flow). Copy is the spec's wording,
 *  a placeholder until the user designs these screens. */
function OrgSetupForm({ me, onDone }: { me: Me; onDone: () => void }) {
  // Resume where they stopped; "owner" only when setup hasn't started.
  const [step, setStep] = useState<SetupStep>(
    (me.setup_step as SetupStep | null) ?? "owner",
  );
  const [isOwner, setIsOwner] = useState(true);
  // Starts as whatever the org is called now (its domain, until the naming
  // screen replaces it) so the teams heading always has something to say.
  const [orgName, setOrgName] = useState(me.organization_name);
  const [teams, setTeams] = useState<SetupTeam[]>([]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const ownerEmailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "ownerEmail") ownerEmailRef.current?.focus();
  }, [step]);

  async function submit(isSuperAdmin: boolean) {
    setSubmitting(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${me.organization_id}/org-chart`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_owner: isOwner,
            is_super_admin: isSuperAdmin,
            owner_email: isOwner || !ownerEmail ? null : ownerEmail,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await backendError(res));
      }
      if (isSuperAdmin) {
        // "Yes" is only a claim — Google confirms it (admin proof) before
        // Knohow treats them as Super Admin.
        startAdminProof();
        return;
      }
      // "No" and "I don't know" both land here: any member may still prove
      // they're the Workspace admin, and only Google can settle it.
      setStep("verifyAdmin");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const heading = setupHeading;
  const body = setupBody;
  const errorLine = error ? (
    <p
      aria-live="polite"
      className={`${satoshi.className} m-0 mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
    >
      {error}
    </p>
  ) : null;

  if (step === "owner")
    return (
      <div>
        {heading("Are you the owner of the organization?")}
        <div className={`${satoshi.className} mt-8 flex flex-col gap-3`}>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => {
              setIsOwner(true);
              setOwnerEmail("");
              setStep("superAdmin");
            }}
          >
            Yes
          </button>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => {
              setIsOwner(false);
              setStep("knowOwnerEmail");
            }}
          >
            No
          </button>
        </div>
      </div>
    );

  // Same Yes / No pattern as the owner question (user dropped "I don't know"
  // here 2026-09-20). No → continue without nominating.
  if (step === "knowOwnerEmail")
    return (
      <div>
        {heading("Do you know the owner\u2019s email?")}
        <div className={`${satoshi.className} mt-8 flex flex-col gap-3`}>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => setStep("ownerEmail")}
          >
            Yes
          </button>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => {
              setOwnerEmail("");
              setStep("superAdmin");
            }}
          >
            No
          </button>
        </div>
      </div>
    );

  if (step === "ownerEmail")
    return (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const input = ownerEmailRef.current;
          if (!input?.checkValidity()) {
            setError(input?.validationMessage ?? "");
            return;
          }
          setError("");
          setStep("superAdmin");
        }}
      >
        {heading("Owner’s work email")}
        <div className={`t-input-wrap ${satoshi.className} mt-6 flex flex-col`}>
          <input
            ref={ownerEmailRef}
            type="email"
            required
            autoComplete="off"
            aria-label="Owner's work email"
            value={ownerEmail}
            onChange={(e) => {
              setOwnerEmail(e.target.value);
              setError("");
            }}
            className="t-input t-demo-input h-10 w-full min-w-0 rounded-[var(--login-button-radius)] border bg-white px-3 text-[0.95rem] text-[#1c1917] outline-none"
          />
        </div>
        {errorLine}
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            className={cn(CTA_CLASS, satoshi.className, "bg-black")}
          >
            Continue
          </button>
        </div>
      </form>
    );

  if (step === "superAdmin")
    return (
      <div>
        {heading("Are you a Google Workspace Super Admin?")}
        <div className={`${satoshi.className} mt-8 flex flex-col gap-3`}>
          <button
            type="button"
            disabled={submitting}
            className={SETUP_CHOICE_CLASS}
            onClick={() => void submit(true)}
          >
            Yes
          </button>
          <button
            type="button"
            disabled={submitting}
            className={SETUP_CHOICE_CLASS}
            onClick={() => void submit(false)}
          >
            No
          </button>
          <button
            type="button"
            disabled={submitting}
            className={SETUP_CHOICE_CLASS}
            onClick={() => void submit(false)}
          >
            I don&rsquo;t know
          </button>
        </div>
        {errorLine}
      </div>
    );

  // Nobody has to know who the Super Admin is: whoever passes admin proof is
  // it. Google asks for an extra permission, so this can't run at sign-in —
  // it needs its own round trip, hence a button. PLACEHOLDER copy.
  if (step === "verifyAdmin")
    return (
      <div>
        {heading("Not sure who your Workspace admin is?")}
        {body(
          "If you're a Google Workspace admin, Google can confirm it. You'll be asked for one extra permission.",
        )}
        <div className={`${satoshi.className} mt-8 flex flex-col gap-3`}>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={startAdminProof}
          >
            Verify I&rsquo;m the Workspace admin
          </button>
          <button
            type="button"
            className={SETUP_CHOICE_CLASS}
            onClick={() => {
              void recordSetupStep("orgName");
              setStep("orgName");
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    );

  // Setup proper: name the organization, then build its teams.
  if (step === "orgName")
    return (
      <OrgNameStep
        me={me}
        onDone={(name) => {
          setOrgName(name);
          void recordSetupStep("teams");
          setStep("teams");
        }}
      />
    );

  if (step === "teams")
    return (
      <TeamsStep
        me={me}
        orgName={orgName}
        onDone={(created) => {
          setTeams(created);
          void recordSetupStep("ownTeam");
          setStep("ownTeam");
        }}
      />
    );

  if (step === "ownTeam")
    return (
      <OwnTeamStep
        me={me}
        teams={teams}
        onDone={() => {
          void recordSetupStep("inviteLink");
          setStep("inviteLink");
        }}
      />
    );

  if (step === "inviteLink")
    return (
      <InviteLinkStep
        me={me}
        onDone={() => {
          void recordSetupStep("done");
          onDone();
        }}
      />
    );

  // "done" — the signed-in screen isn't designed yet (user will describe it).
  return null;
}

/** Remembers how far setup got, so the next sign-in resumes here instead of
 *  the landing page. Best-effort: failing to record progress must never block
 *  the founder from moving on, it only costs them the resume. */
async function recordSetupStep(step: string): Promise<void> {
  if (!BACKEND_API_URL) return;
  try {
    await backendFetch("/onboarding/setup-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
  } catch {
    // Nothing to recover.
  }
}

/** A Workspace org is created with its hosted domain as its name, because at
 *  that moment nobody has been asked. `acme.org` is a placeholder; this turns
 *  it into the guess a founder is most likely to accept. */
function suggestOrgName(me: Me): string {
  const domain = me.organization_domain;
  // Already named by a human (or a personal org, which was named at creation).
  if (!domain || me.organization_name.toLowerCase() !== domain.toLowerCase())
    return me.organization_name;
  return domain
    .split(".")[0]
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** "What's your organization called?" — the first screen of setup proper.
 *
 *  Everything downstream reads this name: the invite link's sign-in screen,
 *  the "already with {OtherOrg}" refusal, and the Log In account picker. Left
 *  unasked it would read `acme.org` in all three. */
function OrgNameStep({
  me,
  onDone,
}: {
  me: Me;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState(() => suggestOrgName(me));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // The guess is a suggestion, not an answer: selecting it means one
    // keystroke replaces it for anyone whose name isn't their domain.
    input.select();
  }, []);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await backendFetch(`/organizations/${me.organization_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(await backendError(res));
      const org = await res.json();
      onDone(org.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {setupHeading("What\u2019s your organization called?")}
      {setupBody("This is the name your team sees when they join.")}

      <div className={`t-input-wrap ${satoshi.className} mt-6 flex flex-col`}>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          aria-label="Organization name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          className="t-input t-demo-input h-10 w-full min-w-0 rounded-[var(--login-button-radius)] border bg-white px-3 text-[0.95rem] text-[#1c1917] outline-none"
        />
      </div>

      {error ? (
        <p
          aria-live="polite"
          className={`${satoshi.className} m-0 mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className={cn(CTA_CLASS, satoshi.className, "bg-black")}
        >
          Continue
        </button>
      </div>
    </form>
  );
}

/** A team as the setup list holds it. Setup only makes flat teams; nesting
 *  isn't part of this screen. */
type SetupTeam = { id: string; name: string };

/** One committed team, as a pill. The chip owns its height and its maximum
 *  width; the label owns its natural width and is the only part allowed to
 *  shrink; the remove control never compresses. */
const TEAM_PILL_CLASS =
  "inline-flex h-7 w-fit max-w-[min(70%,24ch)] shrink-0 items-center gap-1 rounded-full bg-[#1c1917]/[0.07] px-2.5 text-xs font-bold text-[#1c1917]";

/** "What teams are in {Org}?" — a tag field, not a form.
 *
 *  Type a name, press Enter, it commits as a pill and the caret stays put for
 *  the next one. **One button on the screen** (user, 2026-09-21): Enter is the
 *  commit, so there is no Add button competing with Continue, and Enter can
 *  never carry you to the next screen — the earlier version submitted the form
 *  and skipped ahead, which is precisely what one-button-per-screen exists to
 *  stop. Nothing here is ever rendered greyed-out.
 *
 *  Each team is written to the backend the moment it commits, so a founder who
 *  closes the tab comes back to the pills they already made. */
function TeamsStep({
  me,
  orgName,
  onDone,
}: {
  me: Me;
  orgName: string;
  onDone: (teams: SetupTeam[]) => void;
}) {
  const [teams, setTeams] = useState<SetupTeam[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await backendFetch(`/org-chart/${me.organization_id}`);
        if (!res.ok) throw new Error(await backendError(res));
        const chart = await res.json();
        if (cancelled) return;
        setTeams(
          (chart.teams ?? []).map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          })),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) inputRef.current?.focus();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.organization_id]);

  async function commit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    if (teams.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`${trimmed} is already there.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${me.organization_id}/teams`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        },
      );
      if (!res.ok) throw new Error(await backendError(res));
      const team = await res.json();
      setTeams((current) => [...current, { id: team.id, name: team.name }]);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function remove(team: SetupTeam) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await backendFetch(
        `/organizations/${me.organization_id}/teams/${team.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(await backendError(res));
      setTeams((current) => current.filter((t) => t.id !== team.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div>
      {setupHeading(`What teams are in ${orgName}?`)}
      {setupBody("Add the ones that exist today. You can change them later.")}

      {/* The field is the list: pills and the caret share one row and wrap
          together, so there is nothing to scroll and no separate list below. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={`t-input-wrap ${satoshi.className} mt-6 flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white px-2.5 py-1.5`}
      >
        {teams.map((team) => (
          <span key={team.id} className={TEAM_PILL_CLASS}>
            <span className="min-w-0 truncate text-left">{team.name}</span>
            <button
              type="button"
              aria-label={`Remove ${team.name}`}
              onClick={(e) => {
                e.stopPropagation();
                void remove(team);
              }}
              className="size-4 shrink-0 cursor-pointer opacity-60 transition-opacity hover:opacity-100"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-4">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          aria-label="Team name"
          placeholder={teams.length ? "" : "Team name"}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Commits the team. Never submits, never advances.
              e.preventDefault();
              void commit();
              return;
            }
            // Backspace on an empty caret takes back the last pill, the way
            // every other tag field behaves.
            if (e.key === "Backspace" && !name && teams.length) {
              e.preventDefault();
              void remove(teams[teams.length - 1]);
            }
          }}
          className="h-7 min-w-[8ch] flex-1 border-0 bg-transparent px-1 text-[0.95rem] text-[#1c1917] outline-none"
        />
      </div>

      {error ? (
        <p
          aria-live="polite"
          className={`${satoshi.className} m-0 mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => onDone(teams)}
          className={cn(CTA_CLASS, satoshi.className, "bg-black")}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/** "Which teams are you in?" — the pills made on the screen before, now the
 *  thing you click. Several are allowed (user, 2026-09-21: "i could also be in
 *  more than one team"). **One button on the screen**: picking a pill is not a
 *  commitment, Continue is. */
function OwnTeamStep({
  me,
  teams,
  onDone,
}: {
  me: Me;
  teams: SetupTeam[];
  onDone: () => void;
}) {
  const NONE = "none";
  const [selected, setSelected] = useState<string[]>([]);
  const [known, setKnown] = useState<SetupTeam[]>(teams);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Resuming setup lands here with nothing carried over from the teams
  // screen, so the list has to be able to stand on its own.
  useEffect(() => {
    if (teams.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await backendFetch(`/org-chart/${me.organization_id}`);
        if (!res.ok) throw new Error(await backendError(res));
        const chart = await res.json();
        if (cancelled) return;
        setKnown(
          (chart.teams ?? []).map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          })),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me.organization_id, teams.length]);

  /** "Not in any" is the opposite of picking teams, so the two can't hold at
   *  once, either way round. */
  function toggle(value: string) {
    setError("");
    setSelected((current) => {
      if (value === NONE) return current.includes(NONE) ? [] : [NONE];
      const withoutNone = current.filter((v) => v !== NONE);
      return withoutNone.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value];
    });
  }

  async function submit() {
    if (busy) return;
    if (selected.length === 0 || selected.includes(NONE)) {
      onDone();
      return;
    }
    setBusy(true);
    setError("");
    try {
      // One membership row per team: the backend upserts per (team, member),
      // so there is no batch endpoint to reach for.
      for (const teamId of selected) {
        const res = await backendFetch(
          `/organizations/${me.organization_id}/memberships`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              member_id: me.id,
              team_id: teamId,
              // Being in a team isn't authority: whether they own the org is
              // settled by the owner question, not by this membership.
              role: "member",
            }),
          },
        );
        if (!res.ok) throw new Error(await backendError(res));
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const pill = (value: string, label: string) => {
    const on = selected.includes(value);
    return (
      <button
        key={value}
        type="button"
        aria-pressed={on}
        onClick={() => toggle(value)}
        className={cn(
          "inline-flex h-9 w-fit max-w-[min(70%,24ch)] shrink-0 cursor-pointer items-center rounded-full border px-3.5 text-[0.85rem] font-bold transition-colors duration-150 active:scale-[0.98]",
          on
            ? "border-[#1c1917] bg-[#1c1917] text-white"
            : "border-[#d9d9de] bg-white text-[#1c1917]",
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
      </button>
    );
  };

  return (
    <div>
      {setupHeading("Which teams are you in?")}
      {setupBody("Pick as many as apply.")}

      <div
        className={`${satoshi.className} mt-6 flex flex-wrap items-center gap-1.5`}
      >
        {known.map((team) => pill(team.id, team.name))}
        {pill(NONE, "I\u2019m not in any")}
      </div>

      {error ? (
        <p
          aria-live="polite"
          className={`${satoshi.className} m-0 mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => void submit()}
          className={cn(CTA_CLASS, satoshi.className, "bg-black")}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/** A choice pill: the shape the teams screens use, reused wherever a screen
 *  offers options. Picking one is never the screen's action — the single
 *  button is. */
function ChoicePill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-fit max-w-[min(70%,24ch)] shrink-0 cursor-pointer items-center rounded-full border px-3.5 text-[0.85rem] font-bold transition-colors duration-150 active:scale-[0.98]",
        selected
          ? "border-[#1c1917] bg-[#1c1917] text-white"
          : "border-[#d9d9de] bg-white text-[#1c1917]",
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

/** "Ready to bring everyone in?" — the invite link, one screen per action
 *  (user, 2026-09-21): offer it, choose how long it lasts, hand it over.
 *  Three screens rather than one, because each asks for a separate decision. */
type LinkStep = "offer" | "lifetime" | "ready";

const LINK_LIFETIMES: { value: string; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "forever", label: "No end date" },
];

function InviteLinkStep({ me, onDone }: { me: Me; onDone: () => void }) {
  const [step, setStep] = useState<LinkStep>("offer");
  // Pre-picked so the button is never dead and nothing is ever greyed out;
  // the owner still chooses ([[0014-org-setup-and-join-link]]).
  const [lifetime, setLifetime] = useState("7d");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const domain = me.organization_domain;

  const errorLine = error ? (
    <p
      aria-live="polite"
      className={`${satoshi.className} m-0 mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
    >
      {error}
    </p>
  ) : null;

  const oneButton = (label: string, onClick: () => void) => (
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        className={cn(CTA_CLASS, satoshi.className, "bg-black")}
      >
        {label}
      </button>
    </div>
  );

  if (step === "offer")
    return (
      <div>
        {setupHeading("Ready to bring everyone in?")}
        {setupBody(
          domain
            ? `One link works for everyone at ${domain}. They pick their team, you approve.`
            : "One link works for everyone. They pick their team, you approve.",
        )}
        {oneButton("Create invite link", () => setStep("lifetime"))}
      </div>
    );

  if (step === "lifetime")
    return (
      <div>
        {setupHeading("How long should the link work?")}
        {setupBody("You can turn it off at any time.")}
        <div
          className={`${satoshi.className} mt-6 flex flex-wrap items-center gap-1.5`}
        >
          {LINK_LIFETIMES.map((option) => (
            <ChoicePill
              key={option.value}
              label={option.label}
              selected={lifetime === option.value}
              onClick={() => {
                setLifetime(option.value);
                setError("");
              }}
            />
          ))}
        </div>
        {errorLine}
        {oneButton("Continue", () => {
          if (busy) return;
          setBusy(true);
          setError("");
          void (async () => {
            try {
              const res = await backendFetch(
                `/organizations/${me.organization_id}/join-link`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lifetime }),
                },
              );
              if (!res.ok) throw new Error(await backendError(res));
              const link = await res.json();
              setUrl(link.url);
              setStep("ready");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          })();
        })}
      </div>
    );

  return (
    <div>
      {setupHeading("Your link is ready.")}
      {setupBody(
        domain
          ? `Anyone with a ${domain} account can use it. Everyone else is turned away.`
          : "Anyone you send it to can use it.",
      )}
      <p
        className={`${satoshi.className} mt-6 truncate rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white px-3 py-2 text-[0.85rem] text-[#1c1917]/70`}
      >
        {url}
      </p>
      {errorLine}
      {/* Copying is the screen's one action, and it's also what finishes
          setup — there's nothing left to decide after it. */}
      {oneButton(copied ? "Copied" : "Copy link", () => {
        void navigator.clipboard
          ?.writeText(url)
          .then(() => setCopied(true))
          .catch(() => setCopied(true))
          .finally(() => window.setTimeout(onDone, 600));
      })}
    </div>
  );
}

/** Outcomes the backend reports back in the URL after a Google round trip. */
type SignInResult =
  | "admin_verified"
  | "admin_not_verified"
  | "admin_error"
  | "personal"
  | "invite_wrong_account"
  | "link_linked"
  | "link_already_linked";

function readSignInResult(): SignInResult | null {
  const params = new URLSearchParams(window.location.search);
  const adminProof = params.get("admin_proof");
  if (adminProof === "verified") return "admin_verified";
  if (adminProof === "not_verified") return "admin_not_verified";
  if (adminProof === "error") return "admin_error";
  if (params.get("signup") === "personal") return "personal";
  if (params.get("invite") === "wrong_account") return "invite_wrong_account";
  const link = params.get("link");
  if (link === "linked") return "link_linked";
  if (link === "already_linked") return "link_already_linked";
  return null;
}

/** Drops the result from the URL so a reload doesn't show it again. */
function clearSignInResultFromUrl() {
  const url = new URL(window.location.href);
  for (const key of ["admin_proof", "signup", "invite", "link"]) url.searchParams.delete(key);
  window.history.replaceState(null, "", url);
}

/** "Yes, my company uses Google Workspace" — sign in to the work account.
 *  The personal identity already proved is carried through and recorded
 *  against the same person; no personal org is created (user 2026-09-20). */
function linkOrganizationAccount() {
  if (!BACKEND_API_URL) return;
  // External origin (the backend), not a Next.js route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${BACKEND_API_URL}/onboarding/link-org-account`);
}

/** Sends the browser back to Google with the account chooser forced open. */
function signInWithAnotherAccount() {
  if (!BACKEND_API_URL) return;
  // External origin (the backend), not a Next.js route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${BACKEND_API_URL}/onboarding/signup?switch_account=true`);
}

/** What came back from Google. PLACEHOLDER copy (user asked for placeholders
 *  until they design these screens). */
function SignInResultPanel({
  result,
  onDone,
}: {
  result: SignInResult;
  /** Closes the sheet. */
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  /** "No, just me" was chosen: now name the workspace. */
  const [naming, setNaming] = useState(false);
  const [orgName, setOrgName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  async function createPersonalOrg() {
    setSubmitting(true);
    setError("");
    try {
      const res = await backendFetch("/onboarding/personal-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      if (!res.ok) {
        throw new Error(await backendError(res));
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // "done" — the signed-in screen isn't designed yet (user will describe it).
  if (done) return null;

  const heading = (text: string) => (
    <h2
      className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
    >
      {text}
    </h2>
  );
  const body = (text: string) => (
    <p
      className={`${sohne.className} mt-6 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
    >
      {text}
    </p>
  );
  const choices = (
    buttons: { label: string; onClick: () => void }[],
  ) => (
    <div className={`${satoshi.className} mt-8 flex flex-col gap-3`}>
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          disabled={submitting}
          className={SETUP_CHOICE_CLASS}
          onClick={b.onClick}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
  const errorLine = error ? (
    <p
      aria-live="polite"
      className={`${satoshi.className} m-0 mt-3 text-[0.75rem] leading-[1.2rem] text-[#EA4335]`}
    >
      {error}
    </p>
  ) : null;

  switch (result) {
    case "admin_verified":
      return (
        <div>
          {heading("You’re verified as a Google Workspace Super Admin")}
          {body("Google confirmed it. Your organization’s domain is now verified.")}
        </div>
      );
    case "admin_not_verified":
      // One action per screen (user): inviting the Super Admin happens later
      // in the app, not here.
      return (
        <div>
          {heading("Google didn’t confirm you as a Super Admin")}
          {body("You can keep using Knohow. You can invite your Super Admin later.")}
          {choices([{ label: "Skip for now", onClick: onDone }])}
        </div>
      );
    case "admin_error":
      return (
        <div>
          {heading("We couldn’t check with Google")}
          {body("Nothing changed. Try again in a moment.")}
          {choices([{ label: "Try again", onClick: startAdminProof }])}
        </div>
      );
    case "personal":
      // One action per screen: naming the workspace is its own step, reached
      // only after "No".
      if (naming)
        return (
          <div>
            {heading("What should we call your workspace?")}
            {body("This is the name you'll see when you sign in.")}
            <input
              ref={nameRef}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && orgName.trim()) void createPersonalOrg();
              }}
              placeholder="Workspace name"
              aria-label="Workspace name"
              className={`${satoshi.className} mt-8 h-12 w-full rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white px-4 text-[1rem] text-[#1c1917] outline-none placeholder:text-[#1c1917]/40`}
            />
            <div className={`${satoshi.className} mt-3 flex flex-col gap-3`}>
              <button
                type="button"
                disabled={submitting || !orgName.trim()}
                className={SETUP_CHOICE_CLASS}
                onClick={() => void createPersonalOrg()}
              >
                Continue
              </button>
            </div>
            {errorLine}
          </div>
        );
      return (
        <div>
          {heading("This is a personal Google account")}
          {body("Does your company use Google Workspace?")}
          {choices([
            {
              label: "Yes, link my work account",
              onClick: linkOrganizationAccount,
            },
            {
              label: "No, just me",
              onClick: () => setNaming(true),
            },
          ])}
          {errorLine}
        </div>
      );
    case "link_linked":
      return (
        <div>
          {heading("Your accounts are connected")}
          {body(
            "You can sign in with either one and land in the same place.",
          )}
          {choices([{ label: "Continue", onClick: onDone }])}
        </div>
      );
    case "link_already_linked":
      return (
        <div>
          {heading("That account belongs to someone else")}
          {body(
            "It is already connected to a different person, so we left it alone.",
          )}
          {choices([{ label: "Continue", onClick: onDone }])}
        </div>
      );
    case "invite_wrong_account":
      return (
        <div>
          {heading("That wasn’t the invited account")}
          {body("Sign in with the email address the invite was for.")}
          {choices([
            {
              label: "Use another account",
              onClick: signInWithAnotherAccount,
            },
          ])}
        </div>
      );
  }
}

/** Initial-circle tints. Google gives us no profile picture (`/auth/me`
 *  returns a name and an email only), so a row's avatar is the initial on a
 *  tint picked deterministically from the email — same person, same colour
 *  every visit. PLACEHOLDER palette. */
const AVATAR_TINTS = ["#2F6F4E", "#8E3B8E", "#2F6F8E", "#8E5A2F", "#4A3F8E"];

function avatarTint(email: string) {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) % 100003;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

/** Black chip beside the org name, saying which kind of account this row
 *  signs in with. The address itself lives in the tooltip, so the row stays
 *  two lines: the organization, then who you are in it. */
function AccountBadge({
  label,
  emails,
}: {
  label: string;
  /** One address for a row's own account; several for the Personal chip. */
  emails: string[];
}) {
  const count = emails.length;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`${label}: ${emails.join(", ")}`}
            className="inline-flex cursor-default items-center gap-1 rounded-full bg-[#1c1917] px-2 py-[0.15rem] text-[0.7rem] font-bold leading-[1.1rem] text-white"
          />
        }
      >
        {label}
        {count > 1 ? ` (${count})` : ""}
      </TooltipTrigger>
      {/* Portaled to <body>, so it inherits nothing from the picker: the
          font has to be named here or it falls back to the browser's sans. */}
      <TooltipContent side="bottom" sideOffset={6} className={satoshi.className}>
        {emails.map((email) => (
          <span key={email} className="block">
            {email}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

/** One selectable row on the remove-accounts screen — either a remembered
 *  org/personal member, or a linked personal address that has no row of its
 *  own on the picker (user 2026-09-21). */
/** One linked personal address, sitting under the organization row that
 *  surfaces it. */
type RemovableChild = {
  key: string;
  email: string;
  title: string;
  subtitle: string;
};

type RemovableAccount = {
  key: string;
  /** The remembered member id forgotten when this row is ticked. */
  memberId: string;
  title: string;
  subtitle: string;
  tintEmail: string;
  avatarLetter: string;
  children: RemovableChild[];
};

/** The remove screen's tree: one organization per row, with the person's
 *  linked personal addresses nested under it the way a folder holds files
 *  (user, 2026-09-21).
 *
 *  An address is listed under **every** org row that surfaces it, because
 *  that is how the picker shows it — as a chip on each of the person's rows.
 *  Hiding it is per address, not per row, so ticking it anywhere hides it
 *  everywhere on this browser. */
function removableAccounts(organizations: RememberedOrg[]): RemovableAccount[] {
  return organizations.map((org) => ({
    key: `member:${org.member_id}`,
    memberId: org.member_id,
    title: org.organization_name,
    subtitle: org.email,
    tintEmail: org.email,
    avatarLetter: org.organization_name.charAt(0).toUpperCase(),
    children: org.linked_personal_emails.map((email) => ({
      key: `member:${org.member_id}:personal:${email}`,
      email,
      title: email,
      subtitle: org.person_name ?? "Personal",
    })),
  }));
}

/** Second screen behind the picker's "Remove accounts" link: tick what to
 *  forget on this device. A file tree, not a flat list (user, 2026-09-21):
 *  each organization holds the person's linked personal addresses beneath it,
 *  ticking the organization ticks the whole branch, and a child can be
 *  unticked on its own to keep it.
 *
 *  The two ticks don't mean the same thing, which is why the branch matters.
 *  An organization is **forgotten** on this browser. A child address has no
 *  row to forget, so it is **hidden** here instead; the link itself survives.
 *  Singular or plural follows **how many are in the list**, not how many are
 *  ticked (user, 2026-09-20). PLACEHOLDER copy. */
function RemoveAccountsScreen({
  organizations,
  onBack,
  onRemoved,
}: {
  organizations: RememberedOrg[];
  /** What the picker has to drop: whole rows, and addresses now hidden. */
  onRemoved: (removed: { memberIds: string[]; emails: string[] }) => void;
  onBack: () => void;
}) {
  const accounts = removableAccounts(organizations);
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const rowCount = accounts.reduce((n, row) => n + 1 + row.children.length, 0);
  const many = rowCount > 1;

  const isSelected = (key: string) => selected.includes(key);

  /** Ticking an organization takes its addresses with it; unticking it
   *  releases them again. Either way the branch moves as one. */
  function toggleParent(row: RemovableAccount) {
    const keys = [row.key, ...row.children.map((c) => c.key)];
    setSelected((current) =>
      current.includes(row.key)
        ? current.filter((k) => !keys.includes(k))
        : [...current.filter((k) => !keys.includes(k)), ...keys],
    );
  }

  /** Unticking one address leaves the organization ticked: they are separate
   *  removals, so keeping an address doesn't rescue the row above it. */
  function toggleChild(key: string) {
    setSelected((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    );
  }

  function submit() {
    setRemoving(true);
    const memberIds = [
      ...new Set(
        accounts.filter((row) => isSelected(row.key)).map((row) => row.memberId),
      ),
    ];
    const emails = [
      ...new Set(
        accounts
          .flatMap((row) => row.children)
          .filter((child) => isSelected(child.key))
          .map((child) => child.email),
      ),
    ];
    void forgetRememberedAccounts(memberIds, emails).then(() =>
      onRemoved({ memberIds, emails }),
    );
  }

  const tick = (checked: boolean, onChange: () => void, label: string) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={removing}
      aria-label={label}
      className="size-4 shrink-0 accent-[#1c1917]"
    />
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-[#1c1917] transition-transform duration-150 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-5">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2
          className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
        >
          {many ? "Remove accounts" : "Remove account"}
        </h2>
      </div>
      <p
        className={`${sohne.className} mt-6 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
      >
        {many
          ? "Select the accounts you want to remove from this device."
          : "Select the account you want to remove from this device."}
      </p>
      <ul
        className={`${satoshi.className} m-0 mt-8 flex list-none flex-col gap-2 p-0`}
      >
        {accounts.map((row) => {
          const checked = isSelected(row.key);
          return (
            <li key={row.key}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[var(--login-button-radius)] border bg-white px-3 py-2 transition-colors",
                  checked ? "border-[#1c1917]" : "border-[#d9d9de]",
                )}
              >
                {tick(checked, () => toggleParent(row), `Remove ${row.title}`)}
                <span
                  aria-hidden
                  style={{ backgroundColor: avatarTint(row.tintEmail) }}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-[1rem] font-bold text-white"
                >
                  {row.avatarLetter}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[1rem] font-bold text-[#1c1917]">
                    {row.title}
                  </span>
                  <span className="block truncate text-[0.8rem] text-[#1c1917]/70">
                    {row.subtitle}
                  </span>
                </span>
              </label>

              {row.children.length > 0 ? (
                // Indented under the organization and joined to it by one
                // continuous trunk: the spacing lives in each child's padding
                // rather than a flex gap, so the line has nothing to jump.
                // Children are a fixed height so the trunk meets each row at
                // its middle (36px = 8px padding + half of the 56px row).
                <ul className="m-0 flex list-none flex-col p-0 pl-6">
                  {row.children.map((child, childIndex) => {
                    const childChecked = isSelected(child.key);
                    const isLast = childIndex === row.children.length - 1;
                    return (
                      <li key={child.key} className="relative pt-2">
                        {isLast ? (
                          // Last one turns the corner and stops.
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -left-3 top-0 h-9 w-3 rounded-bl-[6px] border-b border-l border-[#d9d9de]"
                          />
                        ) : (
                          // Trunk carries on to the next child, with a stub
                          // reaching out to this one.
                          <>
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -left-3 top-0 bottom-0 w-px bg-[#d9d9de]"
                            />
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -left-3 top-9 h-px w-3 bg-[#d9d9de]"
                            />
                          </>
                        )}
                        <label
                          className={cn(
                            "flex h-14 cursor-pointer items-center gap-3 rounded-[var(--login-button-radius)] border bg-white px-3 transition-colors",
                            childChecked
                              ? "border-[#1c1917]"
                              : "border-[#d9d9de]",
                          )}
                        >
                          {tick(
                            childChecked,
                            () => toggleChild(child.key),
                            `Remove ${child.title}`,
                          )}
                          <span
                            aria-hidden
                            style={{ backgroundColor: avatarTint(child.email) }}
                            className="flex size-7 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-bold text-white"
                          >
                            {child.email.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[0.9rem] font-bold text-[#1c1917]">
                              {child.title}
                            </span>
                            <span className="block truncate text-[0.75rem] text-[#1c1917]/70">
                              {child.subtitle}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={removing || selected.length === 0}
        onClick={submit}
        className={`${satoshi.className} relative mt-8 flex h-12 w-full cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white text-[1rem] font-bold text-[#1c1917] transition-transform duration-150 active:scale-[0.98] disabled:cursor-default disabled:opacity-60`}
      >
        {many ? "Remove selected accounts" : "Remove selected account"}
      </button>
    </>
  );
}

/** "Which account today?" — one row per organization this browser has signed
 *  in to. The org's name leads; the person's name is the subtext under it.
 *  PLACEHOLDER copy. */
function AccountPicker({
  organizations,
  onRemoved,
}: {
  organizations: RememberedOrg[];
  /** Rows were forgotten, or addresses hidden; the caller drops both from the
   *  list, and shows the plain Log In screen once no rows are left. */
  onRemoved: (removed: { memberIds: string[]; emails: string[] }) => void;
}) {
  /** The "Remove accounts" link opens a second screen in this modal rather
   *  than forgetting everything on the spot (user 2026-09-20). */
  const [removing, setRemoving] = useState(false);

  if (removing)
    return (
      <RemoveAccountsScreen
        organizations={organizations}
        onBack={() => setRemoving(false)}
        onRemoved={(removed) => {
          setRemoving(false);
          onRemoved(removed);
        }}
      />
    );

  return (
    // Scoped to the picker rather than the app root: it's the only surface
    // with tooltips, and the root layout is a Server Component — no reason
    // to push a client boundary up there for one screen.
    <TooltipProvider delay={0}>
      <h2
        className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
      >
        Which account today?
      </h2>
      <p
        className={`${sohne.className} mt-6 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
      >
        Pick up where you left off or continue as another user.
      </p>
      <ul className={`${satoshi.className} m-0 mt-8 flex list-none flex-col gap-0.5 p-0`}>
        {organizations.map((row) => (
          <li
            key={row.member_id}
            className="flex items-center gap-3 rounded-[var(--login-button-radius)] px-2 py-1"
          >
            <button
              type="button"
              // Signing in to this organization: its account is the hint, and
              // Google can still override it.
              onClick={() => continueWithGoogle(null, row.email)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left transition-transform duration-150 active:scale-[0.98]"
            >
              <span
                aria-hidden
                style={{ backgroundColor: avatarTint(row.email) }}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-[1rem] font-bold text-white"
              >
                {row.organization_name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[1rem] font-bold text-[#1c1917]">
                  {row.organization_name}
                </span>
                {row.person_name ? (
                  <span className="block truncate text-[0.8rem] text-[#1c1917]/70">
                    {row.person_name}
                  </span>
                ) : null}
              </span>
            </button>
            <span className="flex shrink-0 items-center gap-1.5">
              <AccountBadge
                label={row.kind === "org" ? "Org" : "Personal"}
                emails={[row.email]}
              />
              {/* Linked addresses with no org of their own. Only on rows that
                  aren't themselves personal, or the row would read "Personal"
                  twice. */}
              {row.kind === "org" && row.linked_personal_emails.length > 0 ? (
                <AccountBadge
                  label="Personal"
                  emails={row.linked_personal_emails}
                />
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {/* Half width, centred (user 2026-09-20) — a full-width rule made the
          modal read as two stacked panels. */}
      <div className={`${satoshi.className} mx-auto mt-3 flex w-1/2 items-center gap-3`}>
        <span className="h-px flex-1 bg-[#d9d9de]" />
        <span className="text-[0.75rem] text-[#1c1917]/70">OR</span>
        <span className="h-px flex-1 bg-[#d9d9de]" />
      </div>
      <button
        type="button"
        onClick={() => continueWithGoogle(readInviteToken())}
        className={`${satoshi.className} relative mt-6 flex h-12 w-full cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white text-[1rem] font-bold text-[#1c1917] transition-transform duration-150 active:scale-[0.98] disabled:cursor-default disabled:opacity-60`}
      >
        <GoogleG className="absolute left-[13px] size-5" />
        Continue with another account
      </button>
      <p
        className={`${satoshi.className} mt-6 text-[0.8rem] leading-[1.6] text-[#1c1917]`}
      >
        By continuing, you agree to Knohow&rsquo;s{" "}
        <span className="font-bold">
          <FooterStubLink href="/terms">Terms of Use</FooterStubLink>
        </span>
        . Read our{" "}
        <span className="font-bold">
          <FooterStubLink href="/privacy">Privacy Policy</FooterStubLink>
        </span>
        .
      </p>
      <button
        type="button"
        onClick={() => setRemoving(true)}
        className={`${satoshi.className} mt-4 inline-flex cursor-pointer items-center gap-[4px] border-b border-current leading-none text-[0.8rem] font-bold text-[#1c1917]`}
      >
        <UserRoundX className="size-[1em] shrink-0" aria-hidden />
        {removableAccounts(organizations).length > 1
          ? "Remove accounts"
          : "Remove account"}
      </button>
    </TooltipProvider>
  );
}

/** The sign-in sheet's slide, matching `duration-992` on the panel itself. */
const SHEET_SLIDE_MS = 992;

/** Book a Demo's reservation window, from first open (`DEMO_RESERVED_MS`). */
const DEMO_RESERVED_MS = 5 * 60 * 1000;

function formatCountdown(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/** "4:38 reserved" — counts down from 5:00; when it runs out it reads "Hold
 *  Expired". Plain text at the Close button's label size (no pill), top-left
 *  of the sheet. */
function ReservedCountdown({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, DEMO_RESERVED_MS - (now - startedAt));
  const done = left === 0;

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [done]);

  const secs = Math.ceil(left / 1000);
  const label = formatCountdown(secs);

  // Only digits that changed remount (key = position + char), so only they
  // replay the pop-in. The previous label is always one second earlier;
  // changed digits stagger left → right (max stagger 2).
  const prevLabel = formatCountdown(secs + 1);
  let rank = 0;
  const digits = [...label].map((ch, i) => {
    const changed = prevLabel[i] !== ch;
    return { ch, i, stagger: changed ? Math.min(rank++, 2) : 0 };
  });

  const className = "text-[1.13569rem] font-bold text-white tabular-nums";
  if (done)
    return (
      <div role="timer" className={className}>
        Hold Expired
      </div>
    );

  return (
    <div
      role="timer"
      aria-label={`Reserved for ${label}`}
      className={className}
    >
      <span className="t-digit-group is-animating" aria-hidden>
        {digits.map(({ ch, i, stagger }) => (
          <span
            key={`${i}-${ch}`}
            className="t-digit"
            data-stagger={stagger || undefined}
          >
            {ch}
          </span>
        ))}
      </span>
      &nbsp;reserved
    </div>
  );
}

/** Log In panel's centred modal. Closed it's a thin line (border only); once
 *  `open` it grows to its content. Height can't transition to/from `auto`, so
 *  the body is measured and the shell gets an explicit px height for
 *  `.t-resize` to tween. The content is always laid out, so the growing edge
 *  reveals it. */
function LoginModal({
  open,
  children,
}: {
  open: boolean;
  children?: React.ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<{ border: number; full: number }>();
  const lastFull = useRef(0);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const body = bodyRef.current;
    if (!shell || !body) return;
    const measure = () => {
      const border = shell.offsetHeight - shell.clientHeight;
      const full = body.offsetHeight + border;
      // Skip the re-render when the height hasn't meaningfully changed.
      // Cal.com's embed iframe resizes internally on every interaction (date
      // pick, time select, form field focus) which fires this observer.  Each
      // setHeights call triggers a React re-render and the .t-resize CSS
      // transition tweens the modal height — the visible "blink".  A 1px
      // threshold absorbs sub-pixel jitter without hiding real content swaps.
      if (Math.abs(full - lastFull.current) < 2) return;
      lastFull.current = full;
      setHeights({ border, full });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className="t-login-modal t-resize pointer-events-auto"
      style={{ height: heights && (open ? heights.full : heights.border) }}
    >
      <div ref={bodyRef} className="t-login-modal-body">
        {children}
      </div>
    </div>
  );
}

function LoginSky({ active }: { active: boolean }) {
  return (
    <div
      className="t-login-sky pointer-events-none absolute inset-0 overflow-hidden"
      data-active={active ? "true" : "false"}
      aria-hidden
    >
      {LOGIN_STARS.map((star, i) => (
        <span
          key={i}
          className="t-login-star"
          style={
            {
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              "--star-peak": star.peak,
              animationDuration: `${star.dur}s`,
              animationDelay: `${star.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
      {LOGIN_SHOOTING_STARS.map((star, i) => (
        <span
          key={i}
          className="t-login-shooting-star"
          style={
            {
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.len,
              animationDuration: `${star.loop}s`,
              animationDelay: `${star.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

const FOOTER_LINK_CLASS =
  "cursor-pointer underline underline-offset-2 transition-transform duration-150 active:scale-95";

/** Footer destinations. With `href` it's a real route (`next/link`); without,
 *  a button stub until the route exists (avoids App Router soft-nav on
 *  `<a href="#…">` during Fast Refresh). */
function FooterStubLink({
  href,
  children,
}: {
  href?: string;
  children: React.ReactNode;
}) {
  if (href)
    return (
      <Link href={href} className={`inline-block ${FOOTER_LINK_CLASS}`}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={FOOTER_LINK_CLASS}>
      {children}
    </button>
  );
}

/** Desktop header buttons that appear only after Get Started divides. */
const DESKTOP_HEADER_EXTRAS: readonly CtaExtra[] = [
  { key: "login", label: "Log In" },
  { key: "demo", label: "Book a Demo" },
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
  const [ctaPhase, setCtaPhase] = useState<CtaPhase>("idle");
  const [nextOpen, setNextOpen] = useState(false);
  /** The slide-up sheet (Log In / Book a Demo) is open. */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Which modal the sheet shows — kept after Close so it slides down intact. */
  const [sheetKind, setSheetKind] = useState<
    "login" | "demo" | "setup" | "result"
  >("login");
  /** What came back from a Google round trip, shown in the sheet. */
  const [signInResult, setSignInResult] = useState<SignInResult | null>(null);
  /** Who's signed in (backend `/auth/me`), once known. */
  const [me, setMe] = useState<Me | null>(null);
  /** Accounts this browser has used before. Fetched on mount, not on open,
   *  so the modal sizes once (the Cal embed taught us that — see
   *  FEAT-landing-book-a-demo). */
  const [rememberedOrgs, setRememberedOrgs] = useState<RememberedOrg[]>([]);
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

  // Back from Google sign-in: if this person still has to set up their new
  // organization, reopen the sheet on the setup questions.
  useEffect(() => {
    let cancelled = false;
    void fetchRememberedOrgs().then((orgs) => {
      if (!cancelled) setRememberedOrgs(orgs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((result) => {
      if (cancelled) return;
      if (result) setMe(result);
      const returned = readSignInResult();
      if (returned) clearSignInResultFromUrl();
      // `needs_org_setup` only covers the first questions — it goes false as
      // soon as an org chart row exists, part-way through setup. `setup_step`
      // covers the rest, so an unfinished setup reopens where it stopped
      // instead of dropping them on the landing page (user, 2026-09-21).
      if (result?.needs_org_setup || result?.setup_step) {
        setSheetKind("setup");
        setSheetOpen(true);
      } else if (returned) {
        setSignInResult(returned);
        setSheetKind("result");
        setSheetOpen(true);
      } else if (readInviteToken()) {
        // Arrived from an invite link: open Log In so they can sign in as
        // the invited account.
        setSheetKind("login");
        setSheetOpen(true);
      }
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

      {/* The Slide-Up Sheet (Log In / Book a Demo) */}
      <div
        ref={demoSheetRef}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[400] h-dvh w-full overflow-hidden overscroll-none bg-white bg-[url(/hero/signinbg.png)] bg-cover bg-center transition-[translate,border-radius] duration-992 ease-[var(--resize-ease)] flex flex-col",
          sheetOpen ? "translate-y-0" : "translate-y-full",
          sheetAtTop ? "rounded-none" : "rounded-[var(--deck-window-radius)]"
        )}
        // Slides at 992ms (the recess + veil stay 900ms). Only the panel's own
        // slide counts — the Close button's press transition bubbles here too.
        onTransitionEnd={(e) => {
          if (
            sheetOpen &&
            e.target === e.currentTarget &&
            e.propertyName === "translate"
          )
            setSheetAtTop(true);
        }}
      >
        <LoginSky active={sheetOpen} />
        <div
          className={`${satoshi.className} relative z-10 flex items-center justify-between gap-2 p-6`}
        >
          {sheetKind === "demo" && demoReservedAt != null ? (
            <ReservedCountdown startedAt={demoReservedAt} />
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSheetAtTop(false);
              setSheetOpen(false);
            }}
            className={cn(CTA_CLASS, "ml-auto")}
          >
            Close
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-6 left-6 z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/edmonton.png"
            alt="Proudly from Edmonton"
            className="h-8 w-auto md:h-10"
          />
        </div>
        {/* Centred modal — Log In or Book a Demo content. */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <LoginModal open={sheetAtTop}>
            {sheetKind === "login" && rememberedOrgs.length > 0 ? (
              <AccountPicker
                organizations={rememberedOrgs}
                onRemoved={({ memberIds, emails }) =>
                  setRememberedOrgs((rows) =>
                    rows
                      .filter((row) => !memberIds.includes(row.member_id))
                      // A hidden address stays linked; it just stops being
                      // shown on this browser, so drop it from the chips too.
                      .map((row) =>
                        emails.length === 0
                          ? row
                          : {
                              ...row,
                              linked_personal_emails:
                                row.linked_personal_emails.filter(
                                  (email) => !emails.includes(email),
                                ),
                            },
                      ),
                  )
                }
              />
            ) : sheetKind === "login" ? (
              <>
                <h2
                  className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
                >
                  Log in or sign up in seconds
                </h2>
                <p
                  className={`${sohne.className} mt-6 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
                >
                  Use your Google account to continue with Knohow.
                </p>
                <button
                  type="button"
                  onClick={() => continueWithGoogle(readInviteToken())}
                  className={`${satoshi.className} relative mt-8 flex h-12 w-full cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white text-[1rem] font-bold text-[#1c1917] transition-transform duration-150 active:scale-[0.98]`}
                >
                  <GoogleG className="absolute left-[13px] size-5" />
                  Continue with Google
                </button>
                <p
                  className={`${satoshi.className} mt-6 text-[0.8rem] leading-[1.6] text-[#1c1917]`}
                >
                  By continuing, you agree to Knohow&rsquo;s{" "}
                  <span className="font-bold">
                    <FooterStubLink href="/terms">Terms of Use</FooterStubLink>
                  </span>
                  . Read our{" "}
                  <span className="font-bold">
                    <FooterStubLink href="/privacy">Privacy Policy</FooterStubLink>
                  </span>
                  .
                </p>
              </>
            ) : sheetKind === "setup" && me ? (
              <OrgSetupForm
                me={me}
                onDone={() => {
                  setSheetAtTop(false);
                  setSheetOpen(false);
                }}
              />
            ) : sheetKind === "result" && signInResult ? (
              <SignInResultPanel
                result={signInResult}
                onDone={() => {
                  setSheetAtTop(false);
                  setSheetOpen(false);
                }}
              />
            ) : (
              <DemoForm key={demoFormKey} initial={demoInitial} />
            )}
          </LoginModal>
        </div>
      </div>
    </div>
  );
}

export { LandingHero };
