/** Talking to the FastAPI backend. One place, so a screen never reinvents the
 *  URL, the credentials mode, or how an error message is dug out. */

export const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;

/** The backend's `/auth/me` — who's signed in, if anyone. */
export type Me = {
  id: string;
  organization_id: string;
  organization_name: string;
  organization_domain: string | null;
  email: string;
  /** The person's name as Google gave it. Null when Google didn't. */
  display_name: string | null;
  standing: "approved" | "auto_affiliated";
  is_owner: boolean;
  is_founding_member: boolean;
  is_team_lead: boolean;
  needs_org_setup: boolean;
  /** Where setup stopped, if it did. Null when there's nothing to resume. */
  setup_step: string | null;
  is_super_admin: boolean;
  /** Google already answered the Super Admin check (yes or no). */
  admin_proof_attempted: boolean;
  /** Joiner still needs the team-pick wizard (ADR-0021). */
  needs_join_placement: boolean;
  /** Owner unset on the chart — join wizard may offer an owner claim. */
  owner_claim_available: boolean;
};

/** Calls the backend with its session cookies (they live on its origin). */
export function backendFetch(path: string, init?: RequestInit) {
  return fetch(`${BACKEND_API_URL}${path}`, { ...init, credentials: "include" });
}

/** Shown wherever a screen can't load because the person isn't approved yet. */
export const LIMITED_ACCESS_MESSAGE =
  "Your access is limited until the founder approves you. You can still explore the app.";

/** A readable message from a failed response. FastAPI sends `detail` as a
 *  string for our own errors and as a list of field errors for a 422. */
export async function backendError(res: Response): Promise<string> {
  // A 403 is the backend's own wording ("membership not yet approved by the
  // organization's owner"), written for developers and wrong under ADR-0021.
  if (res.status === 403) return LIMITED_ACCESS_MESSAGE;
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string")
    return detail[0].msg;
  return `Request failed (${res.status})`;
}

/** Remembers how far setup got, so the next sign-in resumes there instead of
 *  the landing page. Best-effort: failing to record progress must never block
 *  the founder, it only costs them the resume. */
export async function recordSetupStep(step: string): Promise<void> {
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

/** Google's admin check. A full round trip off-site, not a fetch. */
export function startAdminProof() {
  if (!BACKEND_API_URL) return;
  // External origin (the backend), not a Next.js route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${BACKEND_API_URL}/auth/admin-proof/start`);
}
