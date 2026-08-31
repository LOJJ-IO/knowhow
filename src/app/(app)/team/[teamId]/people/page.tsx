import { PeopleManager } from "@/components/team/people-manager";
import { requireUser } from "@/lib/auth";
import { getTeamWithRoster } from "@/lib/queries";

export default async function TeamPeoplePage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const user = await requireUser();
  const { teamId } = await params;
  const team = await getTeamWithRoster(user.organizationId, teamId);

  const roster = [
    ...(team.leader
      ? [{ ...team.leader, isLeader: true }]
      : []),
    ...team.members
      .filter((m) => m.id !== team.leaderId)
      .map((m) => ({ ...m, isLeader: false })),
  ];

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-lg font-semibold text-foreground">{team.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add or offboard people — every change here drives Google Workspace access automatically.
      </p>

      <div className="mt-6">
        <PeopleManager teamId={team.id} roster={roster} />
      </div>
    </div>
  );
}
