"use client";
import Link from "next/link";
import { AgentAvatar } from "./AgentAvatar";
import { SkillBadge } from "./SkillBadge";
import { StatusDot } from "./StatusDot";
import { successRate } from "@/lib/utils";
import type { Agent } from "@/types/agent";

interface Props {
  agent: Agent;
}

export function AgentCard({ agent }: Props) {
  const rate = successRate(agent);

  return (
    <Link href={`/agents/${agent.id}`} className="block">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors group cursor-pointer">
        <div className="flex items-start gap-4">
          <AgentAvatar seed={agent.avatar_seed} name={agent.name} status={agent.status} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-100 truncate group-hover:text-brand-500 transition-colors">
                {agent.name}
              </h3>
              <StatusDot status={agent.status} size="sm" />
            </div>
            <p className="text-sm text-gray-400 truncate">{agent.title}</p>
            <p className="text-xs text-gray-600 mt-0.5">{agent.department}</p>
          </div>
        </div>

        {agent.current_task && (
          <div className="mt-3 px-3 py-2 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-400 line-clamp-2">
              <span className="text-amber-400 font-medium">Working: </span>
              {agent.current_task}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
          <span>{agent.task_count.toLocaleString()} tasks</span>
          <span className={rate >= 90 ? "text-emerald-500" : rate >= 75 ? "text-amber-400" : "text-red-400"}>
            {rate}% success
          </span>
        </div>

        {agent.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agent.skills.slice(0, 3).map((s) => (
              <span key={s.id} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-full">
                {s.skill}
              </span>
            ))}
            {agent.skills.length > 3 && (
              <span className="px-2 py-0.5 text-gray-600 text-xs">+{agent.skills.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
