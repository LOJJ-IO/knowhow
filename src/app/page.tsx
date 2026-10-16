import type { Metadata } from "next";
import { LandingHero } from "@/components/brand/landing-hero";

export const metadata: Metadata = {
  title: "Knohow",
  description:
    "Knohow helps organizations take control of Google Workspace files — team folders, sharing rules, ownership, and offboarding. Learn more on our About page without signing in.",
};

export default function LandingPage() {
  return <LandingHero />;
}
