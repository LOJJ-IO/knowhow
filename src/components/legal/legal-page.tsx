import Link from "next/link";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";

/** Legal pages (Terms of Use, Privacy Policy) — layout modelled on Canva's
 *  policy pages: logo header, grey title banner, effective-date
 *  line, text column + "Other policies" sidebar, plain-language callouts. */

const POLICIES = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
] as const;

/** Inline link style — matches the landing's footer links. */
const LINK_CLASS = "font-bold underline underline-offset-2";

function LegalPage({
  title,
  href,
  effective,
  plural = false,
  children,
}: {
  title: string;
  /** "These Terms of Use are…" vs "This Privacy Policy is…". */
  plural?: boolean;
  href: (typeof POLICIES)[number]["href"];
  /** e.g. "17 September 2026". */
  effective: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        satoshi.className,
        "min-h-dvh bg-background text-[1rem] leading-[1.625rem] text-[#1c1917]",
      )}
    >
      <header className="px-[clamp(0.75rem,2vw,1.5rem)] pt-6 lg:px-6">
        <Link href="/" aria-label="Knohow home" className="inline-block">
          {/* "by LOJJ.io" pulled closer to the wordmark than the default, ~10%
              three times: visible gap 14.5 → 13.5 → 12.5 → 11.5px at 2.6rem
              (text snaps to whole px). */}
          <LogoLockup as="div" fontSize="2.6rem" byTop="0.54em" />
        </Link>
      </header>

      <div className="mx-auto max-w-[80rem] px-4 pb-24 md:px-8">
        <div className="mt-6 flex min-h-[clamp(10rem,24vw,21.5rem)] items-center justify-center rounded-2xl bg-[#efedea] px-6 py-12">
          <h1
            className={`${sohne.className} m-0 text-center text-[clamp(2.25rem,4.5vw,3rem)] leading-[1.1] tracking-tight`}
          >
            {title}
          </h1>
        </div>

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,55rem)_18rem] lg:justify-between">
          <article className="min-w-0">
            <p className="m-0">
              {plural ? "These" : "This"} {title} {plural ? "are" : "is"}{" "}
              effective as of {effective}.
            </p>
            {children}
          </article>

          <aside className="lg:pt-0">
            <h2 className={`${sohne.className} m-0 text-[1.2rem] tracking-tight`}>
              Other policies
            </h2>
            <ul className="mt-5 flex list-none flex-col gap-3 p-0 text-[0.95rem]">
              {POLICIES.map((p) => (
                <li key={p.href}>
                  {p.href === href ? (
                    <span aria-current="page" className="font-bold">
                      {p.label}
                    </span>
                  ) : (
                    <Link
                      href={p.href}
                      className="text-[rgb(28_25_23/0.6)] hover:text-[#1c1917] hover:underline"
                    >
                      {p.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Numbered top-level section ("1. Overview"). */
function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2
        id={id}
        className={`${sohne.className} m-0 text-[1.35rem] leading-[1.3] tracking-tight`}
      >
        {n}. {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Paragraph led by a bold lettered clause ("A. Your account."). */
function Clause({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <p className="m-0">
      {label ? <strong>{label} </strong> : null}
      {children}
    </p>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="m-0 flex list-disc flex-col gap-2 pl-5 marker:text-[#1c1917]">
      {children}
    </ul>
  );
}

/** Plain-language summary box — not a substitute for the clause above it. */
function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-[#dfe9fd] px-5 py-5 text-[0.95rem] leading-[1.5rem]">
      <InfoIcon />
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="mt-[2px] shrink-0"
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 11v5.5M12 7.75v.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { LegalPage, Section, Clause, List, Callout, LINK_CLASS };
