import type { Metadata } from "next";

import { SurveyFlow } from "@/components/survey/survey-flow";

export const metadata: Metadata = {
  title: "Knohow survey",
  description: "Help us build Knohow for non-profits.",
  // Reached from the survey email, not from search.
  robots: { index: false, follow: false },
};

export default function SurveyPage() {
  return <SurveyFlow />;
}
