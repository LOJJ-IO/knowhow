import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  await requireUser();
  return null;
}
