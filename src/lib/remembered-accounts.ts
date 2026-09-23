/** Accounts this browser has signed in with, and the ways off to Google.
 *
 *  Shared by the account picker and the landing page, so neither owns the
 *  other's data shape. */

import { BACKEND_API_URL, backendFetch, type Me } from "@/lib/backend";

/** FastAPI backend origin (`backend/`). Sign-in is a full-page redirect to it — see Architecture-Overview's "Backend integration contract". */
/** Hands the browser to the backend's Google sign-in. `/onboarding/signup` signs in existing members and bootstraps new ones, so one button covers both.
 *  An invite token (from a forwarded `?invite=` link) pre-selects the invited Google account. */
export function continueWithGoogle(
  inviteToken?: string | null,
  emailHint?: string | null,
) {
  if (!BACKEND_API_URL) {
    console.error(
      "NEXT_PUBLIC_BACKEND_API_URL is not set — cannot start Google sign-in.",
    );
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
export function readInviteToken(): string | null {
  const invite = new URLSearchParams(window.location.search).get("invite");
  return invite && invite !== "wrong_account" ? invite : null;
}

/** One account this browser has signed in with before — the Log In picker.
 *  The backend keys these to an opaque device cookie, not to a person:
 *  Knohow can't tell that two Google accounts are the same human. */
/** One row in the picker: an organization this browser has signed in to.
 *  Signing in is signing in to an org (user 2026-09-20), so the org's name
 *  leads and the person's name is the subtext — two companies plus a personal
 *  org is three rows. */
export type RememberedOrg = {
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

export async function fetchRememberedOrgs(): Promise<RememberedOrg[]> {
  if (!BACKEND_API_URL) return [];
  try {
    const res = await backendFetch("/auth/remembered-accounts");
    if (!res.ok) return [];
    return ((await res.json()) as { organizations: RememberedOrg[] })
      .organizations;
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
export async function forgetRememberedAccounts(
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

export async function fetchMe(): Promise<Me | null> {
  if (!BACKEND_API_URL) return null;
  try {
    const res = await backendFetch("/auth/me");
    return res.ok ? ((await res.json()) as Me) : null;
  } catch {
    return null; // backend not running — the landing works without it
  }
}

/** End this session. The backend clears the access and refresh cookies and
 *  deliberately keeps the device cookie, so the account picker can still offer
 *  the account afterwards ("pick up where you left off"). */
export async function logOut(): Promise<void> {
  try {
    await backendFetch("/auth/logout", { method: "POST" });
  } catch {
    // A failed call still means the person wants out; the caller navigates
    // away regardless and the session check on the next screen decides.
  }
}

/** Signs this browser in as another account it has already signed in as, with
 *  no trip to Google (`POST /auth/switch`). The device cookie is the
 *  credential — the backend will only move between accounts remembered on
 *  this browser — so an account it has never seen still has to go through
 *  `continueWithGoogle`. Returns false when the backend refuses, and the
 *  caller falls back.
 *
 *  Device trust is a deliberate choice, taken by the user 2026-09-22: the
 *  round trip was asking the person to prove again what this browser had
 *  already proved. */
export async function switchToAccount(memberId: string): Promise<boolean> {
  if (!BACKEND_API_URL) return false;
  try {
    const res = await backendFetch("/auth/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Adds another of this person's Google accounts, from inside the app.
 *
 *  **Not `continueWithGoogle`**: that starts *signup*, which asks a personal
 *  address whether its company uses Workspace and leaves the person on the
 *  landing page (user 2026-09-22: "adding account is still taking me back to
 *  the log in screen"). This is the identity-linking flow — Google's chooser
 *  opens, the account joins the person already signed in, and the browser
 *  comes back to the app. */
export function addAnotherAccount() {
  if (!BACKEND_API_URL) {
    console.error(
      "NEXT_PUBLIC_BACKEND_API_URL is not set — cannot add an account.",
    );
    return;
  }
  // External origin (the backend), not a Next.js route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${BACKEND_API_URL}/auth/link-account/start`);
}
