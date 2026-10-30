"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";

import { satoshi } from "@/components/brand/fonts";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { sohne } from "@/components/brand/logo-mark";
import { SignInSheet } from "@/components/login/sign-in-sheet";
import {
  SETUP_CHOICE_CLASS,
  SetupAction,
  SetupBody,
  SetupChoices,
  SetupError,
  SetupField,
  SetupHeading,
  clearSetupFieldError,
  shakeSetupField,
} from "@/components/setup/shell";
import { ResultMark } from "@/components/setup/sign-in-result";
import {
  playChime,
  playDetent,
  playTick,
  setMuted,
  useSoundOn,
} from "@/components/survey/sounds";
import { SurveyTour, TOUR_SCENES } from "@/components/survey/survey-tour";
import { ChoicePill } from "@/components/ui/choice-pill";
import { Spinner } from "@/components/ui/icons";
import { CTA_CLASS } from "@/components/ui/tokens";
import { submitSurvey } from "@/app/survey/actions";
import { emailError } from "@/lib/email";
import { siteUrl } from "@/lib/origins";
import type { SurveyField, SurveyResponse } from "@/lib/survey";
import { cn } from "@/lib/utils";

/** The customer survey ([[FEAT-customer-survey]]): the sign-in sky and card,
 *  a short tour of Knohow, who's answering, then the team's eleven questions
 *  one per card, worded as the team wrote them (Tolu, 2026-10-30). A
 *  single-choice answer moves on by itself, except "Other (please specify)",
 *  which asks what; the long answers can be skipped. Progress is kept in this
 *  browser, so a refresh or a second visit picks up where it stopped. */

type StepId =
  | "intro"
  | "tour"
  | "about"
  | "position"
  | "role"
  | "suite"
  | "links"
  | "sorting"
  | "leaving"
  | "use"
  | "price"
  | "price_amount"
  | "why"
  | "tools"
  | "wand"
  | "done";

const STEPS: readonly StepId[] = [
  "intro",
  "tour",
  "about",
  "position",
  "role",
  "suite",
  "links",
  "sorting",
  "leaving",
  "use",
  "price",
  "price_amount",
  "why",
  "tools",
  "wand",
  "done",
];

/** The team's numbering: a yes to "would you use it" skips 9 ("If no, why"),
 *  and the slider after a no to $1,800 is still 8. */
const QUESTION_NUMBER: Partial<Record<StepId, number>> = {
  position: 1,
  role: 2,
  suite: 3,
  links: 4,
  sorting: 5,
  leaving: 6,
  use: 7,
  price: 8,
  price_amount: 8,
  why: 9,
  tools: 10,
  wand: 11,
};
const QUESTION_COUNT = 11;

/** Which answers each step owns. Only steps actually passed through are
 *  sent, so an answer left behind by going back and changing course isn't. */
const STEP_FIELDS: Partial<Record<StepId, SurveyField[]>> = {
  about: ["name", "organization", "email"],
  position: ["position"],
  role: ["role"],
  suite: ["suite"],
  links: ["links_hours"],
  sorting: ["sorting_hours"],
  leaving: ["offboarding_contact"],
  use: ["would_use"],
  price: ["pay_1800"],
  price_amount: ["price_per_year"],
  why: ["why_not"],
  tools: ["current_tools"],
  wand: ["magic_wand"],
};

const OTHER = "Other (please specify)";
/** How an "Other (please specify)" answer is kept: `Other: what they typed`. */
const OTHER_PREFIX = "Other: ";

type ChoiceStep = {
  field: SurveyField;
  heading: string;
  body?: React.ReactNode;
  options: string[];
};

const HOURS = ["0-1 hrs per week", "2-4 hrs per week", "4+ hrs per week"];

