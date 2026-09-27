"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { sohne } from "@/components/brand/logo-mark";
import { satoshi } from "@/components/brand/fonts";
import { GoogleG } from "@/components/ui/icons";
import { FooterStubLink } from "@/components/landing/footer-stub-link";
import { SignInSheet } from "@/components/login/sign-in-sheet";
import {
  clearSignInResultFromUrl,
  readSignInResult,
  type SignInResult,
} from "@/components/setup/sign-in-result";
import {
  continueWithGoogle,
  fetchMe,
  fetchRememberedOrgs,
  readInviteToken,
  type RememberedOrg,
} from "@/lib/remembered-accounts";
import { APP_HOME } from "@/lib/app-nav";
import { readJoinToken, type JoinLinkPreview } from "@/lib/join-link";
import { siteUrl } from "@/lib/origins";
import type { Me } from "@/lib/backend";

/** Loaded on demand — only one of these is ever on screen. */
const AccountPicker = dynamic(
  () =>
    import("@/components/account-picker/account-picker").then(
      (m) => m.AccountPicker,
    ),
  { ssr: false },
);
const OrgSetupForm = dynamic(
  () => import("@/components/setup/org-setup-form").then((m) => m.OrgSetupForm),
  { ssr: false },
);
const JoinPlacementForm = dynamic(
  () =>
    import("@/components/setup/join-placement-form").then(
      (m) => m.JoinPlacementForm,
    ),
  { ssr: false },
);
const DelegationConnectStep = dynamic(
  () =>
    import("@/components/setup/delegation-connect-step").then(
      (m) => m.DelegationConnectStep,
    ),
  { ssr: false },
);
const SignInResultPanel = dynamic(
  () =>
    import("@/components/setup/sign-in-result").then(
      (m) => m.SignInResultPanel,
    ),
  { ssr: false },
);

/** `--resize-dur` (300ms) in globals.css, plus a frame: the card closing. */
const CARD_CLOSE_MS = 320;

type EntryKind = "login" | "setup" | "join" | "delegation" | "result";

/** The app's front door (ADR 0022): Log In, founder setup, the join wizard
 *  and whatever Google said on the way back, on the same sky sheet the
 *  landing used to slide up. It opens already at the top; the card grows in
 *  once we know which screen it is. Close goes back to the landing. */
