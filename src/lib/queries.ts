import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db";

type DocumentWithOwner = Prisma.DocumentGetPayload<{ include: { owner: true } }>;

export async function getOrgTeams(organizationId: string) {
  return prisma.team.findMany({
    where: { organizationId },
    include: {
      leader: true,
      members: { where: { status: "ACTIVE" } },
      policy: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getOrgOwner(organizationId: string) {
  return prisma.user.findFirstOrThrow({
    where: { organizationId, role: "OWNER" },
  });
}

export async function getTeamWithRoster(organizationId: string, teamId: string) {
  return prisma.team.findFirstOrThrow({
    where: { id: teamId, organizationId },
    include: {
      leader: true,
      members: { orderBy: { name: "asc" } },
      policy: true,
    },
  });
}

export type TeamDocumentColumns = Record<"DOC" | "SHEET" | "SLIDE", DocumentWithOwner[]>;

/** Powers the owner/leader dashboard's three-column recent-documents view. */
export async function getTeamDocumentsByType(
  organizationId: string,
  teamId: string
): Promise<TeamDocumentColumns> {
  const docs = await prisma.document.findMany({
    where: { organizationId, teamId },
    include: { owner: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    DOC: docs.filter((d) => d.type === "DOC"),
    SHEET: docs.filter((d) => d.type === "SHEET"),
    SLIDE: docs.filter((d) => d.type === "SLIDE"),
  };
}

/** Powers the personal "Shared With You" dashboard for a member/leader. */
export async function getDocumentsSharedWithUser(
  organizationId: string,
  user: { id: string; role: string; teamId: string | null }
): Promise<TeamDocumentColumns> {
  const visibilityFilter =
    user.role === "OWNER"
      ? { sharedWithOwner: true }
      : user.role === "TEAM_LEADER"
        ? { sharedWithLeader: true }
        : { OR: [{ sharedWithLeader: true }, { sharedWithOwner: true }] };

  const docs = await prisma.document.findMany({
    where: {
      organizationId,
      ownerId: { not: user.id },
      ...(user.role === "OWNER" ? {} : { teamId: user.teamId }),
      ...visibilityFilter,
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return {
    DOC: docs.filter((d) => d.type === "DOC"),
    SHEET: docs.filter((d) => d.type === "SHEET"),
    SLIDE: docs.filter((d) => d.type === "SLIDE"),
  };
}

export async function getRecentActivity(organizationId: string, take = 30) {
  return prisma.activityEvent.findMany({
    where: { organizationId },
    include: { actor: true, target: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}