const CHOICES: Partial<Record<StepId, ChoiceStep>> = {
  position: {
    field: "position",
    heading: "What is your position within your organization?",
    options: ["Administrator", "Team Lead", "Team Member", "Volunteer", OTHER],
  },
  role: {
    field: "role",
    heading: "What is your role within your organization?",
    options: ["Leadership", "Marketing", "Operations", "Financial", OTHER],
  },
  suite: {
    field: "suite",
    heading: "Do you use Microsoft 365 or Google Workspace?",
    options: ["Microsoft 365", "Google Workspace", OTHER],
  },
  links: {
    field: "links_hours",
    heading:
      "How much time do you or your team spend trying to find links to files in your email or drive? (Weekly)",
    body: (
      <strong>
        For example, someone sends you a link for a document and then it gets
        lost in your email.
      </strong>
    ),
    options: HOURS,
  },
  sorting: {
    field: "sorting_hours",
    heading:
      "How much time do you or your team spend manually sorting files into their proper folders in your drive? (Weekly)",
    options: HOURS,
  },
  leaving: {
    field: "offboarding_contact",
    heading:
      "When a team member or volunteer leaves, how often do you have to contact them to access their old files?",
    options: ["Often", "Sometimes", "Rarely", "Never"],
  },
  use: {
    field: "would_use",
    heading:
      "Here is our solution Knohow and how it solves the issues above, would you use this product?",
    options: [
      "Yes definitely - We would be willing to pay for it",
      "Yes maybe - We would need more detail",
      "No maybe - This does not address our main pain points",
      "No never",
    ],
  },
  price: {
    field: "pay_1800",
    heading: "Would you pay $1,800 a year for it?",
    options: ["Yes", "No"],
  },
};

/** Both "Yes" answers to question 7 go on to the price; both "No"s to why. */
const wouldUse = (a: SurveyResponse) => a.would_use?.startsWith("Yes") ?? false;

function nextStep(step: StepId, a: SurveyResponse): StepId {
  switch (step) {
    case "intro":
      return "tour";
    case "tour":
      return "about";
    case "about":
      return "position";
    case "position":
      return "role";
    case "role":
      return "suite";
    case "suite":
      return "links";
    case "links":
      return "sorting";
    case "sorting":
      return "leaving";
    case "leaving":
      return "use";
    case "use":
      return wouldUse(a) ? "price" : "why";
    case "price":
      return a.pay_1800 === "No" ? "price_amount" : "tools";
    case "price_amount":
    case "why":
      return "tools";
    case "tools":
      return "wand";
    default:
      return "done";
  }
}

/* ——— Saved progress ———
 * An external store over localStorage, so the server renders the intro and
 * the browser then shows wherever this visitor stopped, without a setState
 * in an effect or a hydration mismatch. */

const SAVE_KEY = "knohow_survey_v1";

type Saved = {
  history: StepId[];
  answers: SurveyResponse;
  price: number;
  /** Made on first send and kept, so a resend updates the same row. */
  responseId?: string;
  /** `?ref=` from the emailed link, kept so a later visit without it still
   *  sends it: each send rewrites the whole row, so a missing ref blanks it. */
  ref?: string;
};

/** The slider starts at the price they just said no to (Tolu, 2026-10-30). */
const START: Saved = {
  history: ["intro"],
  answers: {},
  price: 1800,
};

let saved: Saved | null = null;
const savedListeners = new Set<() => void>();

function loadSaved(): Saved {
  if (saved) return saved;
  saved = START;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
    if (
      parsed &&
      Array.isArray(parsed.history) &&
      parsed.history.length &&
      parsed.history.every((s) => STEPS.includes(s))
    )
      saved = { ...START, ...parsed };
  } catch {
    // Unreadable or blocked: start over.
  }
  return saved;
}

function save(next: Saved) {
  saved = next;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  } catch {
    // Blocked storage: progress lasts this visit.
  }
  savedListeners.forEach((listener) => listener());
}

function useSaved() {
  return useSyncExternalStore(
    (listener) => {
      savedListeners.add(listener);
      return () => savedListeners.delete(listener);
    },
    loadSaved,
    () => START,
  );
}

/* ——— Sending ———
 * One row per browser, rewritten whole on every send (the sheet's script
 * upserts on `response_id`), so sends go one at a time, in order: a slow
 * earlier one landing after a later one would blank the newer answers. */

let sending: Promise<unknown> = Promise.resolve();

