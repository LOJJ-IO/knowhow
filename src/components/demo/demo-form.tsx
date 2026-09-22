"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";
import { CTA_CLASS } from "@/components/ui/tokens";
import { DemoBookingSlot } from "@/components/brand/demo-booking-slot";
import {
  leadToFormState,
  patchDemoLead,
  readDemoResumeToken,
  upsertDemoLead,
  writeDemoResumeToken,
  type DemoLeadStep,
} from "@/lib/demo-lead";

/** Book a Demo: the form, the segment step, the team-size step and the Cal
 *  embed that follows them. Its own tenant — the landing page opens the sheet
 *  and hands it any resumed lead. */

const DemoBookingStep = dynamic(
  () =>
    import("@/components/brand/demo-booking-step").then(
      (m) => m.DemoBookingStep,
    ),
  { ssr: false, loading: () => <DemoBookingSlot /> },
);

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
export type DemoFormInitial = ReturnType<typeof leadToFormState>;

export function DemoForm({ initial }: { initial?: DemoFormInitial | null }) {
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
