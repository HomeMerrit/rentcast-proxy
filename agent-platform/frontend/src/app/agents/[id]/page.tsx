import { AgentProfile } from "@/components/AgentProfile";
import { mockAgents } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export default function AgentPage({ params }: { params: { id: string } }) {
  const agent = mockAgents.find((a) => a.id === params.id);
  if (!agent) return notFound();
  return <AgentProfile agent={agent} />;
}

export function generateStaticParams() {
  return mockAgents.map((a) => ({ id: a.id }));
}
