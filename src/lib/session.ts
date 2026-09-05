import { cookies } from "next/headers";

const COOKIE_NAME = "knowhow_session";

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

/** Cookie session only — no database. Always returns null until auth is rewired. */
export async function createSession(_userId: string) {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return null;
}
