"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";

export async function updateSharingPolicy(
  _teamId: string,
  _field: "autoShareWithLeader" | "autoShareWithOwner",
  _value: boolean
) {
  await requireUser();
  revalidatePath("/settings");
}
