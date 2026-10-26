"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import {
  Check,
  FolderInput,
  KeyRound,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { satoshi } from "@/components/brand/fonts";
import { Folder } from "@/components/app/folder";
import { PersonAvatar } from "@/components/identity/person-avatar";
import { TeamIcon } from "@/components/identity/team-icon";
import { SetupAction, SetupBody, SetupHeading } from "@/components/setup/shell";
import { playPop, playTick } from "@/components/survey/sounds";
import { Spinner } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** The survey's 20-second look at Knohow, before the questions: four small
 *  scenes, one per thing it does, played like stories (a bar per scene, each
 *  advancing on its own; tap a bar to jump, tap the stage to replay). Built
 *  from the app's own pieces: the folder, team icons, people's orbs. The
 *  organization, people and files are made up for the demo. */

/** `--resize-ease`, the card's own resize curve. */
const EASE = [0.22, 1, 0.36, 1] as const;

const STAGE_H = 248;

type FileKind = "docs" | "sheets" | "slides" | "pdf";

function FileGlyph({ kind, size = 14 }: { kind: FileKind; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/create/${kind}.png`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

/** Steps a scene through its beats: `beat` is how many of `times` (ms after
 *  mount) have passed. Reduced motion lands on the last beat at once. */
function useBeats(times: readonly number[]) {
  const reduce = useReducedMotion();
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const ids = times.map((t, i) => window.setTimeout(() => setBeat(i + 1), t));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [reduce, times]);
  return reduce ? times.length : beat;
}

/** A sound on every beat after the first render. */
function useBeatSound(beat: number, sound: () => void = playPop) {
  useEffect(() => {
    if (beat > 0) sound();
  }, [beat, sound]);
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const PANEL_CLASS =
  "rounded-[12px] border border-[var(--app-border)] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.05)]";

/* ——— Sort ——— */

const SORT_TEAMS = [
  { name: "Finance", color: "#4cc38a" },
  { name: "Events", color: "#ff9f43" },
  { name: "Outreach", color: "#50b1fd" },
] as const;

/** `slot` is where the file starts in the loose pile (0–2 top row, 3–5
 *  bottom), picked so files cross on their way down. */
const SORT_FILES: { name: string; kind: FileKind; team: number; slot: number }[] = [
  { name: "Donation receipts", kind: "pdf", team: 0, slot: 1 },
  { name: "Volunteer schedule", kind: "sheets", team: 1, slot: 5 },
  { name: "October newsletter", kind: "docs", team: 2, slot: 0 },
  { name: "Gala budget", kind: "sheets", team: 0, slot: 4 },
  { name: "Gala run of show", kind: "docs", team: 1, slot: 2 },
  { name: "Social posts", kind: "slides", team: 2, slot: 3 },
];

const SORT_BEATS = [700, 1250, 1800, 2350, 2900, 3450];
/** When each file lands: its flight is 600ms; the papers rise just before. */
const SORT_LANDS = SORT_BEATS.map((t) => t + 450);

const colCenter = (col: number) => ((col * 2 + 1) / 6) * 100;

function MiniFolder({
  scale,
  name,
  color,
  fileNames,
}: {
  scale: number;
  name: string;
  color: string;
  fileNames: string[];
}) {
  return (
    <div className="relative" style={{ width: 321 * scale, height: 270 * scale }}>
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: 321, height: 270, transform: `scale(${scale})` }}
      >
        <Folder decorative size="md" label={name} color={color} fileNames={fileNames} />
      </div>
    </div>
  );
}

function SortScene() {
  const [stageRef, width] = useWidth<HTMLDivElement>();
  const sent = useBeats(SORT_BEATS);
  const landed = useBeats(SORT_LANDS);
  useBeatSound(landed);

  const scale = Math.min(0.4, Math.max(0.22, (width / 3 - 18) / 321));
  const folderH = 270 * scale;
  const labelH = 26;
  const landTop = STAGE_H - labelH - folderH * 0.72;

  return (
    <div ref={stageRef} className="absolute inset-0">
      {SORT_FILES.map((file, i) => {
        const filed = i < sent;
        return (
          <motion.div
            key={file.name}
            className={cn(
              PANEL_CLASS,
              "absolute flex h-8 max-w-[31%] items-center gap-1.5 rounded-[8px] px-2 text-[0.74rem] font-bold whitespace-nowrap text-[#1c1917]",
            )}
            style={{ x: "-50%" }}
            initial={false}
            animate={
              filed
                ? { left: `${colCenter(file.team)}%`, top: landTop, scale: 0.55, opacity: 0 }
                : {
                    left: `${colCenter(file.slot % 3)}%`,
                    top: 12 + Math.floor(file.slot / 3) * 42,
                    scale: 1,
                    opacity: 1,
                  }
            }
            transition={{
              default: { duration: 0.6, ease: EASE },
              opacity: { duration: 0.2, delay: filed ? 0.42 : 0 },
            }}
          >
            <FileGlyph kind={file.kind} />
            <span className="min-w-0 truncate">{file.name}</span>
          </motion.div>
        );
      })}

      <div className="absolute inset-x-0 bottom-0 grid grid-cols-3">
        {SORT_TEAMS.map((team, t) => {
          const inside = SORT_FILES.filter((f, i) => f.team === t && i < landed);
          return (
            <div key={team.name} className="flex flex-col items-center">
              <MiniFolder
                scale={scale}
                name={`${team.name} folder`}
                color={team.color}
                fileNames={inside.map((f) => f.name).reverse()}
              />
              <div
                className="flex items-center gap-1.5 text-[0.78rem] font-bold text-[#1c1917]"
                style={{ height: labelH }}
              >
                <TeamIcon name={team.name} size={16} />
                {team.name}
                <AnimatePresence mode="popLayout" initial={false}>
                  {inside.length ? (
                    <motion.span
                      key={inside.length}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1c1917] px-1 text-[0.62rem] text-white tabular-nums"
                    >
                      {inside.length}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ——— Share ——— */

const SHARE_PEOPLE = [
  { name: "Ada", email: "ada@helpinghands.org" },
  { name: "Kofi", email: "kofi@helpinghands.org" },
  { name: "Zara", email: "zara@helpinghands.org" },
  { name: "Malik", email: "malik@helpinghands.org" },
  { name: "Nia", email: "nia@helpinghands.org" },
];

const SHARE_BEATS = [600, 1250, 1500, 1750, 2000, 2250, 2900];

function StatusLine({ shown, children }: { shown: boolean; children: React.ReactNode }) {
  return (
    <motion.p
      initial={false}
      animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 4 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="m-0 flex items-center justify-center gap-1.5 text-[0.8rem] font-bold text-[var(--app-play)]"
    >
      <Check aria-hidden className="size-4" strokeWidth={3} />
      {children}
    </motion.p>
  );
}

function ShareScene() {
  const beat = useBeats(SHARE_BEATS);
  useBeatSound(beat);
  const ruleOn = beat >= 1;
  const added = Math.max(0, Math.min(SHARE_PEOPLE.length, beat - 1));

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
      <motion.div
        initial={false}
        animate={{ opacity: ruleOn ? 1 : 0.45 }}
        className={cn(
          PANEL_CLASS,
          "flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-[0.76rem] font-bold text-[#1c1917] transition-[border-color] duration-300",
          ruleOn && "border-[#1c1917]",
        )}
      >
        <span className="rounded-full bg-[var(--app-muted)] px-2 py-0.5 text-[0.66rem] text-[var(--app-dim)]">
          Rule
        </span>
        Events folder
        <span aria-hidden className="text-[var(--app-dim)]">
          →
        </span>
        <TeamIcon name="Events" size={18} />
        Events team
      </motion.div>

      <div className={cn(PANEL_CLASS, "flex w-full max-w-[22rem] items-center gap-3 px-3.5 py-3")}>
        <FileGlyph kind="docs" size={26} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[0.88rem] font-bold text-[#1c1917]">Gala run of show</p>
          <p className="m-0 text-[0.72rem] text-[var(--app-dim)]">In the Events folder</p>
        </div>
        <span className="text-[0.72rem] font-bold text-[var(--app-dim)] tabular-nums">
          {added ? `Shared with ${added}` : "Not shared"}
        </span>
      </div>

      <div className="flex items-start gap-3">
        {SHARE_PEOPLE.map((person, i) => (
          <motion.div
            key={person.email}
            initial={false}
            animate={i < added ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
            transition={{ type: "spring", stiffness: 420, damping: 20 }}
            className="flex w-11 flex-col items-center gap-1"
          >
            <PersonAvatar identity={person.email} label={person.name} size={34} />
            <span className="text-[0.68rem] font-bold text-[#1c1917]">{person.name}</span>
          </motion.div>
        ))}
      </div>

      <StatusLine shown={beat >= SHARE_BEATS.length}>Everyone on Events has it</StatusLine>
    </div>
  );
}

/* ——— Ownership ——— */

const OWN_ROWS: { name: string; kind: FileKind }[] = [
  { name: "Grant application", kind: "docs" },
  { name: "Donor list", kind: "sheets" },
  { name: "Board minutes", kind: "docs" },
];

const OWN_BEATS = [900, 1600, 2300, 3000];

function Owner({ moved }: { moved: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={moved ? "org" : "personal"}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: EASE }}
        className="flex min-w-0 items-center gap-2"
      >
        <PersonAvatar
          identity={moved ? "treasurer@helpinghands.org" : "jordan.m@gmail.com"}
          size={22}
        />
        <span className="min-w-0 truncate text-[0.78rem] font-bold text-[#1c1917]">
          {moved ? "Treasurer" : "jordan.m@gmail.com"}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[0.64rem] font-bold",
            moved ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef3c7] text-[#92400e]",
          )}
        >
          {moved ? "Admin" : "Personal"}
        </span>
      </motion.span>
    </AnimatePresence>
  );
}

function OwnScene() {
  const beat = useBeats(OWN_BEATS);
  useBeatSound(beat);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
      <div className={cn(PANEL_CLASS, "w-full max-w-[26rem] overflow-hidden")}>
        <div className="grid grid-cols-[1fr_1.35fr] gap-3 px-3.5 py-2 text-[0.68rem] font-bold text-[var(--app-dim)]">
          <span>File</span>
          <span>Owner</span>
        </div>
        {OWN_ROWS.map((row, i) => (
          <div
            key={row.name}
            className="grid h-12 grid-cols-[1fr_1.35fr] items-center gap-3 border-t border-[var(--app-border)] px-3.5"
          >
            <span className="flex min-w-0 items-center gap-2 text-[0.8rem] font-bold text-[#1c1917]">
              <FileGlyph kind={row.kind} size={16} />
              <span className="truncate">{row.name}</span>
            </span>
            <Owner moved={i < beat} />
          </div>
        ))}
      </div>
      <StatusLine shown={beat >= OWN_BEATS.length}>The right people are in charge</StatusLine>
    </div>
  );
}

/* ——— Offboard ——— */

const OFF_BEATS = [1000, 1700, 2400, 3100, 3700];
const OFF_FILES = 23;

const OFF_STEPS = [
  `${OFF_FILES} files moved to the Events team`,
  "Amara's access removed",
  "Ownership handed to the Events lead",
];

function FileCount({ zero }: { zero: boolean }) {
  const reduce = useReducedMotion();
  const count = useMotionValue(OFF_FILES);
  const shown = useTransform(count, (n) => Math.round(n));
  useEffect(() => {
    const target = zero ? 0 : OFF_FILES;
    if (reduce) {
      count.set(target);
      return;
    }
    const controls = animate(count, target, { duration: 0.7, ease: "easeOut" });
    return () => controls.stop();
  }, [zero, reduce, count]);
  return <motion.span className="tabular-nums">{shown}</motion.span>;
}

function OffboardScene() {
  const beat = useBeats(OFF_BEATS);
  useBeatSound(beat, beat === 1 ? playTick : playPop);
  const pressed = beat >= 1;
  const done = beat >= OFF_BEATS.length;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 sm:flex-row sm:gap-6">
      <motion.div
        initial={false}
        animate={{ opacity: done ? 0.6 : 1 }}
        className={cn(PANEL_CLASS, "w-full max-w-[15rem] p-3.5")}
      >
        <div className="flex items-center gap-3">
          <PersonAvatar identity="amara.k@gmail.com" label="Amara K." size={40} />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[0.88rem] font-bold text-[#1c1917]">Amara K.</p>
            <p className="m-0 text-[0.72rem] text-[var(--app-dim)]">
              {done ? "Offboarded" : "Volunteer, leaving"}
            </p>
          </div>
          <span className="text-right text-[0.72rem] leading-tight font-bold text-[#1c1917]">
            <FileCount zero={beat >= 2} />
            <br />
            <span className="font-medium text-[var(--app-dim)]">files</span>
          </span>
        </div>
        <motion.div
          aria-hidden
          initial={false}
          animate={pressed ? { scale: [1, 0.94, 1] } : { scale: 1 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "mt-3 flex h-9 items-center justify-center gap-2 rounded-full text-[0.85rem] font-bold text-white transition-colors duration-300",
            done ? "bg-[var(--app-play)]" : "bg-black/80",
          )}
        >
          {done ? (
            <>
              <Check className="size-4" strokeWidth={3} /> Done
            </>
          ) : pressed ? (
            <>
              <Spinner size={14} /> Offboarding
            </>
          ) : (
            "Offboard"
          )}
        </motion.div>
      </motion.div>

      <ul className="m-0 flex w-full max-w-[16rem] list-none flex-col gap-2.5 p-0">
        {OFF_STEPS.map((step, i) => {
          const state = beat >= i + 2 ? "done" : beat === i + 1 ? "working" : "waiting";
          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-2.5 text-[0.8rem] font-bold transition-colors duration-300",
                state === "waiting" ? "text-[#1c1917]/35" : "text-[#1c1917]",
              )}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                {state === "done" ? (
                  <motion.span
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="flex size-5 items-center justify-center rounded-full bg-[var(--app-play)] text-white"
                  >
                    <Check className="size-3" strokeWidth={3.5} />
                  </motion.span>
                ) : state === "working" ? (
                  <Spinner size={18} />
                ) : (
                  <span className="size-4 rounded-full border-2 border-current" />
                )}
              </span>
              {step}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ——— The tour ——— */

/** What Knohow does, in the team's words (survey brief, 2026-10-25). The
 *  Would-you-use-it question lists these again. */
export const TOUR_SCENES: {
  id: string;
  tab: string;
  title: string;
  body: string;
  icon: LucideIcon;
  ms: number;
  Scene: () => React.ReactNode;
}[] = [
  {
    id: "sort",
    tab: "Sort",
    title: "Sorts your documents into team folders automatically",
    body: "Saving you time from manually sorting files into the right folders.",
    icon: FolderInput,
    ms: 5200,
    Scene: SortScene,
  },
  {
    id: "share",
    tab: "Share",
    title: "Shares your documents within the proper teams",
    body: "No more links lost in someone's email.",
    icon: Users,
    ms: 4400,
    Scene: ShareScene,
  },
  {
    id: "own",
    tab: "Ownership",
    title: "Transfers ownership of files to the proper administrators",
    body: "Document ownership and responsibility stay clear, with the right people in charge.",
    icon: KeyRound,
    ms: 4600,
    Scene: OwnScene,
  },
  {
    id: "offboard",
    tab: "Offboard",
    title: "Simplifies offboarding with one button",
    body: "Saves you the headache and back and forth when people leave.",
    icon: UserMinus,
    ms: 5000,
    Scene: OffboardScene,
  },
];

export function SurveyTour({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  /** Bumped to replay the current scene from the top. */
  const [run, setRun] = useState(0);
  const scene = TOUR_SCENES[index];
  const last = index === TOUR_SCENES.length - 1;

  useEffect(() => {
    if (reduce || last) return;
    const id = window.setTimeout(() => setIndex((i) => i + 1), scene.ms);
    return () => window.clearTimeout(id);
  }, [index, run, reduce, last, scene.ms]);

  const jump = (to: number) => {
    playTick();
    setIndex(to);
    setRun((r) => r + 1);
  };

  return (
    <div className="t-survey-wide">
      <SetupHeading onBack={null}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={scene.id}
            className="block"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {scene.title}
          </motion.span>
        </AnimatePresence>
      </SetupHeading>
      <SetupBody>{scene.body}</SetupBody>

      {/* A click replays the scene; the tabs below are the keyboard's way in. */}
      <div
        onClick={() => jump(index)}
        className={`${satoshi.className} group relative mx-[2.5%] mt-5 cursor-pointer overflow-hidden rounded-[var(--login-button-radius)] border border-[var(--app-border)] bg-[var(--app-ground)]`}
        style={{ height: STAGE_H }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${scene.id}-${run}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <scene.Scene />
          </motion.div>
        </AnimatePresence>
        <span className="pointer-events-none absolute top-2 right-2.5 text-[0.66rem] font-bold text-[var(--app-dim)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Replay
        </span>
      </div>

      <div
        className={`${satoshi.className} mx-[2.5%] mt-3 grid grid-cols-4 gap-2`}
        role="tablist"
        aria-label="What Knohow does"
      >
        {TOUR_SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => jump(i)}
            className="flex cursor-pointer flex-col gap-1.5 pt-1 text-left"
          >
            <span className="relative block h-[3px] overflow-hidden rounded-full bg-[#1c1917]/12">
              {i < index || (i === index && reduce) ? (
                <span className="absolute inset-0 bg-[#1c1917]" />
              ) : i === index ? (
                <motion.span
                  key={`${s.id}-${run}`}
                  className="absolute inset-0 origin-left bg-[#1c1917]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: s.ms / 1000, ease: "linear" }}
                />
              ) : null}
            </span>
            <span
              className={cn(
                "text-[0.72rem] font-bold transition-colors",
                i === index ? "text-[#1c1917]" : "text-[#1c1917]/40",
              )}
            >
              {s.tab}
            </span>
          </button>
        ))}
      </div>

      <SetupAction
        label="Start the survey"
        onClick={() => {
          playTick();
          onDone();
        }}
      />
    </div>
  );
}
