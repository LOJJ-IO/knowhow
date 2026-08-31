import { SharingPolicyRow } from "@/components/settings/sharing-policy-row";
import { requireUser } from "@/lib/auth";
import { getOrgTeams } from "@/lib/queries";

export default async function SettingsPage() {
  const user = await requireUser();
  const teams = await getOrgTeams(user.organizationId);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This is the actual automation: documents get shared automatically, so nothing depends on
        someone remembering to hit Share.
      </p>

      <div className="mt-6 space-y-2">
        {teams.map((team) => (
          <SharingPolicyRow
            key={team.id}
            teamId={team.id}
            teamName={team.name}
            autoShareWithLeader={team.policy?.autoShareWithLeader ?? true}
            autoShareWithOwner={team.policy?.autoShareWithOwner ?? true}
          />
        ))}
      </div>
    </div>
  );
}
