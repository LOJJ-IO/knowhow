import { createTeam } from "@/app/(app)/org-chart/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import { getOrgOwner, getOrgTeams } from "@/lib/queries";
import Link from "next/link";

export default async function OrgChartPage() {
  const user = await requireUser();
  const owner = await getOrgOwner(user.organizationId);
  const teams = await getOrgTeams(user.organizationId);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-lg font-semibold text-foreground">Build Your Organization Chart</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Define the owner, create teams, and assign a leader to each.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Step 1: Organization Owner</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
            {owner.name.slice(0, 1)}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{owner.name}</p>
            <p className="text-xs text-muted-foreground">{owner.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Step 2: Teams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet — create the first one below.</p>
          ) : (
            <ul className="space-y-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.leader ? `Led by ${team.leader.name}` : "No leader assigned"} ·{" "}
                      {team.members.length} member{team.members.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link href={`/team/${team.id}/people`}>
                    <Button variant="outline" size="sm">
                      Manage people
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <form action={createTeam} className="flex gap-2 pt-2">
            <Input name="name" placeholder="New team name (e.g. Marketing)" required />
            <Button type="submit">Create New Team</Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end">
        <Link href="/dashboard">
          <Button size="lg">Save and Continue to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
