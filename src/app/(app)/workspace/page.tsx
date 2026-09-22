import { EmptyScreen } from "@/components/app/empty-screen";

export default function WorkspacePage() {
  return (
    <EmptyScreen
      href="/workspace"
      title="No documents yet"
      description="Once your Google Workspace is connected, every document your teams own appears here instead of being scattered across personal drives."
    />
  );
}
