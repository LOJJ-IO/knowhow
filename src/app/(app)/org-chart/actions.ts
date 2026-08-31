"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createTeam(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const team = await prisma.team.create({
    data: { organizationId: user.organizationId, name },
  });
  await prisma.sharingPolicy.create({
    data: { teamId: team.id, autoShareWithLeader: true, autoShareWithOwner: true },
  });

  revalidatePath("/org-chart");
  revalidatePath("/dashboard");
}

export async function setTeamLeader(teamId: string, leaderId: string) {
  const user = await requireUser();
  await prisma.team.update({
    where: { id: teamId, organizationId: user.organizationId },
    data: { leaderId },
  });
  await prisma.user.update({
    where: { id: leaderId },
    data: { role: "TEAM_LEADER", teamId },
  });

  revalidatePath("/org-chart");
  revalidatePath("/dashboard");
}
