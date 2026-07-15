"use client";
import { AgentCard } from "./AgentCard";
import { mockAgents } from "@/lib/mock-data";

export function TeamDashboard() {
  const active = mockAgents.filter((a) => a.status === "active" || a.status === "thinking").length;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-gray-100">AgentOS</span>
            <span className="px-2 py-0.5 text-xs bg-brand-900/60 text-brand-500 border border-brand-500/30 rounded-full">
              {active} active
            </span>
          </div>
          <div className="text-sm text-gray-600">{mockAgents.length} agents</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Your AI Team</h1>
          <p className="text-gray-500 mt-1 text-sm">Working 24/7 — click any agent to see their profile</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </main>
    </div>
  );
}
