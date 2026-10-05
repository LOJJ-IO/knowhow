import { Suspense } from "react";

import { OffboardingScreen } from "@/components/app/screens/offboarding-screen";

export default function OffboardingPage() {
  // useSearchParams (a Notifications link's ?param) needs a Suspense boundary.
  return (
    <Suspense>
      <OffboardingScreen />
    </Suspense>
  );
}
