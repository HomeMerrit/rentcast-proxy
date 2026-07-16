"use client";
import { useState, useRef, useEffect } from "react";
import { AgentAvatar } from "./AgentAvatar";
import { SkillBadge } from "./SkillBadge";
import { WorkLogFeed } from "./WorkLogFeed";
import { StatusDot } from "./StatusDot";
import { useAgentStream } from "@/lib/ag-ui";
import { successRate } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Agent, AGUIEvent, AGUIEventType, Memory } from "@/types/agent";
import Link from "next/link";

interface Props {
  agent: Agent;
}

// ── Color maps for event log ──────────────────────────────────────────────────

const EVENT_TEXT: Partial<Record<AGUIEventType, string>> = {
  RUN_STARTED: "text-blue-400",
  RUN_FINISHED: "text-emerald-400",
  RUN_ERROR: "text-red-400",
  TEXT_MESSAGE_START: "text-emerald-300",
  TEXT_MESSAGE_CONTENT: "text-emerald-300",
  TEXT_MESSAGE_END: "text-emerald-300",
  TOOL_CALL_START: "text-amber-400",
  TOOL_CALL_ARGS: "text-amber-300",
  TOOL_CALL_END: "text-amber-400",
  TOOL_CALL_RESULT: "text-cyan-500",
  STATE_SNAPSHOT: "text-gray-400",
  STATE_DELTA: "text-gray-400",
  CUSTOM: "text-purple-500",
};

function eventTextColor(type: AGUIEventType): string {
  return EVENT_TEXT[type] ?? "text-gray-400";
}

function describeEvent(event: AGUIEvent): string {
  const d = event.data;
  switch (event.type) {
    case "RUN_STARTED":
      return `Started: ${(d.task_type as string) || "task"}`;
    case "RUN_FINISHED":
      return `Finished (${(d.tokens_used as number) || 0} tokens)`;
    case "RUN_ERROR":
      return `Error: ${(d.error as string) || "unknown"}`;
    case "TEXT_MESSAGE_START":
      return "Thinking...";
    case "TEXT_MESSAGE_CONTENT":
      return "Generating response";
    case "TEXT_MESSAGE_END":
      return "Response complete";
    case "TOOL_CALL_START":
      return `Calling tool: ${(d.tool_name as string) || ""}`;
    case "TOOL_CALL_RESULT":
      return `Tool result: ${((d.result as string) || "").slice(0, 60)}`;
    case "TOOL_CALL_END":
      return "Tool call complete";
    case "STATE_SNAPSHOT":
      return `Status → ${(d.status as string) || ""}`;
    case "STATE_DELTA":
      return `Status → ${(d.status as string) || ""}`;
    case "CUSTOM":
      if (d.subtype === "REFLECTION") return "Reflecting on task...";
      if (d.subtype === "MEMORY_RETRIEVED")
        return `Retrieved ${(d.count as number) || 0} memories`;
      return `Custom: ${(d.subtype as string) || ""}`;
    default:
      return event.type;
  }
}

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Memories Panel ────────────────────────────────────────────────────────────

