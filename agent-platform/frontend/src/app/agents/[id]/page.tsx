import { AgentProfile } from "@/components/AgentProfile";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";

// Next.js 15: params is a Promise
export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await api.agents.get(id).catch(() => null);
  if (!agent) return notFound();
  return <AgentProfile agent={agent} />;
}
