"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AgentAvatar } from "./AgentAvatar";
import { successRate, cn } from "@/lib/utils";
import type { Agent } from "@/types/agent";

export function AgentCard({ agent }: { agent: Agent }) {
  const rate = successRate(agent);
  const busy = agent.status === "active" || agent.status === "thinking";

  return (
    <Link href={`/agents/${agent.id}`} className="group block h-full">
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised">
        {busy && (
          <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-2xs font-medium text-warning">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
            {agent.status === "thinking" ? "Thinking" : "Working"}
          </span>
        )}
        <div className="flex items-start gap-3.5">
          <AgentAvatar seed={agent.avatar_seed} url={agent.avatar_url} name={agent.name} status={agent.status} size={52} />
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="flex items-center gap-1 truncate font-display text-[0.95rem] font-semibold text-content">
              {agent.name}
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-content-subtle opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
            </h3>
            <p className="truncate text-sm text-content-muted">{agent.title}</p>
            <p className="mt-0.5 text-2xs uppercase tracking-wide text-content-subtle">{agent.department}</p>
          </div>
        </div>

        {agent.current_task && (
          <div className="mt-3 rounded-lg border border-line bg-surface-inset px-3 py-2">
            <p className="line-clamp-2 text-xs text-content-muted">
              <span className="font-medium text-warning">Now: </span>
              {agent.current_task}
            </p>
          </div>
        )}

        {agent.skills.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {agent.skills.slice(0, 3).map((s) => (
              <span key={s.id} className="rounded-md border border-line bg-white/[0.03] px-2 py-0.5 text-2xs text-content-muted">
                {s.skill}
              </span>
            ))}
            {agent.skills.length > 3 && (
              <span className="px-1 py-0.5 text-2xs text-content-subtle">+{agent.skills.length - 3}</span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5 text-xs text-content-subtle">
          <span className="tabular-nums">{agent.task_count.toLocaleString()} tasks</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              rate >= 90 ? "text-positive" : rate >= 75 ? "text-warning" : rate > 0 ? "text-danger" : "text-content-subtle"
            )}
          >
            {agent.task_count ? `${rate}% success` : "No runs yet"}
          </span>
        </div>
      </div>
    </Link>
  );
}