function MemoriesPanel({ agentId }: { agentId: string }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.memories
      .list(agentId)
      .then(setMemories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  const handleSearch = async (q: string) => {
    if (!q.trim()) {
      api.memories.list(agentId).then(setMemories);
      return;
    }
    const results = await api.memories.search(agentId, q).catch(() => []);
    setMemories(results);
  };

  const handleDelete = async (memoryId: string) => {
    await api.memories.delete(agentId, memoryId).catch(() => {});
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search memories semantically..."
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          handleSearch(e.target.value);
        }}
      />

      {/* Memory list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading memories...</p>
      ) : memories.length === 0 ? (
        <p className="text-sm text-gray-400">
          No memories yet. Memories are stored automatically after each task.
        </p>
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <div
              key={m.id}
              className="flex gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {m.content}
                </p>
                <div className="mt-1 flex gap-2 text-xs text-gray-400">
                  {m.task_type && (
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5">
                      {m.task_type}
                    </span>
                  )}
                  {m.score !== undefined && (
                    <span>score: {m.score.toFixed(2)}</span>
                  )}
                  <span>{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="shrink-0 text-gray-300 hover:text-red-400 transition-colors text-sm"
                title="Delete memory"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentProfile({ agent }: Props) {
  const {
    events,
    currentMessage,
    currentTool,
    retrievedMemories,
    status,
    isConnected,
    lastActivity,
  } = useAgentStream(agent.id, agent.status);
  const liveStatus = isConnected ? status : agent.status;
  const rate = successRate(agent);

  // Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "memories">(
    "overview"
  );

  // Run Task form
  const [showForm, setShowForm] = useState(false);
  const [taskType, setTaskType] = useState("");
  const [taskInput, setTaskInput] = useState('{"topic": ""}');
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recent events: last 20, newest first
  const recentEvents = [...events].reverse().slice(0, 20);

  const isAgentBusy = liveStatus === "active" || liveStatus === "thinking";

  function openForm() {
    setShowForm(true);
    setRunError(null);
  }
  function closeForm() {
    setShowForm(false);
    setRunError(null);
  }

  async function handleRunTask(e: React.FormEvent) {
    e.preventDefault();
    setRunError(null);

    let parsedInput: Record<string, unknown> = {};
    try {
      parsedInput = JSON.parse(taskInput);
    } catch {
      setRunError("Invalid JSON in task input");
      return;
    }
    if (!taskType.trim()) {
      setRunError("Task type is required");
      return;
    }

    setSubmitting(true);
    try {
      await api.agents.run(agent.id, taskType.trim(), parsedInput);
      closeForm();
      setTaskType("");
      setTaskInput('{"topic": ""}');
      setQueued(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setQueued(false), 4000);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to queue task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Success toast */}
      {queued && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-sm px-4 py-3 rounded-lg shadow-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          Task queued successfully!
        </div>
      )}

      {/* Breadcrumb */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-300 text-sm transition-colors"
          >
            ← All Agents
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-400 text-sm">{agent.name}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* ── Profile header card ───────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-start gap-6">
            <AgentAvatar
              seed={agent.avatar_seed}
              name={agent.name}
              status={liveStatus}
              size={96}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-100">{agent.name}</h1>
                <StatusDot status={liveStatus} showLabel size="lg" />
              </div>
              <p className="text-gray-400 mt-1">{agent.title}</p>
              <p className="text-sm text-gray-600">
                {agent.department} · {agent.model}
              </p>
              {agent.bio && (
                <p className="mt-3 text-gray-300 text-sm leading-relaxed">
                  {agent.bio}
                </p>
              )}

              <div className="mt-4 flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-100">
                    {agent.task_count.toLocaleString()}
                  </div>
                  <div className="text-gray-600 text-xs">Tasks</div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-xl font-bold ${
                      rate >= 90 ? "text-emerald-500" : "text-amber-400"
                    }`}
                  >
                    {rate}%
                  </div>
                  <div className="text-gray-600 text-xs">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-100">
                    {agent.skills.length}
                  </div>
                  <div className="text-gray-600 text-xs">Skills</div>
                </div>
              </div>
            </div>

            {/* Run Task button */}
            <div className="flex-shrink-0">
              {showForm ? (
                <button
                  onClick={closeForm}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={openForm}
                  disabled={isAgentBusy}
                  title={isAgentBusy ? "Agent is currently busy" : "Queue a new task"}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isAgentBusy ? "Agent busy…" : "Run Task"}
                </button>
              )}
            </div>
          </div>

          {/* ── Run Task inline form ────────────────────────────────────── */}
          {showForm && (
            <form
              onSubmit={handleRunTask}
              className="mt-5 pt-5 border-t border-gray-800 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Task Type
                </label>
                <input
                  type="text"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  placeholder="research, analyze, write..."
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Task Input{" "}
                  <span className="text-gray-700 font-normal">(JSON)</span>
                </label>
                <textarea
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder='{"topic": "AI trends"}'
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-colors resize-none"
                />
              </div>
              {runError && (
                <p className="text-red-400 text-xs">{runError}</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting || !taskType.trim()}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {submitting ? "Queueing…" : "Queue Task"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Tab navigation ────────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          {(["overview", "activity", "memories"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab === "activity"
                ? "Live Activity"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Overview tab ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* Skills */}
            {agent.skills.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-200 mb-4">Skills</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {agent.skills.map((s) => (
                    <SkillBadge key={s.id} skill={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Work History */}
            <div>
              <h2 className="text-lg font-semibold text-gray-200 mb-4">Work History</h2>
              <WorkLogFeed entries={agent.recent_work ?? []} />
            </div>

            {/* Recent Communications */}
            {(agent.recent_comms?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-200 mb-4">
                  Recent Communications
                </h2>
                <div className="space-y-3">
                  {agent.recent_comms!.map((c) => (
                    <div
                      key={c.id}
                      className="bg-gray-900 border border-gray-800 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span>{c.from_agent_name ?? "Human"}</span>
                        <span>→</span>
                        <span>{c.to_agent_name ?? "Human"}</span>
                        <span className="ml-auto">
                          {new Date(c.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{c.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Live Activity tab ─────────────────────────────────────────── */}
        {activeTab === "activity" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2.5">
              <span className="relative flex flex-shrink-0">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                )}
                <span
                  className={`relative inline-flex rounded-full w-2 h-2 ${
                    isConnected ? "bg-emerald-500" : "bg-gray-600"
                  }`}
                />
              </span>
              <h2 className="text-sm font-semibold text-gray-200">Live Activity</h2>
              <span className="text-xs text-gray-600">
                {isConnected ? "Connected" : "Connecting…"}
              </span>
              {lastActivity && (
                <span className="ml-auto text-xs text-gray-700">
                  Last: {timeLabel(lastActivity)}
                </span>
              )}
            </div>

            {/* Retrieved memories */}
            {retrievedMemories.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-800">
                <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3">
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                    Retrieved {retrievedMemories.length} relevant memories
                  </p>
                  <ul className="space-y-1">
                    {retrievedMemories.map((m, i) => (
                      <li
                        key={i}
                        className="text-xs text-purple-600 dark:text-purple-400 truncate"
                      >
                        • {m}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Streaming message bubble */}
            {currentMessage && (
              <div className="px-5 py-4 bg-gray-950 border-b border-gray-800">
                <p className="text-xs text-emerald-600 font-medium mb-2 tracking-wider">
                  STREAMING
                </p>
                <p className="text-sm text-emerald-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {currentMessage}
                  <span className="animate-pulse">▋</span>
                </p>
              </div>
            )}

            {/* Active tool chip */}
            {currentTool && !currentMessage && (
              <div className="px-5 py-3 border-b border-gray-800">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full border border-amber-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  Using tool: {currentTool}
                </span>
              </div>
            )}

            {/* Static current_task (only when no live message/tool) */}
            {!currentMessage && !currentTool && agent.current_task && (
              <div className="px-5 py-3 border-b border-gray-800">
                <p className="text-xs text-gray-500 italic">{agent.current_task}</p>
              </div>
            )}

            {/* Event log */}
            <div className="max-h-64 overflow-y-auto">
              {recentEvents.length === 0 ? (
                <div className="px-5 py-10 text-center text-xs text-gray-700">
                  {isConnected
                    ? "Waiting for activity…"
                    : "Connecting to stream…"}
                </div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {recentEvents.map((ev, i) => (
                    <div
                      key={i}
                      className="px-5 py-2 flex items-start gap-3 text-xs hover:bg-gray-800/20 transition-colors"
                    >
                      <span className="text-gray-700 font-mono flex-shrink-0 mt-px tabular-nums">
                        {timeLabel(ev.timestamp)}
                      </span>
                      <span
                        className={`flex-shrink-0 font-mono font-semibold mt-px ${eventTextColor(ev.type)}`}
                      >
                        {ev.type}
                      </span>
                      <span className="text-gray-500 truncate mt-px">
                        {describeEvent(ev)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Memories tab ──────────────────────────────────────────────── */}
        {activeTab === "memories" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Memories</h2>
            <MemoriesPanel agentId={agent.id} />
          </div>
        )}

      </div>
    </div>
  );
}
