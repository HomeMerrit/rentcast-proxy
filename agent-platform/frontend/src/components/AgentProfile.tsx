"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Zap, Check } from "lucide-react";
import { avatarHue } from "./AgentAvatar";
import type { ApeStatus } from "@/components/world/ApeAgent.types";
import { jerseyNumberOf } from "@/components/world/ApeAgentModel";
import { SkillBadge } from "./SkillBadge";
import { WorkLogFeed } from "./WorkLogFeed";
import { StatusDot } from "./StatusDot";
import { RunTaskDialog } from "./RunTaskDialog";
import { GrowthPanel } from "./Growth";
import { useAgentStream } from "@/lib/ag-ui";
import { successRate } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Agent, AGUIEvent, AGUIEventType, Memory, EvalResult, EvalSummary, AgentConfigInfo, AgentStatus } from "@/types/agent";
import Link from "next/link";

const ApeTurntable = dynamic(
  () => import("@/components/world/ApeTurntable").then((m) => m.ApeTurntable),
  { ssr: false },
);

const APE_STATUS: Record<AgentStatus, ApeStatus> = {
  active: "working", thinking: "thinking", idle: "idle", error: "error", offline: "waiting",
};

interface Props {
  agent: Agent;
}

// ── Color maps for event log (warm brand tokens only) ─────────────────────────

const EVENT_TEXT: Partial<Record<AGUIEventType, string>> = {
  RUN_STARTED: "text-aqua-400",
  RUN_FINISHED: "text-positive",
  RUN_ERROR: "text-danger",
  TEXT_MESSAGE_START: "text-positive",
  TEXT_MESSAGE_CONTENT: "text-positive",
  TEXT_MESSAGE_END: "text-positive",
  TOOL_CALL_START: "text-warning",
  TOOL_CALL_ARGS: "text-warning",
  TOOL_CALL_END: "text-warning",
  TOOL_CALL_RESULT: "text-aqua",
  STATE_SNAPSHOT: "text-content-muted",
  STATE_DELTA: "text-content-muted",
  CUSTOM: "text-iris-400",
};

function eventTextColor(type: AGUIEventType): string {
  return EVENT_TEXT[type] ?? "text-content-muted";
}

