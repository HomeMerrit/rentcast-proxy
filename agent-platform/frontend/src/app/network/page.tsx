"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Plus, Network as NetworkIcon, ArrowRight, MessageSquare } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import HumanInbox from "@/components/HumanInbox";
import { CollaborationGraph } from "@/components/CollaborationGraph";
import { Card, Badge } from "@/components/ui";
import { api } from "@/lib/api";
import type { NetworkGraph } from "@/types/agent";

export default function NetworkPage() {
  const [graph, setGraph] = useState<NetworkGraph | null>(null);

  const load = () => api.stats.network().then(setGraph).catch(() => setGraph({ nodes: [], edges: [], recent: [] }));
  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);

  const totalMsgs = graph?.edges.reduce((s, e) => s + e.count, 0) ?? 0;

  return (
    <div className="app-backdrop min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <nav className="hidden items-center gap-1 sm:flex">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-white/5 hover:text-content">Command center</Link>
              <span className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-content">Network</span>
              <Link href="/live" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-white/5 hover:text-content">Live</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
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
            <p className="eyebrow">Collaboration</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-content sm:text-3xl">
              Agent network
            </h1>
            <p className="mt-1 text-sm text-content-muted">
              How your agents delegate and talk to each other, in real time.
            </p>
          </div>
          <div className="flex gap-2.5">
            <Stat label="Agents" value={graph?.nodes.length ?? "—"} />
            <Stat label="Connections" value={graph?.edges.length ?? "—"} />
            <Stat label="Messages" value={totalMsgs} accent />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
          <Card className="relative overflow-hidden p-2">
            {graph && graph.edges.length === 0 && graph.nodes.length > 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-6 z-10 text-center">
                <span className="rounded-full border border-line bg-surface-overlay/90 px-3 py-1 text-2xs text-content-muted backdrop-blur">
                  No agent-to-agent messages yet — when one agent delegates to another, a link appears here.
                </span>
              </div>
            )}
            {graph ? <CollaborationGraph graph={graph} /> : <div className="grid h-[440px] place-items-center text-sm text-content-subtle">Loading…</div>}
            <div className="flex flex-wrap items-center gap-3 px-3 pb-2 text-2xs text-content-subtle">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-positive" /> active</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> thinking</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" /> error</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded-full bg-iris-500" /> thicker = more messages</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-aqua" /> live message</span>
            </div>
          </Card>

          {/* recent A2A messages */}
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold text-content">
              <MessageSquare className="h-4 w-4 text-iris-300" /> Recent messages
            </h3>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {graph?.recent.length === 0 && (
                <p className="py-8 text-center text-xs text-content-subtle">No inter-agent messages yet.</p>
              )}
              {graph?.recent.map((m) => (
                <div key={m.id} className="rounded-xl border border-line bg-surface-inset p-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-content">{m.from_name || "—"}</span>
                    <ArrowRight className="h-3 w-3 text-content-subtle" />
                    <span className="font-medium text-content">{m.to_name || "—"}</span>
                    <Badge tone={m.message_type === "task" ? "iris" : "neutral"} className="ml-auto">
                      {m.message_type}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-content-muted">{m.message}</p>
                  <p className="mt-1 text-2xs text-content-subtle">
                    {m.created_at ? formatDistanceToNow(new Date(m.created_at), { addSuffix: true }) : ""}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2 text-center">
      <p className={`font-display text-lg font-semibold tabular-nums ${accent ? "text-gradient" : "text-content"}`}>{value}</p>
      <p className="flex items-center justify-center gap-1 text-2xs text-content-subtle">
        {label === "Connections" && <NetworkIcon className="h-2.5 w-2.5" />}
        {label}
      </p>
    </div>
  );
}
