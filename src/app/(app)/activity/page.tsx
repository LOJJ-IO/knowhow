import {
  UserPlus,
  UserMinus,
  Share2,
  FileOutput,
  ShieldOff,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getRecentActivity } from "@/lib/queries";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { icon: typeof UserPlus; tone: string }> = {
  ONBOARDED: { icon: UserPlus, tone: "text-success" },
  OFFBOARDED: { icon: UserMinus, tone: "text-destructive" },
  DOC_AUTO_SHARED: { icon: Share2, tone: "text-foreground" },
  DOC_REASSIGNED: { icon: FileOutput, tone: "text-foreground" },
  ACCESS_REVOKED: { icon: ShieldOff, tone: "text-destructive" },
};

export default async function ActivityPage() {
  const user = await requireUser();
  const events = await getRecentActivity(user.organizationId);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-lg font-semibold text-foreground">Activity</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every automated onboarding, offboarding, and sharing action Knowhow has taken.
      </p>

      <ol className="mt-6 space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          events.map((event) => {
            const meta = TYPE_META[event.type] ?? { icon: Share2, tone: "text-foreground" };
            const Icon = meta.icon;
            return (
              <li key={event.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                <Icon className={cn("mt-0.5 size-4 shrink-0", meta.tone)} />
                <div>
                  <p className="text-sm text-foreground">{event.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.createdAt.toLocaleString()}
                  </p>
                </div>
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}
