/** The customer survey's answers (`/survey`, [[FEAT-customer-survey]]). One
 *  list of columns, shared by the page that collects them and the Server
 *  Action that forwards them, so a sheet's header row never drifts from what
 *  the page sends. Order here is column order. */
export const SURVEY_FIELDS = [
  "manages_team",
  "suite",
  "sharing_struggle",
  "sorting_struggle",
  "offboarding_struggle",
  "would_use",
  "pay_1800",
  "price_per_year",
  "why_not",
  "current_tools",
  "magic_wand",
  "name",
  "organization",
  "email",
  /** `?ref=` on the survey link: who the email went to, so follow-ups only
   *  go to people who haven't answered. */
  "ref",
  /** One per browser: a resend after a failed or lost reply updates the same
   *  row instead of adding a second. */
  "response_id",
  /** "yes" once they reach Send; blank means they stopped partway, and the
   *  row holds what they answered up to then. */
  "completed",
] as const;

export type SurveyField = (typeof SURVEY_FIELDS)[number];

export type SurveyResponse = Partial<Record<SurveyField, string>>;
