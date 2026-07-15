"use client";
import { AgentAvatar } from "./AgentAvatar";
import { SkillBadge } from "./SkillBadge";
import { WorkLogFeed } from "./WorkLogFeed";
import { StatusDot } from "./StatusDot";
import { useAgentStream } from "@/lib/ag-ui";
import { successRate } from "@/lib/utils";
import type { Agent } from "@/types/agent";
import Link from "next/link";

interface Props {
  agent: Agent;
}

export function AgentProfile({ agent }: Props) {
  const stream = useAgentStream(agent.id, agent.status);
  const liveStatus = stream.isConnected ? stream.status : agent.status;
  const rate = successRate(agent);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-600 hover:text-gray-300 text-sm transition-colors">
            ← All Agents
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-400 text-sm">{agent.name}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Profile header */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-start gap-6">
            <AgentAvatar seed={agent.avatar_seed} name={agent.name} status={liveStatus} size={96} />
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-100">{agent.name}</h1>
                <StatusDot status={liveStatus} showLabel size="lg" />
              </div>
              <p className="text-gray-400 mt-1">{agent.title}</p>
              <p className="text-sm text-gray-600">{agent.department} · {agent.model}</p>
              {agent.bio && <p className="mt-3 text-gray-300 text-sm leading-relaxed">{agent.bio}</p>}

              <div className="mt-4 flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-100">{agent.task_count.toLocaleString()}</div>
                  <div className="text-gray-600 text-xs">Tasks</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl font-bold ${rate >= 90 ? "text-emerald-500" : "text-amber-400"}`}>{rate}%</div>
                  <div className="text-gray-600 text-xs">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-100">{agent.skills.length}</div>
                  <div className="text-gray-600 text-xs">Skills</div>
                </div>
              </div>
            </div>
          </div>

          {/* Live activity */}
          {stream.isConnected && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </div>
              {stream.currentTool && (
                <p className="text-xs text-amber-400">Using tool: {stream.currentTool}</p>
              )}
              {stream.currentMessage && (
                <p className="text-sm text-gray-300 font-mono">{stream.currentMessage}</p>
              )}
              {agent.current_task && !stream.currentMessage && (
                <p className="text-sm text-gray-400">{agent.current_task}</p>
              )}
            </div>
          )}
        </div>

        {/* Skills */}
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Skills</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agent.skills.map((s) => <SkillBadge key={s.id} skill={s} />)}
          </div>
        </div>

        {/* Work log */}
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Work History</h2>
          <WorkLogFeed entries={agent.recent_work ?? []} />
        </div>

        {/* Communications */}
        {(agent.recent_comms?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Recent Communications</h2>
            <div className="space-y-3">
              {agent.recent_comms!.map((c) => (
                <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <span>{c.from_agent_name ?? "Human"}</span>
                    <span>→</span>
                    <span>{c.to_agent_name ?? "Human"}</span>
                    <span className="ml-auto">
                      {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{c.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
