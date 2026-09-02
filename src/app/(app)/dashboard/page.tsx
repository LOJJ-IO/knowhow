import Link from "next/link";

import { CreateWorkPanel } from "@/components/dashboard/create-work-panel";
import { FolderRoutingPanel } from "@/components/dashboard/folder-routing-panel";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";
import { TeamDocumentsBoard } from "@/components/dashboard/team-documents-board";
import { requireUser } from "@/lib/auth";
import {
  getDocumentsSharedWithUser,
  getFolderRouting,
  getMyDocuments,
  getOrgTeams,
  getTeamDocumentsByType,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const user = await requireUser();

  if (user.role !== "OWNER") {
    const [columns, myDocs] = await Promise.all([
      getDocumentsSharedWithUser(user.organizationId, {
        id: user.id,
        role: user.role,
        teamId: user.teamId,
      }),
      getMyDocuments(user.organizationId, user.id),
    ]);
    return (
      <MemberDashboard name={user.name} role={user.role} columns={columns} myDocs={myDocs} />
    );
  }

  const teams = await getOrgTeams(user.organizationId);
  const { team: teamIdParam } = await searchParams;
  const activeTeam = teams.find((t) => t.id === teamIdParam) ?? teams[0];

  if (!activeTeam) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold text-foreground">Overall Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No teams yet.{" "}
          <Link href="/org-chart" className="underline underline-offset-4">
            Build your org chart
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  const [columns, routing] = await Promise.all([
    getTeamDocumentsByType(user.organizationId, activeTeam.id),
    getFolderRouting(user.organizationId),
  ]);
  const owners = activeTeam.members
    .filter((m) => m.id !== activeTeam.leaderId)
    .map((m) => ({ id: m.id, name: m.name }));
  if (activeTeam.leader) {
    owners.unshift({ id: activeTeam.leader.id, name: activeTeam.leader.name });
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-foreground">Overall Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Documents created by your teams, and whether you can see them yet.
      </p>

      <div className="mt-5">
        <GlobalSearch />
      </div>

      <h2 className="mt-6 mb-3 text-sm font-semibold text-foreground">Create New Work</h2>
      <CreateWorkPanel isOwner />

      <div className="mt-6">
        <FolderRoutingPanel entries={routing} />
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/dashboard?team=${team.id}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              team.id === activeTeam.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {team.name}
          </Link>
        ))}
      </div>

      <h2 className="mt-4 mb-3 text-sm font-semibold text-foreground">
        {activeTeam.name} Team: Recent Google Workspace Documents
      </h2>
      <TeamDocumentsBoard columns={columns} owners={owners} />
    </div>
  );
}
