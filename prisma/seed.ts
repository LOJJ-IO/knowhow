import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "knowhow-demo";

const DOC_TITLES: Record<"DOC" | "SHEET" | "SLIDE", string[]> = {
  DOC: ["Q3 Marketing Plan", "Onboarding Checklist", "Brand Guidelines Draft"],
  SHEET: ["Content Calendar", "Campaign Budget", "Vendor Contacts"],
  SLIDE: ["Product Launch Deck v2.1", "Board Update — August", "Client Pitch Template"],
};

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const org = await prisma.organization.create({
    data: { name: "Acme Collective" },
  });

  const owner = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Jordan Blake",
      email: "owner@acme.test",
      passwordHash,
      role: "OWNER",
    },
  });

  const teamDefs = [
    { name: "Marketing", leader: "Sarah Chen", members: ["Mike Ross", "David Kim"] },
    { name: "Sales", leader: "Priya Anand", members: ["Leo Martins"] },
    { name: "Product", leader: "Wes Okoye", members: ["Nina Patel", "Tom Alvarez"] },
  ];

  for (const def of teamDefs) {
    const team = await prisma.team.create({
      data: { organizationId: org.id, name: def.name },
    });

    await prisma.sharingPolicy.create({
      data: { teamId: team.id, autoShareWithLeader: true, autoShareWithOwner: true },
    });

    const leader = await prisma.user.create({
      data: {
        organizationId: org.id,
        teamId: team.id,
        name: def.leader,
        email: `${def.leader.toLowerCase().replace(" ", ".")}@acme.test`,
        passwordHash,
        role: "TEAM_LEADER",
      },
    });

    await prisma.team.update({ where: { id: team.id }, data: { leaderId: leader.id } });

    const memberRecords = [leader];
    for (const memberName of def.members) {
      const member = await prisma.user.create({
        data: {
          organizationId: org.id,
          teamId: team.id,
          name: memberName,
          email: `${memberName.toLowerCase().replace(" ", ".")}@acme.test`,
          passwordHash,
          role: "MEMBER",
        },
      });
      memberRecords.push(member);
    }

    let i = 0;
    for (const type of ["DOC", "SHEET", "SLIDE"] as const) {
      for (const title of DOC_TITLES[type]) {
        const docOwner = memberRecords[i % memberRecords.length];
        i += 1;
        const sharedWithLeader = i % 2 === 0;
        await prisma.document.create({
          data: {
            organizationId: org.id,
            teamId: team.id,
            ownerId: docOwner.id,
            title,
            type,
            sharedWithLeader,
            // The core problem this product solves: most docs are NOT
            // visible to the owner unless a leader/policy surfaces them.
            sharedWithOwner: sharedWithLeader && i % 4 === 0,
          },
        });
      }
    }

    await prisma.activityEvent.create({
      data: {
        organizationId: org.id,
        type: "ONBOARDED",
        actorId: owner.id,
        targetId: leader.id,
        message: `${leader.name} onboarded to ${team.name} as team leader — granted access to Google Drive, Gmail, Slack, Zoom.`,
      },
    });
  }

  console.log("Seeded demo org: Acme Collective");
  console.log(`Log in as any @acme.test address — password: ${DEMO_PASSWORD}`);
  console.log("Owner: owner@acme.test");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
