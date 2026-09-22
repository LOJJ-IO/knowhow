import { EmptyScreen } from "@/components/app/empty-screen";

export default function OrgChartPage() {
  return (
    <EmptyScreen
      href="/org-chart"
      title="No teams yet"
      description="Your teams and their leads live here. Ownership and access follow this chart, so it is worth keeping it the way the company actually works."
    />
  );
}
