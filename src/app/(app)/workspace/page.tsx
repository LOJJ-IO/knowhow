import { Suspense } from "react";

import { WorkspaceScreen } from "@/components/app/screens/workspace-screen";

export default function WorkspacePage() {
  // useSearchParams (?librarian= from Notifications) needs a Suspense boundary.
  return (
    <Suspense>
      <WorkspaceScreen />
    </Suspense>
  );
}
