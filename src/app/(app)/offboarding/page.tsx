import { EmptyScreen } from "@/components/app/empty-screen";

export default function OffboardingPage() {
  return (
    <EmptyScreen
      href="/offboarding"
      title="Nobody is being offboarded"
      description="When someone leaves, this is where you see everything they created and hand it to the organization in one move, before their access ends."
    />
  );
}
