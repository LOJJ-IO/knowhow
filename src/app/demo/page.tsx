"use client";

import { useEffect } from "react";

import { LoadingMark } from "@/components/brand/loading-mark";
import { BACKEND_API_URL } from "@/lib/backend";

/** Opens the Acme account. The backend signs this browser in and sends it to
 *  Home; `?fresh=1` passes through to start it over. */
export default function DemoPage() {
  useEffect(() => {
    const fresh = new URLSearchParams(window.location.search).get("fresh");
    window.location.replace(`${BACKEND_API_URL}/sandbox/enter${fresh ? "?fresh=1" : ""}`);
  }, []);
  return (
    <div className="flex h-dvh items-center justify-center bg-[var(--app-ground)]">
      <LoadingMark label="Loading" className="w-16" />
    </div>
  );
}
