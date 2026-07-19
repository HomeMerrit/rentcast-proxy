"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Logo } from "@/components/brand/Logo";
import { StatusDot } from "@/components/StatusDot";
import { avatarHue } from "@/components/AgentAvatar";
import { useFleetStream } from "@/lib/ag-ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Agent, AgentStatus } from "@/types/agent";
import type { ApeStatus } from "@/components/world/ApeAgent.types";
import type { WorkspaceAgent } from "@/components/world/WorkspaceRoom.types";

const ApeworksExteriorScene = dynamic(
  () => import("@/components/world/ApeworksExteriorScene").then((m) => m.ApeworksExteriorScene),
  { ssr: false },
);
const WorkspacePreviewScene = dynamic(
  () => import("@/components/world/WorkspacePreviewScene").then((m) => m.WorkspacePreviewScene),
  { ssr: false },
);

const APE_STATUS: Record<AgentStatus, ApeStatus> = {
  active: "working",
  thinking: "thinking",
  idle: "idle",
  error: "error",
  offline: "waiting",
};

type View = "exterior" | "inside";

export default function HqPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [view, setView] = useState<View>("exterior");
  const [fading, setFading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fleet = useFleetStream();

  useEffect(() => {
    api.agents.list().then(setAgents).catch(() => setAgents([]));
  }, []);

  const switchView = (next: View) => {
    if (next === view) return;
    setFading(true);
    setTimeout(() => {
      setView(next);
      setSelectedId(null);
      setTimeout(() => setFading(false), 60);
    }, 260);
  };

  const floorAgents: WorkspaceAgent[] = useMemo(
    () =>
      agents.slice(0, 5).map((a, i) => ({
        id: a.id,
        name: a.name,
        role: a.title || a.department || "Agent",
        status: APE_STATUS[(fleet.agents[a.id]?.status as AgentStatus) ?? a.status] ?? "idle",
        workstationId: `ws-${i + 1}`,
        accentColor: avatarHue(a.avatar_seed || a.name)[0],
      })),
    [agents, fleet.agents],
  );

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="fixed inset-0 flex flex-col bg-canvas">
      <header className="z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/"><Logo /></Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">Command center</Link>
              <Link href="/live" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">Live</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-line p-0.5">
              {(["exterior", "inside"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  className={cn(
                    "rounded-[10px] px-3.5 py-1.5 text-sm font-medium transition-colors",
                    view === v ? "bg-iris-gradient text-white" : "text-content-muted hover:text-content",
                  )}
                >
                  {v === "exterior" ? "Exterior" : "Headquarters"}
                </button>
              ))}
            </div>
            <span className="hidden text-sm text-content-muted md:block">
              {agents.length === 0 ? "No agents yet" : `${floorAgents.length} on the floor`}
            </span>
          </div>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {view === "exterior" ? (
          <ApeworksExteriorScene onEnterHq={() => switchView("inside")} />
        ) : (
          <WorkspacePreviewScene
            agents={floorAgents}
            selectedAgentId={selectedId}
            onAgentClick={(id) => setSelectedId((cur) => (cur === id ? null : id))}
            onCreateAgent={() => router.push("/agents/new")}
          />
        )}

        {/* view-switch fade */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-canvas transition-opacity duration-300",
            fading ? "opacity-100" : "opacity-0",
          )}
        />

        {view === "exterior" && !fading && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <button
              onClick={() => switchView("inside")}
              className="pointer-events-auto rounded-xl bg-iris-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(237,113,80,0.9)] transition-transform active:scale-95"
            >
              Enter headquarters →
            </button>
          </div>
        )}

        {view === "inside" && selected && (
          <div className="absolute right-4 top-4 w-64 rounded-2xl border border-line bg-canvas/90 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <StatusDot status={(fleet.agents[selected.id]?.status as AgentStatus) ?? selected.status} />
              <span className="truncate font-display text-sm font-semibold text-content">{selected.name}</span>
            </div>
            <p className="mt-1 truncate text-xs text-content-muted">
              {selected.title || selected.department || "Agent"}
            </p>
            <Link
              href={`/agents/${selected.id}`}
              className="mt-3 inline-flex rounded-lg bg-content/5 px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-content/10"
            >
              Open agent →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
