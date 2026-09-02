"use client";

import Link from "next/link";
import { useActionState } from "react";

import { logIn } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(logIn, undefined);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 flex justify-center text-lg">
        <Logo />
      </div>
      <h1 className="mb-1 text-center text-base font-semibold text-foreground">
        Sign in to Knowhow
      </h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Every document, visible to the people who need it.
      </p>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Work Email</Label>
          <Input id="email" name="email" type="email" placeholder="jane.doe@company.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••" required />
        </div>

        {state?.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <p className="mt-3 text-center text-sm text-muted-foreground">Forgot password?</p>

      <Button variant="outline" size="lg" className="mt-3 w-full" disabled title="Google Workspace integration coming soon">
        Sign in with Google
      </Button>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        Or use <span className="font-medium text-foreground">Single Sign-On</span>
      </p>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </div>
  );
}
