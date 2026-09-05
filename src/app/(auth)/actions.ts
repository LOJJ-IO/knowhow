"use server";

import { redirect } from "next/navigation";

import { destroySession } from "@/lib/session";

export type ActionState = { error?: string } | undefined;

export async function signUp(
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  return { error: "Sign-up is unavailable — database has been removed." };
}

export async function logIn(
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  return { error: "Sign-in is unavailable — database has been removed." };
}

export async function logOut() {
  await destroySession();
  redirect("/login");
}

export async function viewAs(_userId: string) {
  redirect("/login");
}
