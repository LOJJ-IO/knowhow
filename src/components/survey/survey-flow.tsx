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
 *  a short tour of Knohow, then the team's ten questions one per card. A
 *  single-choice answer moves on by itself; the long answers can be skipped.
 *  Progress is kept in this browser, so a refresh or a second visit picks up
 *  where it stopped. */

type StepId =
  | "intro"
  | "tour"
  | "team"
  | "suite"
  | "sharing"
  | "sorting"
  | "leaving"
  | "use"
  | "price"
  | "price_amount"
  | "why"
  | "tools"
  | "wand"
  | "about"
  | "done";

const STEPS: readonly StepId[] = [
  "intro",
  "tour",
  "team",
  "suite",
  "sharing",
  "sorting",
  "leaving",
  "use",
  "price",
  "price_amount",
  "why",
  "tools",
  "wand",
  "about",
  "done",
];

/** The brief's numbering: "No, I wouldn't use it" skips 7, as the brief's
 *  "If yes / If no" does. */
const QUESTION_NUMBER: Partial<Record<StepId, number>> = {
  team: 1,
  suite: 2,
  sharing: 3,
  sorting: 4,
  leaving: 5,
  use: 6,
  price: 7,
  price_amount: 7,
  why: 8,
  tools: 9,
  wand: 10,
};
const QUESTION_COUNT = 10;

/** Which answers each step owns. Only steps actually passed through are
 *  sent, so an answer left behind by going back and changing course isn't. */
const STEP_FIELDS: Partial<Record<StepId, SurveyField[]>> = {
  team: ["manages_team"],
  suite: ["suite"],
  sharing: ["sharing_struggle"],
  sorting: ["sorting_struggle"],
  leaving: ["offboarding_struggle"],
  use: ["would_use"],
  price: ["pay_1800"],
  price_amount: ["price_per_year"],
  why: ["why_not"],
  tools: ["current_tools"],
  wand: ["magic_wand"],
  about: ["name", "organization", "email"],
};

type ChoiceStep = {
  field: SurveyField;
  heading: string;
  body?: string;
  options: string[];
};

const CHOICES: Partial<Record<StepId, ChoiceStep>> = {
  team: {
    field: "manages_team",
    heading: "Do you manage a team within your organization?",
    options: ["Yes", "No"],
  },
  suite: {
    field: "suite",
    heading: "Do you use Microsoft 365 or Google Workspace?",
    options: ["Google Workspace", "Microsoft 365", "Both", "Neither"],
  },
  sharing: {
    field: "sharing_struggle",
    heading: "Does your team struggle with sharing files?",
    body: "For example, someone sends you a link for a document and then it gets lost in your email.",
    options: ["Yes", "Sometimes", "No"],
  },
  sorting: {
    field: "sorting_struggle",
    heading: "Does your team struggle to sort files into the proper folders?",
    options: ["Yes", "Sometimes", "No"],
  },
  leaving: {
    field: "offboarding_struggle",
    heading: "When a team member or volunteer leaves, is it a struggle to get their files back?",
    body: "Getting back ownership of the files that person created.",
    options: ["Yes", "Sometimes", "No", "It hasn't come up"],
  },
  use: {
    field: "would_use",
    heading: "Would you use Knohow?",
    body: "Here is how it solves the issues above.",
    options: ["Yes", "Maybe", "No"],
  },
  price: {
    field: "pay_1800",
    heading: "Would you pay $1,800 a year for it?",
    body: "That works out to $150 a month.",
    options: ["Yes", "No"],
  },
};

