import type { ChangeEvent, OverviewMember } from "@/lib/organization";

/** How a change reads, shared by Home's team cards and Notifications so the
 *  two can never word the same update differently. */

/** Audit action types read as machine strings. This turns the ones the app
 *  actually produces into a sentence, and falls back to a tidied version of
 *  the raw type for anything new — a feed that counts every action type must
 *  not render blanks for the ones it hasn't met yet. */
const ACTIONS: Record<string, string> = {
  "org_chart.team.created": "Team created",
  "org_chart.team.edited": "Team renamed",
  "org_chart.team.deleted": "Team deleted",
  "org_chart.team.leader_assigned": "Lead assigned",
  "org_chart.membership.upserted": "Someone joined",
  "org_chart.membership.removed": "Someone left",
  "org_chart.member_offboarded": "Member offboarded",
  "offboard.completed": "Offboarding completed",
  "transfer_batch.created": "Transfer planned",
  "transfer_batch.executed": "Ownership moved",
  "transfer_batch.reversed": "Transfer reversed",
  "sharing.file_created_handled": "Document created",
  "sharing.suggested_share_created": "Access suggested",
  "sharing.suggested_share_confirmed": "Access granted",
  "sharing.reassignment_requested": "Ownership requested",
  "sharing.reassignment_confirmed": "Ownership reassigned",
};

export function describeChange(
  event: ChangeEvent,
  membersById: Map<string, OverviewMember>,
): string {
  const what =
    ACTIONS[event.action] ??
    event.action.split(".").slice(-1)[0].replace(/_/g, " ");
  const actor = event.actorMemberId
    ? membersById.get(event.actorMemberId)
    : undefined;
  const who = actor?.displayName ?? actor?.email;
  return who ? `${what} · ${who}` : what;
}

export function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
