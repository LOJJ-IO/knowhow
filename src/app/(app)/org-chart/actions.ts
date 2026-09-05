"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";

export async function createTeam(_formData: FormData) {
  await requireUser();
  // Database removed — no-op until a durable store is wired.
  revalidatePath("/org-chart");
}

export async function setTeamLeader(_teamId: string, _leaderId: string) {
  await requireUser();
  revalidatePath("/org-chart");
}
