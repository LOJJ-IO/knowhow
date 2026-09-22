import { EmptyScreen } from "@/components/app/empty-screen";

export default function SearchPage() {
  return (
    <EmptyScreen
      href="/search"
      title="Search your organization"
      description="Type to find any document your teams own, across every team you can see. There is nothing to search until documents are synced."
    />
  );
}
