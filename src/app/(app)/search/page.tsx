import { Suspense } from "react";

import { SearchScreen } from "@/components/app/screens/search-screen";

export default function SearchPage() {
  // useSearchParams (the ?q= in the URL) needs a Suspense boundary.
  return (
    <Suspense>
      <SearchScreen />
    </Suspense>
  );
}
