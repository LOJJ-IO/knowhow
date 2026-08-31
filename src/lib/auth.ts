import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
