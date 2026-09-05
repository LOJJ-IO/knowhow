"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

import {
  DEMO_PASSWORD,
  findDemoUserByEmail,
  findDemoUserById,
} from "@/lib/demo-users";
import { createSession, destroySession, type SessionUser } from "@/lib/session";

export type ActionState = { error?: string } | undefined;

export async function signUp(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!orgName || !name || !email || password.length < 8) {
    return { error: "Fill in every field — password needs at least 8 characters." };
  }

  if (findDemoUserByEmail(email)) {
    return { error: "An account with that email already exists." };
  }

  const organizationId = randomUUID();
  const user: SessionUser = {
    id: randomUUID(),
    name,
    email,
    role: "OWNER",
    status: "ACTIVE",
    organizationId,
    teamId: null,
    organization: { id: organizationId, name: orgName },
    team: null,
  };

  await createSession(user);
  redirect("/org-chart");
}

export async function logIn(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = findDemoUserByEmail(email);
  if (!user || user.status === "OFFBOARDED") {
    return { error: "No active account matches that email." };
  }

  if (password !== DEMO_PASSWORD) {
    return { error: "Incorrect password." };
  }

  await createSession(user);
  redirect("/dashboard");
}

export async function logOut() {
  await destroySession();
  redirect("/login");
}

/**
 * Demo-only convenience: start a session as an existing demo user without a
 * password, so the org-chart owner can click "View as" to see what a
 * teammate's dashboard looks like. Never wire this to production auth.
 */
export async function viewAs(userId: string) {
  const user = findDemoUserById(userId);
  if (!user) {
    redirect("/login");
  }
  await createSession(user);
  redirect("/dashboard");
}