function sendProgress(completed: boolean): Promise<boolean> {
  const linkRef = new URLSearchParams(window.location.search).get("ref");
  if (linkRef && linkRef !== loadSaved().ref) save({ ...loadSaved(), ref: linkRef });
  const { history, answers, ref } = loadSaved();
  const response: SurveyResponse = {};
  for (const s of history)
    for (const field of STEP_FIELDS[s] ?? [])
      if (answers[field]) response[field] = answers[field];
  // Nothing answered yet (the intro and the tour): nothing to record.
  if (!completed && !Object.keys(response).length) return Promise.resolve(true);
  if (ref) response.ref = ref;
  const responseId = loadSaved().responseId ?? crypto.randomUUID();
  if (responseId !== loadSaved().responseId) save({ ...loadSaved(), responseId });
  response.response_id = responseId;
  if (completed) response.completed = "yes";
  const run = sending.then(() => submitSurvey(response).then((r) => r.ok));
  sending = run.catch(() => false);
  return run.catch(() => false);
}

/* ——— The page ——— */

export function SurveyFlow() {
  const state = useSaved();
  const step = state.history[state.history.length - 1];
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setCardOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // A tall card scrolls inside itself; the next question starts at its top.
  useEffect(() => {
    document.querySelector(".t-login-modal")?.scrollTo(0, 0);
  }, [step]);

  const update =(patch: Partial<Saved>) => save({ ...loadSaved(), ...patch });
  const answer = (patch: SurveyResponse) => {
    const answers = { ...loadSaved().answers, ...patch };
    update({ answers });
    return answers;
  };
  const go = (next: StepId) =>
    update({ history: [...loadSaved().history, next] });
  const advance = (answers: SurveyResponse = loadSaved().answers) => {
    go(nextStep(step, answers));
    // Each answer goes to the sheet as it's given, so someone who stops at
    // the price question still leaves what they said before it.
    void sendProgress(false);
  };
  const back = () => {
    const { history } = loadSaved();
    if (history.length > 1) update({ history: history.slice(0, -1) });
  };

  const number = QUESTION_NUMBER[step];
  const choice = CHOICES[step];

  let screen: React.ReactNode;
  if (choice)
    screen = (
      <ChoiceScreen
        {...choice}
        value={state.answers[choice.field]}
        onPick={(option) => advance(answer({ [choice.field]: option }))}
      >
        {step === "use" ? <FeatureRecap /> : null}
      </ChoiceScreen>
    );
  else if (step === "intro") screen = <IntroScreen onStart={() => go("tour")} />;
  else if (step === "tour") screen = <SurveyTour onDone={() => go("about")} />;
  else if (step === "about")
    screen = (
      <AboutScreen
        initial={state.answers}
        onContinue={(about) => advance(answer(about))}
      />
    );
  else if (step === "price_amount")
    screen = (
      <PriceScreen
        initial={state.price}
        onContinue={(price) => {
          update({ price });
          advance(answer({ price_per_year: String(price) }));
        }}
      />
    );
  else if (step === "why")
    screen = (
      <LongAnswerScreen
        heading="Why?"
        initial={state.answers.why_not ?? ""}
        onContinue={(text) => advance(answer({ why_not: text }))}
      />
    );
  else if (step === "tools")
    screen = (
      <LongAnswerScreen
        heading="What are you currently using now to solve your file organization issues?"
        initial={state.answers.current_tools ?? ""}
        onContinue={(text) => advance(answer({ current_tools: text }))}
      />
    );
  else if (step === "wand")
    screen = (
      <LongAnswerScreen
        heading="If you had a magic wand and could create any tech solution to help with a problem you are currently facing right now, what would that solution be?"
        body="We are open to building new technology tools."
        initial={state.answers.magic_wand ?? ""}
        onSend={async (text) => {
          answer({ magic_wand: text });
          const ok = await sendProgress(true);
          if (ok) {
            playChime();
            go("done");
          }
          return ok;
        }}
      />
    );
  else screen = <DoneScreen />;

  return (
    <SignInSheet
      open
      atTop
      cardOpen={cardOpen}
      topLeft={
        // Back sits outside the card, opposite the sound toggle (Tolu,
        // 2026-10-25: inside the card it looked awkward).
        state.history.length > 1 && step !== "done" ? (
          <div className="flex items-center gap-4">
            <BackButton onClick={back} />
            {number ? <QuestionCount number={number} /> : null}
          </div>
        ) : null
      }
      topRight={<SoundToggle />}
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        {screen}
      </motion.div>
    </SignInSheet>
  );
}

