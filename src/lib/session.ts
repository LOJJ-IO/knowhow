import { cookies } from "next/headers";

const COOKIE_NAME = "knowhow_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "TEAM_LEADER" | "MEMBER";
  status: "ACTIVE" | "OFFBOARDED";
  organizationId: string;
  teamId: string | null;
  organization: { id: string; name: string };
  team: { id: string; name: string } | null;
};

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const u = value as Record<string, unknown>;
  return (
    typeof u.id === "string" &&
    typeof u.name === "string" &&
    typeof u.email === "string" &&
    (u.role === "OWNER" || u.role === "TEAM_LEADER" || u.role === "MEMBER") &&
    (u.status === "ACTIVE" || u.status === "OFFBOARDED") &&
    typeof u.organizationId === "string" &&
    (u.teamId === null || typeof u.teamId === "string") &&
    !!u.organization &&
    typeof u.organization === "object" &&
    typeof (u.organization as { id?: unknown }).id === "string" &&
    typeof (u.organization as { name?: unknown }).name === "string" &&
    (u.team === null ||
      (typeof u.team === "object" &&
        typeof (u.team as { id?: unknown }).id === "string" &&
        typeof (u.team as { name?: unknown }).name === "string"))
  );
}

/** Cookie-only session: stores the full SessionUser (no database). */
export async function createSession(user: SessionUser) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isSessionUser(parsed) || parsed.status === "OFFBOARDED") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
