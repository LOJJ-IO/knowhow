import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { LogoMark, sohne } from "@/components/brand/logo-mark";

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
      <span
        className={`${sohne.className} absolute top-4 left-4 sm:top-6 sm:left-6 inline-flex items-center gap-2 text-[clamp(3.5rem,12.5vw,12.5rem)] leading-none tracking-tight text-[#1c1917]`}
      >
        Kn
        <LogoMark className="size-[0.62em] h-[0.71em] w-[0.62em]" />
        how
      </span>
    </div>
  );
}
