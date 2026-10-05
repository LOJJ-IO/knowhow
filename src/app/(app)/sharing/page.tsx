import { Suspense } from "react";

import { SharingScreen } from "@/components/app/screens/sharing-screen";

export default function SharingPage() {
  // useSearchParams (a Notifications link's ?param) needs a Suspense boundary.
  return (
    <Suspense>
      <SharingScreen />
    </Suspense>
  );
}
