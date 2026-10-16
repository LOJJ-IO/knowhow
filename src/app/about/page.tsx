import type { Metadata } from "next";
import Link from "next/link";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import {
  Callout,
  Clause,
  LINK_CLASS,
  List,
  Section,
} from "@/components/legal/legal-page";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About Knohow",
  description:
    "Knohow helps organizations take control of Google Workspace files: team folders, sharing rules, ownership visibility, and offboarding — without replacing Drive.",
};

const SIDEBAR = [
  { href: "/", label: "Home" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
] as const;

/** Public product page for Google OAuth brand verification and anyone who
 *  wants to understand Knohow without signing in. */
export default function AboutPage() {
  return (
    <div
      className={cn(
        satoshi.className,
        "min-h-dvh bg-background text-[1rem] leading-[1.625rem] text-[#1c1917]",
      )}
    >
      <header className="px-[clamp(0.75rem,2vw,1.5rem)] pt-6 lg:px-6">
        <Link href="/" aria-label="Knohow home" className="inline-block">
          <LogoLockup as="div" fontSize="2.6rem" byTop="0.54em" />
        </Link>
      </header>

      <div className="mx-auto max-w-[80rem] px-4 pb-24 md:px-8">
        <div className="mt-6 flex min-h-[clamp(10rem,24vw,21.5rem)] items-center justify-center rounded-2xl bg-[#efedea] px-6 py-12">
          <h1
            className={`${sohne.className} m-0 text-center text-[clamp(2.25rem,4.5vw,3rem)] leading-[1.1] tracking-tight`}
          >
            About Knohow
          </h1>
        </div>

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,55rem)_18rem] lg:justify-between">
          <article className="min-w-0">
            <p className="m-0">
              Knohow is a Google Workspace product from LOJJ.IO. It helps
              organizations organize company files in Drive, keep work visible
              when people leave, and apply team sharing rules — without
              replacing Google Drive.
            </p>

            <Section n={1} title="What Knohow does">
              <Clause>
                In most Workspace orgs, important Docs, Sheets and Slides stay
                in personal Drives and depend on someone remembering to share.
                When someone joins or leaves, access and ownership are manual
                and easy to miss.
              </Clause>
              <Clause>Knohow gives each organization:</Clause>
              <List>
                <li>
                  <strong>Company folders by team</strong> — a librarian view
                  that sorts company files into the right place in the app.
                  Your Drive layout is not rewritten as the source of truth.
                </li>
                <li>
                  <strong>Sharing rules</strong> — new company files can follow
                  a team&rsquo;s policy so leaders and owners see the work
                  without chasing shares.
                </li>
                <li>
                  <strong>Ownership visibility</strong> — see which company
                  files your organization owns and where work is stuck outside
                  company ownership.
                </li>
                <li>
                  <strong>Offboarding</strong> — pick who takes over when
                  someone leaves so files move in one place; nothing is deleted
                  by that step alone.
                </li>
                <li>
                  <strong>Org chart and roles</strong> — teams, leads, owner and
                  Super Admin, so access and approvals match how the company is
                  structured.
                </li>
              </List>
              <Callout>
                <p className="m-0">
                  You do not need to sign in to read this page, our{" "}
                  <Link href="/privacy" className={LINK_CLASS}>
                    Privacy Policy
                  </Link>
                  , or our{" "}
                  <Link href="/terms" className={LINK_CLASS}>
                    Terms of Use
                  </Link>
                  .
                </p>
              </Callout>
            </Section>

            <Section n={2} title="Why Knohow asks for Google access">
              <Clause>
                Knohow signs you in with Google and, with your or your
                administrator&rsquo;s permission, uses Google APIs so it can
                work with your Workspace account and Drive. Depending on how
                your organization connects, that may include:
              </Clause>
              <List>
                <li>
                  <strong>Sign-in</strong> — your name, email, profile picture
                  and Workspace domain so we can create or find your
                  organization and keep you signed in.
                </li>
                <li>
                  <strong>Google Drive</strong> — file metadata such as titles,
                  owners, collaborators, sharing settings, types and dates, so
                  we can show company files, suggest where they belong, apply
                  sharing rules and help with ownership changes. We do not store
                  the contents of your files.
                </li>
                <li>
                  <strong>Admin confirmation (when used)</strong> — a check that
                  you manage the company&rsquo;s Google accounts, so Knohow can
                  connect for the organization when a Super Admin authorizes it.
                </li>
              </List>
              <Clause>
                Personal files stay yours: they are not shown to your
                organization. How we handle Google user data is described in our{" "}
                <Link href="/privacy" className={LINK_CLASS}>
                  Privacy Policy
                </Link>
                , including Google&rsquo;s Limited Use requirements.
              </Clause>
            </Section>

            <Section n={3} title="Who it is for">
              <List>
                <li>
                  Organization owners who need visibility into team work without
                  chasing shares.
                </li>
                <li>
                  Team leads who should see their team&rsquo;s company files by
                  default.
                </li>
                <li>
                  Members who create Docs, Sheets and Slides and want company
                  work filed in a predictable place.
                </li>
              </List>
            </Section>

            <Section n={4} title="Operator and contact">
              <Clause>
                Knohow is operated by LOJJ.IO (Alberta, Canada). Questions:{" "}
                <a href="mailto:info@lojj.io" className={LINK_CLASS}>
                  info@lojj.io
                </a>
                .
              </Clause>
              <Clause>
                Sign in and the product app live at{" "}
                <a href="https://app.knohow.app" className={LINK_CLASS}>
                  app.knohow.app
                </a>
                . This marketing site and policies live at{" "}
                <a href="https://knohow.app" className={LINK_CLASS}>
                  knohow.app
                </a>
                .
              </Clause>
            </Section>
          </article>

          <aside className="lg:pt-0">
            <h2
              className={`${sohne.className} m-0 text-[1.2rem] tracking-tight`}
            >
              Related
            </h2>
            <ul className="mt-5 flex list-none flex-col gap-3 p-0 text-[0.95rem]">
              {SIDEBAR.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[rgb(28_25_23/0.6)] hover:text-[#1c1917] hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
