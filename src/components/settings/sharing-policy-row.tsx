"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { updateSharingPolicy } from "@/app/(app)/settings/actions";
import { Switch } from "@/components/ui/switch";

export function SharingPolicyRow({
  teamId,
  teamName,
  autoShareWithLeader,
  autoShareWithOwner,
}: {
  teamId: string;
  teamName: string;
  autoShareWithLeader: boolean;
  autoShareWithOwner: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function toggle(field: "autoShareWithLeader" | "autoShareWithOwner", value: boolean) {
    startTransition(async () => {
      await updateSharingPolicy(teamId, field, value);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <p className="text-sm font-medium text-foreground">{teamName}</p>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Auto-share with leader
          <Switch
            checked={autoShareWithLeader}
            onCheckedChange={(v) => toggle("autoShareWithLeader", v)}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Auto-share with owner
          <Switch
            checked={autoShareWithOwner}
            onCheckedChange={(v) => toggle("autoShareWithOwner", v)}
          />
        </label>
      </div>
    </div>
  );
}
