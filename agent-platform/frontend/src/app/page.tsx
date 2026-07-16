import { TeamDashboard } from "@/components/TeamDashboard";
import { api } from "@/lib/api";

export default async function Home() {
  const agents = await api.agents.list().catch(() => []);
  return <TeamDashboard agents={agents} />;
}
