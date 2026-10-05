import { Suspense } from "react";

import { OwnershipScreen } from "@/components/app/screens/ownership-screen";

export default function OwnershipPage() {
  // useSearchParams (a Notifications link's ?param) needs a Suspense boundary.
  return (
    <Suspense>
      <OwnershipScreen />
    </Suspense>
  );
}