/** "6 of 10", top-left where Book a Demo keeps its countdown; the number
 *  pops in like the countdown's digits. */
/** The setup back chevron, as a pill on the sheet like Close and the sound
 *  toggle. */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        playTick();
        onClick();
      }}
      className={cn(CTA_CLASS, "min-w-0 gap-1.5 pl-[0.9rem] whitespace-nowrap")}
    >
      <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={3} />
      Back
    </button>
  );
}

function QuestionCount({ number }: { number: number }) {
  return (
    <div
      className="text-[1.13569rem] font-bold whitespace-nowrap text-white tabular-nums"
      aria-label={`Question ${number} of ${QUESTION_COUNT}`}
    >
      <span aria-hidden>
        <span key={number} className="t-digit-group is-animating">
          <span className="t-digit">{number}</span>
        </span>
        &nbsp;of {QUESTION_COUNT}
      </span>
    </div>
  );
}

function SoundToggle() {
  const on = useSoundOn();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        setMuted(on);
        if (!on) playTick();
      }}
      aria-label={on ? "Sound on" : "Sound off"}
      className={cn(CTA_CLASS, "ml-auto gap-2 whitespace-nowrap max-sm:min-w-0")}
    >
      {on ? (
        <Volume2 aria-hidden className="size-[18px]" strokeWidth={2.4} />
      ) : (
        <VolumeX aria-hidden className="size-[18px]" strokeWidth={2.4} />
      )}
      {/* Icon only on a phone, so Back, the count and this fit one row. */}
      <span className="max-sm:hidden">{on ? "Sound on" : "Sound off"}</span>
    </button>
  );
}

/* ——— Screens ——— */

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="t-survey">
      <div className="mb-7 flex justify-center pt-2">
        <LogoLockup as="div" fontSize="3rem" />
      </div>
      <SetupHeading onBack={null}>We&rsquo;re building Knohow for nonprofits</SetupHeading>
      <SetupBody>
        We&rsquo;d love your opinion. A 20-second look at what it does, then
        eleven quick questions.
      </SetupBody>
      <SetupAction
        label="Show me"
        onClick={() => {
          playTick();
          onStart();
        }}
      />
    </div>
  );
}

/** The Yes / No shape from setup, one answer per button. Picking is the
 *  action: it moves on after a beat, so the choice is seen to land. Number
 *  keys pick too. "Other (please specify)" stays put and asks what instead. */