export function AppEntry({
  joinToken: joinTokenProp,
  joinPreview: joinPreviewProp = null,
}: {
  joinToken?: string;
  joinPreview?: JoinLinkPreview | null;
} = {}) {
  const router = useRouter();
  /** Which screen the card shows; null until the sign-in check answers. */
  const [kind, setKind] = useState<EntryKind | null>(null);
  /** What came back from a Google round trip. */
  const [signInResult, setSignInResult] = useState<SignInResult | null>(null);
  const [setupStartAt, setSetupStartAt] = useState<
    "connectWorkspace" | "inviteOwner" | undefined
  >(undefined);
  const [connectInitialPhase, setConnectInitialPhase] = useState<
    "check" | "knowWho"
  >("check");
  /** Who's signed in (backend `/auth/me`), once known. */
  const [me, setMe] = useState<Me | null>(null);
  /** Accounts this browser has used before. Fetched on mount, not on open,
   *  so the modal sizes once (the Cal embed taught us that — see
   *  FEAT-landing-book-a-demo). */
  const [rememberedOrgs, setRememberedOrgs] = useState<RememberedOrg[]>([]);
  const [joinToken] = useState<string | null>(
    () => joinTokenProp ?? readJoinToken(),
  );
  const [joinPreview, setJoinPreview] = useState<JoinLinkPreview | null>(
    joinPreviewProp,
  );

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
    if (!joinToken || joinPreviewProp) return;
    let cancelled = false;
    void fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/join-links/${encodeURIComponent(joinToken)}`,
      { credentials: "omit" },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((preview) => {
        if (!cancelled && preview) setJoinPreview(preview as JoinLinkPreview);
      })
      .catch(() => {
        // Generic join copy is fine when the preview can't load.
      });
    return () => {
      cancelled = true;
    };
  }, [joinToken, joinPreviewProp]);

  // joinToken comes from the useState initializer — mount-stable, never updates.
  // `router` is stable too; this effect is a mount-only sign-in check either way.
  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((result) => {
      if (cancelled) return;
      if (result) setMe(result);
      const returned = readSignInResult();
      if (returned) clearSignInResultFromUrl();
      // Admin-proof / signup results must win over resume. After "Yes I'm a
      // Super Admin", the chart already exists so `setup_step` falls back to
      // orgName — that used to reopen setup and hide "Google didn't confirm".
      if (returned) {
        setSignInResult(returned);
        setKind("result");
      } else if (
        result?.needs_org_setup ||
        (result?.setup_step && result.setup_step !== "done")
      ) {
        // `needs_org_setup` only covers the first questions — it goes false as
        // soon as an org chart row exists. `setup_step` covers the rest, but
        // "done" is a finished marker, not a screen to resume: resuming it
        // opened the sheet on `OrgSetupForm`'s empty "done" branch.
        setKind("setup");
      } else if (result?.needs_join_placement) {
        setKind("join");
      } else if (joinToken || readInviteToken() || !result) {
        // A join or invite link gets its own Log In screen first, even when
        // someone is already signed in; nobody signed in gets plain Log In.
        setKind("login");
      } else {
        // Signed in with setup finished — nothing left to ask here.
        router.replace(APP_HOME);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** After Google's check: mid-setup, the owner question is next
   *  (ADR-0023); otherwise, the app. */
  function afterGoogleCheck() {
    if (me?.setup_step && me.setup_step !== "done") {
      setSignInResult(null);
      setConnectInitialPhase("check");
      setSetupStartAt("inviteOwner");
      setKind("setup");
      return;
    }
    intoTheApp();
  }

  // Load the app's first screen ahead of time, so leaving setup doesn't sit
  // on the finished screen while Home compiles and loads (user 2026-09-27:
  // Skip looked like it did nothing, then the app snapped in).
  useEffect(() => {
    router.prefetch(APP_HOME);
  }, [router]);

  /** Close the card first (its own resize), so the finish is visible at
   *  once, then hand over to the app. */
  function intoTheApp() {
    setKind(null);
    window.setTimeout(() => router.push(APP_HOME), CARD_CLOSE_MS);
  }

  return (
    <SignInSheet
      open
      atTop
      cardOpen={kind !== null}
      onClose={() => window.location.assign(siteUrl("/"))}
    >
      {kind === "login" && rememberedOrgs.length > 0 ? (
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
      ) : kind === "login" ? (
        <>
          <h2
            className={`${sohne.className} m-0 text-[1.62rem] leading-[1.15] tracking-tight text-[#1c1917]`}
          >
            {joinToken && joinPreview
              ? joinPreview.valid
                ? joinPreview.title
                : "This link has expired"
              : joinToken
                ? "Join on Knohow"
                : "Log in or sign up in seconds"}
          </h2>
          <p
            className={`${sohne.className} mt-6 text-[0.95rem] leading-[1.6] text-[#1c1917]`}
          >
            {joinToken && joinPreview
              ? joinPreview.description
              : joinToken
                ? "Sign in with Google to join your team."
                : "Use your Google account to continue with Knohow."}
          </p>
          {joinToken && joinPreview && !joinPreview.valid ? null : (
            <button
              type="button"
              onClick={() =>
                continueWithGoogle(readInviteToken(), null, joinToken)
              }
              className={`${satoshi.className} relative mt-8 flex h-12 w-full cursor-pointer items-center justify-center rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white text-[1rem] font-bold text-[#1c1917] transition-transform duration-150 active:scale-[0.98]`}
            >
              <GoogleG className="absolute left-[13px] size-5" />
              Continue with Google
            </button>
          )}
          {!(joinToken && joinPreview && !joinPreview.valid) ? (
            <p
              className={`${satoshi.className} mt-6 text-[0.8rem] leading-[1.6] text-[#1c1917]`}
            >
              By continuing, you agree to Knohow&rsquo;s{" "}
              <span className="font-bold">
                <FooterStubLink href={siteUrl("/terms")}>
                  Terms of Use
                </FooterStubLink>
              </span>
              . Read our{" "}
              <span className="font-bold">
                <FooterStubLink href={siteUrl("/privacy")}>
                  Privacy Policy
                </FooterStubLink>
              </span>
              .
            </p>
          ) : null}
        </>
      ) : kind === "setup" && me ? (
        <OrgSetupForm
          me={me}
          startAt={setupStartAt}
          connectInitialPhase={connectInitialPhase}
          onDone={() => {
            setSetupStartAt(undefined);
            setConnectInitialPhase("check");
            intoTheApp();
          }}
        />
      ) : kind === "join" && me ? (
        <JoinPlacementForm me={me} onDone={intoTheApp} />
      ) : kind === "result" && signInResult ? (
        <SignInResultPanel
          result={signInResult}
          organizationName={me?.organization_name}
          onContinue={
            signInResult === "admin_not_verified" &&
            me?.setup_step &&
            me.setup_step !== "done"
              ? afterGoogleCheck
              : undefined
          }
          onDone={() => {
            if (signInResult === "admin_verified") {
              setSignInResult(null);
              void fetchMe().then((next) => {
                if (next) setMe(next);
              });
              setKind("delegation");
              return;
            }
            if (
              signInResult === "admin_not_verified" ||
              signInResult === "admin_error"
            ) {
              setSignInResult(null);
              setConnectInitialPhase("knowWho");
              setSetupStartAt("connectWorkspace");
              setKind("setup");
              return;
            }
            // Mid-setup admin check: after the result, keep going.
            if (
              me?.needs_org_setup ||
              (me?.setup_step && me.setup_step !== "done")
            ) {
              setSignInResult(null);
              setKind("setup");
              return;
            }
            if (me?.needs_join_placement) {
              setSignInResult(null);
              setKind("join");
              return;
            }
            setSignInResult(null);
            if (me) intoTheApp();
            else setKind("login");
          }}
        />
      ) : kind === "delegation" && me ? (
        <DelegationConnectStep me={me} onDone={afterGoogleCheck} />
      ) : null}
    </SignInSheet>
  );
}