function describeEvent(event: AGUIEvent): string {
  const d = event.data;
  switch (event.type) {
    case "RUN_STARTED":
      return `Started: ${(d.task_type as string) || "task"}`;
    case "RUN_FINISHED":
      return "Finished the job";
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
      if (d.subtype === "A2A_SENT")
        return `Sent task to ${(d.to_agent as string) || "agent"}`;
      if (d.subtype === "HUMAN_NOTIFIED")
        return `Notified human: ${((d.message_preview as string) || "").slice(0, 60)}`;
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
        placeholder="Search memories…"
        className="w-full rounded-lg border border-line bg-surface-inset px-3 py-2 text-sm text-content placeholder:text-content-subtle outline-none focus:border-iris-400/60"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          handleSearch(e.target.value);
        }}
      />

      {/* Memory list */}
      {loading ? (
        <p className="text-sm text-content-muted">Loading memories…</p>
      ) : memories.length === 0 ? (
        <p className="text-sm text-content-muted">
          No memories yet. They remember what matters after each job.
        </p>
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <div
              key={m.id}
              className="flex gap-3 rounded-lg border border-line bg-surface-inset p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-content">{m.content}</p>
                <div className="mt-1 flex gap-2 text-xs text-content-muted">
                  {m.task_type && (
                    <span className="rounded-full bg-content/[0.05] px-2 py-0.5">
                      {m.task_type}
                    </span>
                  )}
                  {m.score !== undefined && <span>score: {m.score.toFixed(2)}</span>}
                  <span>{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="shrink-0 text-content-subtle transition-colors hover:text-danger"
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

// ── Score Badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-positive-soft text-positive"
      : score >= 60
      ? "bg-warning-soft text-warning"
      : "bg-danger-soft text-danger";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {score}/100
    </span>
  );
}

// ── Evals Panel ───────────────────────────────────────────────────────────────

function EvalPanel({ agentId }: { agentId: string }) {
  const [evals, setEvals] = useState<EvalResult[]>([]);
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [config, setConfig] = useState<AgentConfigInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [evolving, setEvolving] = useState(false);
  const [evolved, setEvolved] = useState(false);

  useEffect(() => {
    Promise.all([
      api.evals.list(agentId).catch(() => [] as EvalResult[]),
      api.evals.summary(agentId).catch(() => null),
      api.evals.config(agentId).catch(() => null),
    ]).then(([e, s, c]) => {
      setEvals(e);
      setSummary(s);
      setConfig(c);
      setLoading(false);
    });
  }, [agentId]);

  const handleEvolve = async () => {
    setEvolving(true);
    await api.evals.evolve(agentId).catch(() => null);
    setEvolving(false);
    setEvolved(true);
    setTimeout(() => setEvolved(false), 4000);
  };

  if (loading) return <p className="text-sm text-content-muted">Loading evals…</p>;

  const trendTone =
    summary && summary.avg_score >= 80
      ? "bg-positive"
      : summary && summary.avg_score >= 60
      ? "bg-warning"
      : "bg-danger";
  const trendLabel =
    summary && summary.avg_score >= 80
      ? "Strong"
      : summary && summary.avg_score >= 60
      ? "Improving"
      : "Needs work";

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {summary && summary.total_evals > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-line p-3 text-center">
            <div className="font-display text-2xl font-semibold text-content">{summary.avg_score}</div>
            <div className="mt-0.5 text-xs text-content-subtle">Avg quality</div>
          </div>
          <div className="rounded-lg border border-line p-3 text-center">
            <div className="font-display text-2xl font-semibold text-content">{summary.total_evals}</div>
            <div className="mt-0.5 text-xs text-content-subtle">Reviews</div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg border border-line p-3 text-center">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-content">
              <span className={`h-2 w-2 rounded-full ${trendTone}`} />
              {trendLabel}
            </span>
            <div className="mt-0.5 text-xs text-content-subtle">Trend</div>
          </div>
        </div>
      )}

      {/* Evolution status */}
      {config && config.generation > 0 && (
        <div className="rounded-lg border border-iris-200 bg-iris-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-iris-600">
                Coached · round {config.generation}
              </p>
              {config.eval_score && (
                <p className="mt-0.5 text-xs text-iris-500">
                  Started at quality {config.eval_score.toFixed(1)}
                </p>
              )}
            </div>
            <span className="rounded-full bg-iris-100 px-2 py-0.5 text-xs text-iris-600">Coached</span>
          </div>
          {config.value && (
            <p className="mt-2 line-clamp-2 text-xs italic text-iris-500">{config.value}</p>
          )}
        </div>
      )}

      {/* Evolve button */}
      <button
        onClick={handleEvolve}
        disabled={evolving}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-iris-300 py-2 text-sm font-medium text-iris-600 transition-colors hover:bg-iris-50 disabled:opacity-50"
      >
        {evolved ? (
          <><Check className="h-4 w-4" /> Coaching underway</>
        ) : evolving ? (
          "Starting…"
        ) : (
          <><Zap className="h-4 w-4" /> Coach this worker</>
        )}
      </button>

      {/* Recent evals list */}
      {evals.length === 0 ? (
        <p className="text-sm text-content-muted">
          No quality reviews yet. Every job is checked as it finishes.
        </p>
      ) : (
        <div className="space-y-2">
          {evals.map((e) => (
            <div key={e.id} className="rounded-lg border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {e.reasoning && (
                    <p className="text-sm leading-relaxed text-content-muted">{e.reasoning}</p>
                  )}
                  {Object.keys(e.skill_updates).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {Object.entries(e.skill_updates).map(([skill, delta]) => (
                        <span
                          key={skill}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            delta > 0
                              ? "bg-positive-soft text-positive"
                              : "bg-danger-soft text-danger"
                          }`}
                        >
                          {skill} {delta > 0 ? `+${delta}` : delta}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ScoreBadge score={e.score} />
                  <span className="text-xs text-content-muted">
                    {new Date(e.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
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
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "memories" | "evals">(
    "overview"
  );

  // Eval summary for header stat chip
  const [evalSummary, setEvalSummary] = useState<EvalSummary | null>(null);

  useEffect(() => {
    api.evals.summary(agent.id).then(setEvalSummary).catch(() => {});
  }, [agent.id]);

  // Give-a-job dialog
  const [runOpen, setRunOpen] = useState(false);

  // Recent events: last 20, newest first
  const recentEvents = [...events].reverse().slice(0, 20);

  const isAgentBusy = liveStatus === "active" || liveStatus === "thinking";

  return (
    <div className="app-backdrop min-h-screen">
      <RunTaskDialog
        agentId={agent.id}
        agentName={agent.name}
        open={runOpen}
        onClose={() => setRunOpen(false)}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-content-muted transition-colors hover:text-content">
            <span aria-hidden>←</span> Team
          </Link>
          <span className="text-content-subtle">/</span>
          <span className="text-sm text-content">{agent.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">

        {/* ── Profile header card ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-line bg-surface-raised p-6 shadow-raised">
          <div className="flex items-start gap-6">
            {/* live 3D mascot — spins slowly, wears the agent's accent, plays its status */}
            <div className="relative h-44 w-40 shrink-0 overflow-hidden rounded-2xl bg-surface-inset ring-1 ring-black/5">
              <ApeTurntable
                status={APE_STATUS[liveStatus] ?? "idle"}
                accent={avatarHue(agent.avatar_seed || agent.name)[0]}
                jersey={{
                  number: jerseyNumberOf(agent.id),
                  label: (agent.department || agent.title || "").slice(0, 3).toUpperCase() || undefined,
                }}
                className="absolute inset-0"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-semibold text-content">{agent.name}</h1>
                <StatusDot status={liveStatus} showLabel size="lg" />
              </div>
              <p className="mt-1 text-content-muted">{agent.title}</p>
              <p className="text-sm text-content-subtle">
                {agent.department} · {agent.model}
              </p>
              {agent.bio && (
                <p className="mt-3 text-sm leading-relaxed text-content-muted">{agent.bio}</p>
              )}

              <div className="mt-4 flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="font-display text-xl font-semibold tabular-nums text-content">
                    {agent.task_count.toLocaleString()}
                  </div>
                  <div className="text-2xs text-content-subtle">Jobs</div>
                </div>
                <div className="text-center">
                  <div
                    className={`font-display text-xl font-semibold tabular-nums ${
                      rate >= 90 ? "text-positive" : rate > 0 ? "text-warning" : "text-content-subtle"
                    }`}
                  >
                    {rate}%
                  </div>
                  <div className="text-2xs text-content-subtle">Success rate</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-xl font-semibold tabular-nums text-content">
                    {agent.skills.length}
                  </div>
                  <div className="text-2xs text-content-subtle">Tools</div>
                </div>
                {evalSummary && evalSummary.total_evals > 0 && (
                  <div className="flex items-center gap-1.5">
                    <ScoreBadge score={Math.round(evalSummary.avg_score)} />
                    <span className="text-xs text-content-subtle">avg quality</span>
                  </div>
                )}
              </div>
            </div>

            {/* Give-a-job button */}
            <div className="flex-shrink-0">
              <button
                onClick={() => setRunOpen(true)}
                disabled={isAgentBusy}
                title={isAgentBusy ? "This agent is busy right now" : "Give this agent a job"}
                className="rounded-xl bg-iris-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(237,113,80,0.8)] transition-transform active:scale-95 disabled:opacity-40"
              >
                {isAgentBusy ? "Working…" : "Give a job"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Growth (level · XP · mood) ─────────────────────────────────── */}
        <GrowthPanel
          input={{
            task_count: agent.task_count,
            success_count: agent.success_count,
            avg_eval: evalSummary?.avg_score ?? null,
            status: liveStatus,
          }}
        />

        {/* ── Tab navigation ────────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {(["overview", "activity", "memories", "evals"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium capitalize transition-all ${
                activeTab === tab
                  ? "bg-surface-overlay text-content shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset]"
                  : "text-content-subtle hover:text-content-muted"
              }`}
            >
              {tab === "activity" ? "Live" : tab === "evals" ? "Quality" : tab === "memories" ? "Memory" : "Overview"}
            </button>
          ))}
        </div>

        {/* ── Overview tab ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* Skills */}
            {agent.skills.length > 0 && (
              <div>
                <h2 className="mb-4 font-display text-lg font-semibold text-content">Tools</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {agent.skills.map((s) => (
                    <SkillBadge key={s.id} skill={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Work History */}
            <div>
              <h2 className="mb-4 font-display text-lg font-semibold text-content">Work history</h2>
              <WorkLogFeed entries={agent.recent_work ?? []} />
            </div>

            {/* Recent Communications */}
            {(agent.recent_comms?.length ?? 0) > 0 && (
              <div>
                <h2 className="mb-4 font-display text-lg font-semibold text-content">
                  Recent hand-offs
                </h2>
                <div className="space-y-3">
                  {agent.recent_comms!.map((c) => (
                    <div key={c.id} className="rounded-lg border border-line bg-surface p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs text-content-subtle">
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
                      <p className="text-sm text-content">{c.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Live Activity tab ─────────────────────────────────────────── */}
        {activeTab === "activity" && (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
              <span className="relative flex flex-shrink-0">
                {isConnected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isConnected ? "bg-positive" : "bg-content-subtle"
                  }`}
                />
              </span>
              <h2 className="text-sm font-semibold text-content">Live activity</h2>
              <span className="text-xs text-content-subtle">
                {isConnected ? "Connected" : "Connecting…"}
              </span>
              {lastActivity && (
                <span className="ml-auto text-xs text-content-subtle">
                  Last: {timeLabel(lastActivity)}
                </span>
              )}
            </div>

            {/* Retrieved memories */}
            {retrievedMemories.length > 0 && (
              <div className="border-b border-line px-5 py-3">
                <div className="rounded-lg border border-iris-200 bg-iris-50 p-3">
                  <p className="mb-1 text-xs font-medium text-iris-600">
                    Retrieved {retrievedMemories.length} relevant memories
                  </p>
                  <ul className="space-y-1">
                    {retrievedMemories.map((m, i) => (
                      <li key={i} className="truncate text-xs text-iris-500">
                        • {m}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Streaming message bubble */}
            {currentMessage && (
              <div className="border-b border-line bg-surface-inset px-5 py-4">
                <p className="mb-2 text-xs font-medium tracking-wider text-positive">STREAMING</p>
                <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-content">
                  {currentMessage}
                  <span className="animate-pulse">▋</span>
                </p>
              </div>
            )}

            {/* Active tool chip */}
            {currentTool && !currentMessage && (
              <div className="border-b border-line px-5 py-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/25 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
                  <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-warning" />
                  Using tool: {currentTool}
                </span>
              </div>
            )}

            {/* Static current_task (only when no live message/tool) */}
            {!currentMessage && !currentTool && agent.current_task && (
              <div className="border-b border-line px-5 py-3">
                <p className="text-xs italic text-content-subtle">{agent.current_task}</p>
              </div>
            )}

            {/* Event log */}
            <div className="max-h-64 overflow-y-auto">
              {recentEvents.length === 0 ? (
                <div className="px-5 py-10 text-center text-xs text-content-subtle">
                  {isConnected ? "Waiting for activity…" : "Connecting to stream…"}
                </div>
              ) : (
                <div className="divide-y divide-line/50">
                  {recentEvents.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-5 py-2 text-xs transition-colors hover:bg-surface-inset/40"
                    >
                      <span className="mt-px flex-shrink-0 font-mono tabular-nums text-content-subtle">
                        {timeLabel(ev.timestamp)}
                      </span>
                      <span
                        className={`mt-px flex-shrink-0 font-mono font-semibold ${eventTextColor(ev.type)}`}
                      >
                        {ev.type}
                      </span>
                      <span className="mt-px truncate text-content-subtle">{describeEvent(ev)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Memories tab ──────────────────────────────────────────────── */}
        {activeTab === "memories" && (
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-content">Memories</h2>
            <MemoriesPanel agentId={agent.id} />
          </div>
        )}

        {/* ── Evals tab ─────────────────────────────────────────────────── */}
        {activeTab === "evals" && (
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-content">Quality</h2>
            <EvalPanel agentId={agent.id} />
          </div>
        )}
      </div>
    </div>
  );
}
