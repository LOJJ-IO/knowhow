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
  "onboarding.team_lead_claimed": "Team lead claimed",
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
  "offboard.file.ownership_transferred": "File handed over",
  "offboard.file.unresolved_ownership": "File needs moving by hand",
  "document.created": "Document created",
  "librarian.confirmed_company": "Filed as company work",
  "librarian.imported_personal": "Files brought in",
  "ownership.unresolved_cleared": "Moved by hand",
  "document.renamed": "File renamed",
  "document.trashed": "File moved to Trash",
  "document.restored": "File restored",
  "folder.renamed": "Folder renamed",
  "folder.deleted": "Folder deleted",
};

/** An audit action as words: the sentence above, or the tidied raw type. */
export function actionLabel(action: string): string {
  const raw = action.split(".").slice(-1)[0].replace(/_/g, " ");
  return ACTIONS[action] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Joins and leaves name the person they were about instead of "Someone"
 *  (user 2026-09-27): "Ada Lovelace left". */
const SUBJECT_VERBS: Record<string, string> = {
  "org_chart.membership.upserted": "joined",
  "org_chart.membership.removed": "left",
};

/** A created file says its type, the same words as the New menu (Ronald
 *  2026-10-04). Older entries without a kind stay "Document created". */
const CREATED_KINDS: Record<string, string> = {
  doc: "Document created",
  sheet: "Spreadsheet created",
  slide: "Presentation created",
  form: "Form created",
};

/** A change split for the dot line: what happened, and who did it when
 *  that's worth saying ("Ada left · Ada" says it twice, so the actor is
 *  only named when it was someone else). */
export function changeParts(
  event: ChangeEvent,
  membersById: Map<string, OverviewMember>,
): { what: string; actor: OverviewMember | null } {
  const member = (id: string | null) => (id ? membersById.get(id) : undefined);
  const subjectMember = SUBJECT_VERBS[event.action]
    ? member(event.subjectMemberId)
    : undefined;
  const subject = subjectMember?.displayName ?? subjectMember?.email;
  const created =
    event.action === "document.created" && event.kind
      ? CREATED_KINDS[event.kind]
      : undefined;
  const what = subject
    ? `${subject} ${SUBJECT_VERBS[event.action]}`
    : (created ?? actionLabel(event.action));
  const actor = member(event.actorMemberId) ?? null;
  if (subject && event.actorMemberId === event.subjectMemberId)
    return { what, actor: null };
  return { what, actor };
}

export function describeChange(
  event: ChangeEvent,
  membersById: Map<string, OverviewMember>,
): string {
  const { what, actor } = changeParts(event, membersById);
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
