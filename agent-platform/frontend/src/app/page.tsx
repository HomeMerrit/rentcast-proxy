import { redirect } from "next/navigation";
import { TeamDashboard } from "@/components/TeamDashboard";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const agents = await api.agents.list().catch(() => []);
  // First run → guide the user through onboarding.
  if (agents.length === 0) redirect("/onboarding");
  return <TeamDashboard agents={agents} />;
}
