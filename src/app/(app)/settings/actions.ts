"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function updateSharingPolicy(
  teamId: string,
  field: "autoShareWithLeader" | "autoShareWithOwner",
  value: boolean
) {
  const user = await requireUser();

  const team = await prisma.team.findFirstOrThrow({
    where: { id: teamId, organizationId: user.organizationId },
  });

  await prisma.sharingPolicy.upsert({
    where: { teamId: team.id },
    update: { [field]: value },
    create: {
      teamId: team.id,
      autoShareWithLeader: field === "autoShareWithLeader" ? value : true,
      autoShareWithOwner: field === "autoShareWithOwner" ? value : true,
    },
  });

  revalidatePath("/settings");
}
