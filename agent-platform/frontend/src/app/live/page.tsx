"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Radio, Play, Wrench, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import HumanInbox from "@/components/HumanInbox";
import { AgentAvatar } from "@/components/AgentAvatar";
import { StatusDot } from "@/components/StatusDot";
import { Card, Badge, Button, Select } from "@/components/ui";
import { useFleetStream } from "@/lib/ag-ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Agent, AGUIEvent } from "@/types/agent";

function describe(e: AGUIEvent): { text: string; tone: string } {
  const d = e.data || {};
  switch (e.type) {
    case "RUN_STARTED": return { text: `started ${(d.task_type as string) || "a task"}`, tone: "text-iris-300" };
    case "RUN_FINISHED": return { text: `finished (${(d.tokens_used as number) || 0} tokens)`, tone: "text-positive" };
    case "RUN_ERROR": return { text: `errored`, tone: "text-danger" };
    case "TOOL_CALL_START": return { text: `used ${(d.tool_name as string) || "a tool"}`, tone: "text-warning" };
    case "TOOL_CALL_RESULT": return { text: `got a tool result`, tone: "text-aqua" };
    case "CUSTOM":
      if (d.subtype === "REFLECTION") return { text: "reflected on its work", tone: "text-content-muted" };
      if (d.subtype === "MEMORY_RETRIEVED") return { text: `recalled ${(d.count as number) || 0} memories`, tone: "text-content-muted" };
      if (d.subtype === "A2A_SENT") return { text: `messaged ${(d.to_agent as string) || "an agent"}`, tone: "text-iris-300" };
      if (d.subtype === "HUMAN_NOTIFIED") return { text: "asked a human", tone: "text-warning" };
      return { text: "did something", tone: "text-content-muted" };
    default: return { text: "", tone: "text-content-muted" };
  }
}

export default function LivePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runAgent, setRunAgent] = useState("");
  const [runType, setRunType] = useState("research");
  const [running, setRunning] = useState(false);
  const fleet = useFleetStream();

  useEffect(() => {
    api.agents.list().then(setAgents).catch(() => setAgents([]));
  }, []);

  const nameFor = (id: string) => agents.find((a) => a.id === id)?.name || "Agent";

  const ordered = useMemo(() => {
    const rank = (id: string) => {
      const st = fleet.agents[id]?.status ?? "idle";
      return st === "active" || st === "thinking" ? 0 : st === "error" ? 1 : 2;
    };
    return [...agents].sort((a, b) => rank(a.id) - rank(b.id));
  }, [agents, fleet.agents]);

  const liveCount = Object.values(fleet.agents).filter((a) => a.status === "active" || a.status === "thinking").length;

  const runTask = async () => {
    if (!runAgent) return;
    setRunning(true);
    try {
      await api.agents.run(runAgent, runType, { prompt: `Perform a ${runType} task and summarize the result.` });
    } catch {
      /* surfaced via stream / ignore */
    } finally {
      setTimeout(() => setRunning(false), 800);
    }
  };

  const namedEvents = fleet.events
    .filter((e) => describe(e).text)
    .slice(-40)
    .reverse();

  return (
    <div className="app-backdrop min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">Command center</Link>
              <Link href="/network" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">Network</Link>
              <span className="rounded-lg bg-content/5 px-3 py-1.5 text-sm font-medium text-content">Live</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium sm:inline-flex",
              fleet.isConnected ? "border-positive/30 bg-positive/5 text-positive" : "border-line bg-content/[0.04] text-content-subtle")}>
              <Radio className="h-3 w-3" /> {fleet.isConnected ? "Streaming" : "Reconnecting…"}
            </span>
            <HumanInbox />
            <Link href="/agents/new" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-iris-gradient px-3.5 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(237,113,80,0.8)] transition-transform active:scale-95">
              <Plus className="h-4 w-4" /> New agent
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Real-time</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-content sm:text-3xl">Live floor</h1>
            <p className="mt-1 text-sm text-content-muted">
              Watch every agent think, act and hand off — as it happens. {liveCount > 0 && <span className="text-positive">{liveCount} working now.</span>}
            </p>
          </div>
          {/* quick run */}
          <div className="flex items-end gap-2">
            <div className="w-44">
              <Select value={runAgent} onChange={(e) => setRunAgent(e.target.value)} className="h-9">
                <option value="">Pick an agent…</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <input
              value={runType}
              onChange={(e) => setRunType(e.target.value)}
              className="h-9 w-28 rounded-xl border border-line bg-surface-inset px-3 text-sm text-content outline-none focus:border-iris-400/50"
              placeholder="task type"
            />
            <Button size="md" onClick={runTask} loading={running} disabled={!runAgent} icon={<Play className="h-4 w-4" />}>
              Run
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          {/* agent tiles */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ordered.map((a) => {
              const live = fleet.agents[a.id];
              const status = live?.status ?? a.status;
              const busy = status === "active" || status === "thinking";
              return (
                <Card key={a.id} className={cn("p-4 transition-all", busy && "border-iris-500/40 shadow-glow")}>
                  <div className="flex items-center gap-3">
                    <AgentAvatar seed={a.avatar_seed} url={a.avatar_url} name={a.name} status={status} size={40} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/agents/${a.id}`} className="truncate font-display text-sm font-semibold text-content hover:text-iris-200">{a.name}</Link>
                      <p className="truncate text-2xs text-content-subtle">{a.title}</p>
                    </div>
                    <StatusDot status={status} showLabel size="sm" />
                  </div>

                  <div className="mt-3 min-h-[52px] rounded-lg border border-line bg-surface-inset p-2.5">
                    {live?.currentTool ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-warning">
                        <Wrench className="h-3.5 w-3.5" /> using {live.currentTool}…
                      </span>
                    ) : live?.currentMessage ? (
                      <p className="line-clamp-2 text-xs text-content-muted">
                        {live.currentMessage}
                        {busy && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-iris-400 align-middle" />}
                      </p>
                    ) : busy ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-iris-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-iris-400" /> thinking…
                      </span>
                    ) : (
                      <span className="text-xs text-content-subtle">idle — ready for work</span>
                    )}
                  </div>
                </Card>
              );
            })}
            {agents.length === 0 && (
              <Card className="col-span-full grid place-items-center p-10 text-sm text-content-subtle">
                No agents yet. <Link href="/agents/new" className="ml-1 text-iris-300">Hire one →</Link>
              </Card>
            )}
          </div>

          {/* global event ticker */}
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold text-content">
              <Zap className="h-4 w-4 text-iris-300" /> Event stream
            </h3>
            <div className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
              {namedEvents.length === 0 && (
                <p className="py-8 text-center text-xs text-content-subtle">
                  Waiting for activity… run a task above to see the floor light up.
                </p>
              )}
              {namedEvents.map((e, i) => {
                const { text, tone } = describe(e);
                return (
                  <div key={i} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs">
                    <span className="mt-0.5">
                      {e.type === "RUN_FINISHED" ? <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
                        : e.type === "RUN_ERROR" ? <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                        : <span className="block h-1.5 w-1.5 translate-y-1 rounded-full bg-iris-400" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-content">{nameFor(e.agent_id)}</span>{" "}
                      <span className={tone}>{text}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