function nextStep(step: StepId, a: SurveyResponse): StepId {
  switch (step) {
    case "intro":
      return "tour";
    case "tour":
      return "team";
    case "team":
      return "suite";
    case "suite":
      return "sharing";
    case "sharing":
      return "sorting";
    case "sorting":
      return "leaving";
    case "leaving":
      return "use";
    case "use":
      return a.would_use === "No" ? "why" : "price";
    case "price":
      if (a.pay_1800 === "No") return "price_amount";
      return a.would_use === "Maybe" ? "why" : "tools";
    case "price_amount":
      return a.would_use === "Maybe" ? "why" : "tools";
    case "why":
      return "tools";
    case "tools":
      return "wand";
    case "wand":
      return "about";
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
  tools: string[];
  toolsOther: string;
  price: number;
  /** Made on first send and kept, so a resend updates the same row. */
  responseId?: string;
};

const START: Saved = {
  history: ["intro"],
  answers: {},
  tools: [],
  toolsOther: "",
  price: 600,
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

/* ——— The page ——— */

export function SurveyFlow() {
  const state = useSaved();
  const step = state.history[state.history.length - 1];
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setCardOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const update = (patch: Partial<Saved>) => save({ ...loadSaved(), ...patch });
  const answer = (patch: SurveyResponse) => {
    const answers = { ...loadSaved().answers, ...patch };
    update({ answers });
    return answers;
  };
  const go = (next: StepId) =>
    update({ history: [...loadSaved().history, next] });
  const advance = (answers: SurveyResponse = loadSaved().answers) =>
    go(nextStep(step, answers));
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
  else if (step === "tour") screen = <SurveyTour onDone={() => go("team")} />;
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
        heading={
          state.answers.would_use === "Maybe"
            ? "What's holding you back?"
            : "Why wouldn't you use it?"
        }
        initial={state.answers.why_not ?? ""}
        onContinue={(text) => advance(answer({ why_not: text }))}
      />
    );
  else if (step === "tools")
    screen = (
      <ToolsScreen
        initial={state.tools}
        initialOther={state.toolsOther}
        onContinue={(tools, toolsOther) => {
          update({ tools, toolsOther });
          const list = tools.map((t) =>
            t === "Other" && toolsOther.trim() ? `Other: ${toolsOther.trim()}` : t,
          );
          advance(answer({ current_tools: list.join(", ") }));
        }}
      />
    );
  else if (step === "wand")
    screen = (
      <LongAnswerScreen
        heading="If you had a magic wand, what tech solution would you create?"
        body="We're open to building new tools. What would help with a problem you're facing right now?"
        initial={state.answers.magic_wand ?? ""}
        onContinue={(text) => advance(answer({ magic_wand: text }))}
      />
    );
  else if (step === "about")
    screen = (
      <AboutScreen
        initial={state.answers}
        onSend={async (about) => {
          const answers = answer(about);
          const { history } = loadSaved();
          const response: SurveyResponse = {};
          for (const s of history)
            for (const field of STEP_FIELDS[s] ?? [])
              if (answers[field]) response[field] = answers[field];
          const ref = new URLSearchParams(window.location.search).get("ref");
          if (ref) response.ref = ref;
          const responseId = loadSaved().responseId ?? crypto.randomUUID();
          update({ responseId });
          response.response_id = responseId;
          const { ok } = await submitSurvey(response);
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
        ten quick questions.
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
 *  keys pick too. */
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
  const [picked, setPicked] = useState(value);
  const locked = useRef(false);

  function pick(option: string) {
    if (locked.current) return;
    locked.current = true;
    playTick();
    setPicked(option);
    window.setTimeout(() => onPick(option), 260);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const i = Number(e.key) - 1;
    if (Number.isInteger(i) && i >= 0 && i < options.length) pick(options[i]);
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
    </div>
  );
}

/** Question 6's "here is our solution": the tour's four lines again. */
function FeatureRecap() {
  return (
    <ul className={`${satoshi.className} mx-[2.5%] mt-5 mb-0 flex list-none flex-col gap-2 p-0`}>
      {TOUR_SCENES.map(({ id, title, icon: Icon }) => (
        <li
          key={id}
          className="flex items-center gap-3 rounded-[var(--login-button-radius)] bg-[var(--app-muted)] px-3 py-2.5 text-[0.84rem] leading-[1.3] font-bold text-[#1c1917]"
        >
          <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={2.2} />
          {title}
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
      <SetupHeading onBack={null}>What would you pay for it?</SetupHeading>
      <SetupBody>Per year, for your organization.</SetupBody>
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
 *  typed, like Book a Demo's optional steps. */
function LongAnswerScreen({
  heading,
  body,
  initial,
  onContinue,
}: {
  heading: string;
  body?: string;
  initial: string;
  onContinue: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
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
      <SetupAction
        label={text.trim() ? "Continue" : "Skip"}
        onClick={() => {
          playTick();
          onContinue(text.trim());
        }}
      />
    </div>
  );
}

const TOOLS = [
  "Google Drive folders",
  "Shared drives",
  "OneDrive / SharePoint",
  "Dropbox",
  "Email attachments",
  "Nothing yet",
  "Other",
];

function ToolsScreen({
  initial,
  initialOther,
  onContinue,
}: {
  initial: string[];
  initialOther: string;
  onContinue: (tools: string[], other: string) => void;
}) {
  const [tools, setTools] = useState(initial);
  const [other, setOther] = useState(initialOther);
  const otherRef = useRef<HTMLInputElement>(null);
  const hasOther = tools.includes("Other");

  useEffect(() => {
    if (hasOther) otherRef.current?.focus({ preventScroll: true });
  }, [hasOther]);

  const toggle = (tool: string) => {
    playTick();
    setTools((t) => (t.includes(tool) ? t.filter((x) => x !== tool) : [...t, tool]));
  };

  return (
    <div className="t-survey">
      <SetupHeading onBack={null}>
        What are you currently using to solve your file organization issues?
      </SetupHeading>
      <SetupBody>Pick any that apply.</SetupBody>
      <div className={`${satoshi.className} mx-[2.5%] mt-6 flex flex-wrap gap-2`}>
        {TOOLS.map((tool) => (
          <ChoicePill
            key={tool}
            label={tool}
            selected={tools.includes(tool)}
            onClick={() => toggle(tool)}
          />
        ))}
      </div>
      {hasOther ? (
        <div className="mx-[2.5%] mt-4">
          <SetupField
            inputRef={otherRef}
            aria-label="What else you use"
            value={other}
            maxLength={300}
            onChange={(e) => setOther(e.target.value)}
          />
        </div>
      ) : null}
      <SetupAction
        label={tools.length ? "Continue" : "Skip"}
        onClick={() => {
          playTick();
          onContinue(tools, other);
        }}
      />
    </div>
  );
}

const ABOUT_FIELDS = [
  { name: "name", label: "Your name", autoComplete: "name", type: "text" },
  { name: "organization", label: "Organization", autoComplete: "organization", type: "text" },
  { name: "email", label: "Email", autoComplete: "email", type: "email" },
] as const;

/** Who answered, all optional. Sending is this screen's action. */
function AboutScreen({
  initial,
  onSend,
}: {
  initial: SurveyResponse;
  onSend: (about: SurveyResponse) => Promise<boolean>;
}) {
  const [values, setValues] = useState({
    name: initial.name ?? "",
    organization: initial.organization ?? "",
    email: initial.email ?? "",
  });
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function send() {
    if (sending) return;
    if (values.email.trim() && emailError(values.email)) {
      shakeSetupField(emailRef.current);
      emailRef.current?.focus();
      return;
    }
    playTick();
    setSending(true);
    setFailed(false);
    const ok = await onSend({
      name: values.name.trim(),
      organization: values.organization.trim(),
      email: values.email.trim(),
    }).catch(() => false);
    if (!ok) {
      setSending(false);
      setFailed(true);
    }
  }

  return (
    <div className="t-survey">
      <SetupHeading onBack={null}>Who should we thank?</SetupHeading>
      <SetupBody>Optional, in case you&rsquo;d like us to follow up.</SetupBody>
      <div className={`${satoshi.className} mx-[2.5%] mt-6 flex flex-col gap-3`}>
        {ABOUT_FIELDS.map((f) => (
          <label key={f.name} className="flex flex-col">
            <span className="mb-1.5 text-[0.8rem] text-[rgb(28_25_23/0.6)]">{f.label}</span>
            <SetupField
              inputRef={f.name === "email" ? emailRef : undefined}
              type={f.type}
              autoComplete={f.autoComplete}
              value={values[f.name]}
              maxLength={200}
              onChange={(e) => {
                const value = e.target.value;
                setValues((v) => ({ ...v, [f.name]: value }));
                if (f.name === "email") clearSetupFieldError(emailRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
          </label>
        ))}
      </div>
      {failed ? (
        <SetupError title="We couldn't send your answers">
          Your answers are saved here. Try again in a moment.
        </SetupError>
      ) : null}
      <SetupAction
        label={sending ? "Sending" : "Send"}
        icon={sending ? <Spinner size={16} /> : undefined}
        onClick={() => void send()}
      />
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
