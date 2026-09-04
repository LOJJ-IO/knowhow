import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <video
        className="absolute inset-0 -z-10 size-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster="/hero/onboarding-loop-poster.jpg"
      >
        <source src="/hero/onboarding-loop.webm" type="video/webm" />
        <source src="/hero/onboarding-loop.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
