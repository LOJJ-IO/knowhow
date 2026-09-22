import { EmptyScreen } from "@/components/app/empty-screen";

export default function SettingsPage() {
  return (
    <EmptyScreen
      href="/settings"
      title="No settings yet"
      description="How Knohow behaves for your organization will be set here. Nothing is configurable while the workspace connection is still being built."
    />
  );
}
