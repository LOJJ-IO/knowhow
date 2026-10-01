"use client";

import { useEffect, useState } from "react";

import { SignInSheet } from "@/components/login/sign-in-sheet";
import {
  SetupAction,
  SetupBody,
  SetupHeading,
} from "@/components/setup/shell";
import { ResultMark } from "@/components/setup/sign-in-result";
import { siteUrl } from "@/lib/origins";

/** 404s (user 2026-09-29): the sign-in card's X screen on the same sky,
 *  instead of Next's default page. The card grows in a beat after the
 *  sheet, like the front door's. */
export function NotFoundCard() {
  const [cardOpen, setCardOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCardOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const home = () => window.location.assign(siteUrl("/"));
  return (
    <SignInSheet open atTop cardOpen={cardOpen} onClose={home}>
      <div>
        <ResultMark kind="cross" />
        <SetupHeading>This page doesn’t exist</SetupHeading>
        <SetupBody>Check the address, or head back home.</SetupBody>
        <SetupAction label="Go home" onClick={home} />
      </div>
    </SignInSheet>
  );
}
