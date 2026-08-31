"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { offboardPerson, onboardPerson } from "@/lib/workspace";

export async function addPerson(teamId: string, formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "MEMBER") as "TEAM_LEADER" | "MEMBER";

  if (!name || !email) {
    return { error: "Name and email are required." };
  }

  try {
    const result = await onboardPerson({
      organizationId: user.organizationId,
      teamId,
      actorId: user.id,
      name,
      email,
      role,
    });

    revalidatePath(`/team/${teamId}/people`);
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    revalidatePath("/org-chart");
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not onboard that person." };
  }
}

export async function removePerson(teamId: string, userId: string) {
  const user = await requireUser();
  const result = await offboardPerson(user.organizationId, userId, user.id);

  revalidatePath(`/team/${teamId}/people`);
  revalidatePath("/dashboard");
  revalidatePath("/activity");
  revalidatePath("/org-chart");
  return result;
}
