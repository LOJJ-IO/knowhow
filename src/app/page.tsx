import Link from "next/link";

import { Logo } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
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

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="text-lg">
            <Logo />
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get started</Button>
            </Link>
          </nav>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Every document, visible to the people who need it.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            In Google Workspace, documents your team creates aren&apos;t always
            shared with you. Knowhow shares them automatically — to the owner,
            the team leader, or wherever your policy says they should go.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link href="/signup">
              <Button size="lg">Get started</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
          </div>
        </main>

        <footer className="px-6 py-6 text-center text-sm text-muted-foreground sm:px-10">
          Built for teams already living in Google Workspace.
        </footer>
      </div>
    </div>
  );
}
