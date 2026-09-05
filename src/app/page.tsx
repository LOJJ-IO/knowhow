import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { LandingHero } from "@/components/brand/landing-hero";

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return <LandingHero />;
}
