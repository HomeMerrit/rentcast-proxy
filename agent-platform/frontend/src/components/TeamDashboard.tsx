import Link from "next/link";
import { Plus, Activity } from "lucide-react";
import { AgentCard } from "./AgentCard";
import { Logo } from "./brand/Logo";
import HumanInbox from "./HumanInbox";
import type { Agent } from "@/types/agent";

interface Props {
  agents: Agent[];
}

export function TeamDashboard({ agents }: Props) {
  const active = agents.filter((a) => a.status === "active" || a.status === "thinking").length;
  const totalTasks = agents.reduce((s, a) => s + (a.task_count || 0), 0);
  const totalSuccess = agents.reduce((s, a) => s + (a.success_count || 0), 0);
  const successRate = totalTasks ? Math.round((totalSuccess / totalTasks) * 100) : 0;

  return (
    <div className="app-backdrop min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-2xs font-medium text-positive sm:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
              </span>
              {active} active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <HumanInbox />
            <Link
              href="/agents/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-iris-gradient px-3.5 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(237,113,80,0.8)] transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" /> New agent
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Your workforce</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-content sm:text-3xl">
              AI Team
            </h1>
            <p className="mt-1 text-sm text-content-muted">
              Working around the clock — open any agent to see them think, act and learn.
            </p>
          </div>
          <div className="flex gap-2.5">
            <Stat label="Agents" value={agents.length} />
            <Stat label="Tasks" value={totalTasks} />
            <Stat label="Success" value={`${successRate}%`} accent />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, i) => (
            <div key={agent.id} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
              <AgentCard agent={agent} />
            </div>
          ))}
          <Link
            href="/agents/new"
            className="group flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-white/[0.01] text-content-subtle transition-all hover:border-iris-400/50 hover:bg-iris-500/[0.04] hover:text-iris-300"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04] transition-colors group-hover:bg-iris-soft">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium">Hire another agent</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2 text-center">
      <p className={`font-display text-lg font-semibold tabular-nums ${accent ? "text-gradient" : "text-content"}`}>
        {value}
      </p>
      <p className="flex items-center justify-center gap-1 text-2xs text-content-subtle">
        {label === "Success" && <Activity className="h-2.5 w-2.5" />}
        {label}
      </p>
    </div>
  );
}
