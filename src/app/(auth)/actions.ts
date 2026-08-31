"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(password);

  const { ownerId } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: orgName } });
    const owner = await tx.user.create({
      data: {
        organizationId: org.id,
        name,
        email,
        passwordHash,
        role: "OWNER",
      },
    });
    await tx.activityEvent.create({
      data: {
        organizationId: org.id,
        type: "ONBOARDED",
        actorId: owner.id,
        targetId: owner.id,
        message: `${name} created ${orgName} and became the organization owner.`,
      },
    });
    return { ownerId: owner.id };
  });

  await createSession(ownerId);
  redirect("/org-chart");
}

export async function logIn(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === "OFFBOARDED") {
    return { error: "No active account matches that email." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Incorrect password." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logOut() {
  await destroySession();
  redirect("/login");
}

/**
 * Demo-only convenience: start a session as an existing user without a
 * password, so the org-chart owner can click "View as" to see what a
 * teammate's dashboard looks like. Never wire this to production auth.
 */
export async function viewAs(userId: string) {
  await createSession(userId);
  redirect("/dashboard");
}
