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
  needs_org_setup: boolean;
  /** Where setup stopped, if it did. Null when there's nothing to resume. */
  setup_step: string | null;
  is_super_admin: boolean;
  /** Google already answered the Super Admin check (yes or no). */
  admin_proof_attempted: boolean;
};

/** Calls the backend with its session cookies (they live on its origin). */
export function backendFetch(path: string, init?: RequestInit) {
  return fetch(`${BACKEND_API_URL}${path}`, { ...init, credentials: "include" });
}

/** A readable message from a failed response. FastAPI sends `detail` as a
 *  string for our own errors and as a list of field errors for a 422. */
export async function backendError(res: Response): Promise<string> {
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