function ChoiceScreen({
  heading,
  body,
  options,
  value,
  onPick,
  children,
}: ChoiceStep & {
  value: string | undefined;
  onPick: (option: string) => void;
  children?: React.ReactNode;
}) {
  const wasOther = value?.startsWith(OTHER_PREFIX) ?? false;
  const [picked, setPicked] = useState(wasOther ? OTHER : value);
  const [other, setOther] = useState(wasOther ? value!.slice(OTHER_PREFIX.length) : "");
  const otherRef = useRef<HTMLInputElement>(null);
  const locked = useRef(false);

  useEffect(() => {
    if (picked === OTHER) otherRef.current?.focus({ preventScroll: true });
  }, [picked]);

  function pick(option: string) {
    if (locked.current) return;
    playTick();
    setPicked(option);
    if (option === OTHER) return;
    locked.current = true;
    window.setTimeout(() => onPick(option), 260);
  }

  function pickOther() {
    if (locked.current) return;
    const text = other.trim();
    if (!text) {
      shakeSetupField(otherRef.current);
      otherRef.current?.focus();
      return;
    }
    locked.current = true;
    playTick();
    onPick(OTHER_PREFIX + text);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Typing a number into "please specify" is an answer, not a pick.
    if (e.target instanceof HTMLInputElement) return;
    const i = Number(e.key) - 1;
    if (Number.isInteger(i) && i >= 0 && i < options.length) {
      // Picking Other moves focus into its field before the key lands there.
      e.preventDefault();
      pick(options[i]);
    }
  });

  useEffect(() => {
    // A local wrapper: an effect event's identity isn't stable, so passing it
    // straight in would leave every past screen's listener attached.
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div className="t-survey">
      <SetupHeading onBack={null}>{heading}</SetupHeading>
      {body ? <SetupBody>{body}</SetupBody> : null}
      {children}
      <SetupChoices>
        {options.map((option, i) => (
          <button
            key={option}
            type="button"
            aria-pressed={picked === option}
            onClick={() => pick(option)}
            className={cn(
              SETUP_CHOICE_CLASS,
              // The team's answers run to a sentence: let them wrap.
              "h-auto min-h-12 px-10 py-2.5 text-center leading-snug",
              "transition-[transform,border-color]",
              picked === option && "border-[#1c1917]",
            )}
          >
            {option}
            <kbd
              aria-hidden
              className="absolute right-3 hidden size-5 items-center justify-center rounded-[5px] border border-[#d9d9de] font-[inherit] text-[0.68rem] text-[#1c1917]/45 md:flex"
            >
              {i + 1}
            </kbd>
          </button>
        ))}
      </SetupChoices>
      {picked === OTHER ? (
        <>
          <div className="mx-[2.5%] mt-4">
            <SetupField
              inputRef={otherRef}
              aria-label="Please specify"
              value={other}
              maxLength={300}
              onChange={(e) => {
                setOther(e.target.value);
                clearSetupFieldError(otherRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") pickOther();
              }}
            />
          </div>
          <SetupAction label="Continue" onClick={pickOther} />
        </>
      ) : null}
    </div>
  );
}

/** Question 7's "here is our solution", in the team's words, with the
 *  tour's icons. */
const FEATURE_LINES = [
  "Auto-Sorts your documents into team folders",
  "Auto-Shares your documents within the proper teams",
  "Transfers ownership of files to the proper administrators",
  "Simplifies offboarding with one button",
];

function FeatureRecap() {
  return (
    <ul className={`${satoshi.className} mx-[2.5%] mt-5 mb-0 flex list-none flex-col gap-2 p-0`}>
      {TOUR_SCENES.map(({ id, title, icon: Icon }, i) => (
        <li
          key={id}
          className="flex items-center gap-3 rounded-[var(--login-button-radius)] bg-[var(--app-muted)] px-3 py-2.5 text-[0.84rem] leading-[1.3] font-bold text-[#1c1917]"
        >
          <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={2.2} />
          {FEATURE_LINES[i] ?? title}
        </li>
      ))}
    </ul>
  );
}

const PRICE_MAX = 2500;
const PRICE_STEP = 50;
const PRICE_PRESETS = [300, 600, 900, 1200, 1500];
const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

function PriceScreen({
  initial,
  onContinue,
}: {
  initial: number;
  onContinue: (price: number) => void;
}) {
  const [price, setPrice] = useState(initial);
  const set = (next: number) => {
    if (next === price) return;
    playDetent();
    setPrice(next);
  };

  return (
    <div className="t-survey">
      <SetupHeading onBack={null}>What would you pay?</SetupHeading>
      <div className={`${satoshi.className} mx-[2.5%] mt-7 text-center`}>
        <p className={`${sohne.className} m-0 text-[3.2rem] leading-none tracking-tight text-[#1c1917] tabular-nums`}>
          {dollars(price)}
          {price === PRICE_MAX ? "+" : ""}
          <span className="text-[1.1rem] text-[#1c1917]/50"> / year</span>
        </p>
        <p className="m-0 mt-2 text-[0.8rem] text-[#1c1917]/55">
          {price ? `About ${dollars(Math.round(price / 12))} a month` : "I wouldn't pay for it"}
        </p>
        <input
          type="range"
          min={0}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={price}
          onChange={(e) => set(Number(e.target.value))}
          aria-label="Price per year"
          aria-valuetext={`${dollars(price)} a year`}
          className="t-survey-range mt-7 w-full"
          style={{ "--fill": `${(price / PRICE_MAX) * 100}%` } as React.CSSProperties}
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {PRICE_PRESETS.map((p) => (
            <ChoicePill key={p} label={dollars(p)} selected={price === p} onClick={() => set(p)} />
          ))}
        </div>
      </div>
      <SetupAction
        label="Continue"
        onClick={() => {
          playTick();
          onContinue(price);
        }}
      />
    </div>
  );
}

const TEXTAREA_CLASS =
  "t-input t-demo-input block min-h-[8.5rem] w-full resize-none rounded-[var(--login-button-radius)] border bg-white p-3 text-[0.95rem] leading-[1.5] text-[#1c1917] outline-none";

/** A long answer, never required: Continue reads Skip until something's
 *  typed, like Book a Demo's optional steps. The last one (the magic wand)
 *  takes `onSend` instead and reads Send: sending is its action. */
function LongAnswerScreen({
  heading,
  body,
  initial,
  onContinue,
  onSend,
}: {
  heading: string;
  body?: string;
  initial: string;
  onContinue?: (text: string) => void;
  onSend?: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(initial);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="t-survey">
      <SetupHeading onBack={null}>{heading}</SetupHeading>
      {body ? <SetupBody>{body}</SetupBody> : null}
      <div className={`t-input-wrap ${satoshi.className} mx-[2.5%] mt-6`}>
        <textarea
          ref={ref}
          value={text}
          maxLength={4000}
          aria-label={heading}
          onChange={(e) => setText(e.target.value)}
          className={TEXTAREA_CLASS}
        />
      </div>
      {failed ? <SendError /> : null}
      <SetupAction
        label={onSend ? (sending ? "Sending" : "Send") : text.trim() ? "Continue" : "Skip"}
        icon={sending ? <Spinner size={16} /> : undefined}
        onClick={async () => {
          if (sending) return;
          playTick();
          if (!onSend) return onContinue?.(text.trim());
          setSending(true);
          setFailed(false);
          const ok = await onSend(text.trim()).catch(() => false);
          if (!ok) {
            setSending(false);
            setFailed(true);
          }
        }}
      />
    </div>
  );
}

function SendError() {
  return (
    <SetupError title="We couldn't send your answers">
      Your answers are saved here. Try again in a moment.
    </SetupError>
  );
}

const ABOUT_FIELDS = [
  { name: "name", label: "Name (optional)", autoComplete: "name", type: "text" },
  { name: "organization", label: "Organization", autoComplete: "organization", type: "text" },
  { name: "email", label: "Email", autoComplete: "email", type: "email" },
] as const;

/** Who's answering, asked first so every row says whose it is, even one that
 *  stops partway. Organization and email are required; any address works,
 *  Gmail and personal ones included. */
function AboutScreen({
  initial,
  onContinue,
}: {
  initial: SurveyResponse;
  onContinue: (about: SurveyResponse) => void;
}) {
  const [values, setValues] = useState({
    name: initial.name ?? "",
    organization: initial.organization ?? "",
    email: initial.email ?? "",
  });
  const orgRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  function next() {
    const missing = !values.organization.trim()
      ? orgRef.current
      : emailError(values.email)
        ? emailRef.current
        : null;
    if (missing) {
      shakeSetupField(missing);
      missing.focus();
      return;
    }
    playTick();
    onContinue({
      name: values.name.trim(),
      organization: values.organization.trim(),
      email: values.email.trim(),
    });
  }

  return (
    <div className="t-survey">
      <div className={`${satoshi.className} mx-[2.5%] flex flex-col gap-3`}>
        {ABOUT_FIELDS.map((f) => (
          <label key={f.name} className="flex flex-col">
            <span className="mb-1.5 text-[0.8rem] text-[rgb(28_25_23/0.6)]">{f.label}</span>
            <SetupField
              inputRef={
                f.name === "email" ? emailRef : f.name === "organization" ? orgRef : undefined
              }
              type={f.type}
              autoComplete={f.autoComplete}
              value={values[f.name]}
              maxLength={200}
              onChange={(e) => {
                const value = e.target.value;
                setValues((v) => ({ ...v, [f.name]: value }));
                if (f.name === "email") clearSetupFieldError(emailRef.current);
                if (f.name === "organization") clearSetupFieldError(orgRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") next();
              }}
            />
          </label>
        ))}
      </div>
      <SetupAction label="Continue" onClick={next} />
    </div>
  );
}

function DoneScreen() {
  return (
    <div className="t-survey">
      <ResultMark kind="check" />
      <SetupHeading onBack={null}>Thank you</SetupHeading>
      <SetupBody>
        We thank you again for your time and look forward to your insight.
      </SetupBody>
      <SetupAction label="Visit Knohow" onClick={() => window.location.assign(siteUrl("/"))} />
    </div>
  );
}
