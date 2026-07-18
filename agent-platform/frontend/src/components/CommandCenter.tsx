"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Plus, Search, DollarSign, Activity, Users, Zap, Gauge, TrendingUp,
  CheckCircle2, XCircle, ArrowUpDown,
} from "lucide-react";
import { Logo } from "./brand/Logo";
import HumanInbox from "./HumanInbox";
import { AccountMenu } from "./AccountMenu";
import { AgentAvatar } from "./AgentAvatar";
import { StatusDot } from "./StatusDot";
import { AreaChart } from "./charts/AreaChart";
import { BarList, RadialGauge, Sparkline, Segmented } from "./charts/mini";
import { Card, Banner, Skeleton } from "./ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StatsOverview, AgentStat, ActivityItem, TimePoint } from "@/types/agent";

const money = (v: number) => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`);
const compact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

type SortKey = "task_count" | "success_rate" | "cost_usd" | "avg_eval";

export function CommandCenter() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [agents, setAgents] = useState<AgentStat[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [series, setSeries] = useState<TimePoint[]>([]);
  const [metric, setMetric] = useState<"tasks" | "cost">("tasks");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("task_count");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    // allSettled so one flaky endpoint doesn't blank the whole board; the banner
    // only appears when the backend is fully unreachable (every call rejected).
    const [o, a, act, ts] = await Promise.allSettled([
      api.stats.overview(),
      api.stats.agents(),
      api.stats.activity(30),
      api.stats.timeseries(14),
    ]);
    if (o.status === "fulfilled" && o.value) setOverview(o.value);
    if (a.status === "fulfilled") setAgents(a.value);
    if (act.status === "fulfilled") setActivity(act.value);
    if (ts.status === "fulfilled") setSeries(ts.value.series);
    setError([o, a, act, ts].every((r) => r.status === "rejected"));
    setLoaded(true);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 12000); // live refresh
    return () => clearInterval(t);
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(agents.map((a) => a.department))).sort(),
    [agents]
  );

  const filtered = useMemo(() => {
    let list = agents.filter((a) => {
      if (dept !== "all" && a.department !== dept) return false;
      if (status !== "all" && a.status !== status) return false;
      if (q && !(`${a.name} ${a.title} ${a.department}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
    list = [...list].sort((x, y) => {
      const av = (x[sort] ?? 0) as number;
      const bv = (y[sort] ?? 0) as number;
      return bv - av;
    });
    return list;
  }, [agents, q, dept, status, sort]);

  const chartData = series.map((s) => ({
    label: s.date.slice(5),
    value: metric === "tasks" ? s.tasks : s.cost,
  }));
  const taskSpark = series.map((s) => s.tasks);
  const costSpark = series.map((s) => s.cost);

  return (
    <div className="app-backdrop min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              <span className="rounded-lg bg-content/5 px-3 py-1.5 text-sm font-medium text-content">Command center</span>
              <Link href="/network" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">Network</Link>
              <Link href="/live" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">Live</Link>
            </nav>
            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-content/[0.04] px-2.5 py-1 text-2xs font-medium text-positive lg:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
              </span>
              {overview?.active ?? 0} active
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
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="mb-6">
          <p className="eyebrow">Command center</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-content sm:text-3xl">
            Run your workforce
          </h1>
        </div>

        {error && (
          <Banner tone="danger" onRetry={load} className="mb-4">
            Can&apos;t reach the server right now — showing the last data we have. It will retry automatically.
          </Banner>
        )}

        {/* KPI row */}
        {!loaded ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="mt-3 h-7 w-16" />
                <Skeleton className="mt-1.5 h-3 w-12" />
              </Card>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi icon={<Users className="h-4 w-4" />} label="Agents" value={overview?.agents ?? "—"} />
          <Kpi icon={<Activity className="h-4 w-4" />} label="Active now" value={overview?.active ?? "—"} tone="positive" />
          <Kpi
            icon={<Zap className="h-4 w-4" />}
            label="Tasks (14d)"
            value={compact(series.reduce((s, d) => s + d.tasks, 0))}
            spark={taskSpark}
            sparkTone="iris"
          />
          <Kpi icon={<Gauge className="h-4 w-4" />} label="Success" value={overview ? `${overview.success_rate}%` : "—"} tone="positive" />
          <Kpi
            icon={<DollarSign className="h-4 w-4" />}
            label="Spend (total)"
            value={overview ? money(overview.total_cost_usd) : "—"}
            spark={costSpark}
            sparkTone="aqua"
          />
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Tokens" value={overview ? compact(overview.total_tokens) : "—"} />
        </div>
        )}

        {/* Charts */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-content">
                {metric === "tasks" ? "Task throughput" : "Spend"} · last 14 days
              </h3>
              <Segmented
                value={metric}
                onChange={setMetric}
                options={[{ value: "tasks", label: "Tasks" }, { value: "cost", label: "Cost" }]}
              />
            </div>
            <AreaChart
              data={chartData}
              tone={metric === "tasks" ? "iris" : "aqua"}
              format={(v) => (metric === "tasks" ? `${v} tasks` : money(v))}
              valueLabel={metric}
            />
          </Card>

          <Card className="flex flex-col items-center justify-center gap-3 p-5">
            <h3 className="self-start font-display text-sm font-semibold text-content">Success rate</h3>
            <RadialGauge value={overview?.success_rate ?? 0} sublabel={`${overview?.success ?? 0}/${overview?.tasks ?? 0} tasks`} />
            {overview?.avg_eval != null && (
              <p className="text-2xs text-content-subtle">
                Avg eval score <span className="text-content">{overview.avg_eval}/100</span>
              </p>
            )}
          </Card>
        </div>

        {/* Departments + fleet + activity */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Card className="p-5">
            <h3 className="mb-4 font-display text-sm font-semibold text-content">By department</h3>
            <BarList
              items={(overview?.departments ?? []).map((d) => ({ label: d.department, value: d.tasks }))}
              format={(v) => `${compact(v)} tasks`}
            />
          </Card>

          {/* Live activity */}
          <Card className="p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-content">Live activity</h3>
              <span className="flex items-center gap-1.5 text-2xs text-content-subtle">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" /> updating
              </span>
            </div>
            <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
              {activity.length === 0 && (
                <p className="py-8 text-center text-xs text-content-subtle">
                  No runs yet. Dispatch a task from any agent to see live activity.
                </p>
              )}
              {activity.map((a) => (
                <Link
                  key={a.id}
                  href={`/agents/${a.agent_id}`}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-line hover:bg-content/[0.04]"
                >
                  <AgentAvatar seed={a.avatar_seed} url={a.avatar_url} name={a.agent_name} status="idle" size={30} showStatus={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-content">
                      <span className="font-medium">{a.agent_name}</span>{" "}
                      <span className="text-content-muted">ran</span>{" "}
                      <span className="text-content-muted">{a.task_type}</span>
                    </p>
                    <p className="truncate text-2xs text-content-subtle">{a.result_preview || "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5 text-2xs">
                    {a.cost_usd > 0 && <span className="tabular-nums text-content-subtle">{money(a.cost_usd)}</span>}
                    {a.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-danger" />
                    )}
                    <span className="w-14 text-right text-content-subtle">
                      {a.finished_at ? formatDistanceToNow(new Date(a.finished_at), { addSuffix: false }) : "—"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Fleet table */}
        <Card className="mt-4 overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line p-4">
            <h3 className="mr-auto font-display text-sm font-semibold text-content">Fleet</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search agents…"
                className="h-8 w-44 rounded-lg border border-line bg-surface-inset pl-8 pr-2 text-xs text-content placeholder:text-content-subtle outline-none focus:border-iris-400/50"
              />
            </div>
            <FilterSelect value={dept} onChange={setDept} options={["all", ...departments]} labelAll="All depts" />
            <FilterSelect value={status} onChange={setStatus} options={["all", "active", "thinking", "idle", "error"]} labelAll="Any status" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-content-subtle">
                  <th className="px-4 py-2.5 font-medium">Agent</th>
                  <th className="px-3 py-2.5 font-medium">Dept</th>
                  <Th label="Tasks" active={sort === "task_count"} onClick={() => setSort("task_count")} />
                  <Th label="Success" active={sort === "success_rate"} onClick={() => setSort("success_rate")} />
                  <Th label="Cost" active={sort === "cost_usd"} onClick={() => setSort("cost_usd")} />
                  <Th label="Eval" active={sort === "avg_eval"} onClick={() => setSort("avg_eval")} />
                  <th className="px-4 py-2.5 text-right font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="group border-b border-line/60 last:border-0 hover:bg-content/[0.04]">
                    <td className="px-4 py-2.5">
                      <Link href={`/agents/${a.id}`} className="flex items-center gap-2.5">
                        <AgentAvatar seed={a.avatar_seed} url={a.avatar_url} name={a.name} status={a.status} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-content group-hover:text-iris-200">{a.name}</span>
                          <span className="block truncate text-2xs text-content-subtle">{a.title}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-content-muted">{a.department}</td>
                    <td className="px-3 py-2.5 tabular-nums text-content">{a.task_count.toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("tabular-nums", a.success_rate >= 90 ? "text-positive" : a.success_rate >= 60 ? "text-warning" : a.task_count ? "text-danger" : "text-content-subtle")}>
                        {a.task_count ? `${a.success_rate}%` : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-content-muted">{money(a.cost_usd)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-content-muted">{a.avg_eval != null ? a.avg_eval : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={a.status} size="sm" />
                        <span className="text-2xs text-content-subtle">
                          {a.last_active ? formatDistanceToNow(new Date(a.last_active), { addSuffix: true }) : "never"}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-xs text-content-subtle">
                      No agents match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}

function Kpi({
  icon, label, value, spark, sparkTone = "iris", tone,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  spark?: number[]; sparkTone?: "iris" | "positive" | "aqua"; tone?: "positive";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-content/[0.05] text-content-muted">{icon}</span>
        {spark && spark.length > 1 && <Sparkline data={spark} tone={sparkTone} />}
      </div>
      <p className={cn("mt-3 font-display text-2xl font-semibold tabular-nums", tone === "positive" ? "text-positive" : "text-content")}>
        {value}
      </p>
      <p className="text-2xs text-content-subtle">{label}</p>
    </Card>
  );
}

function Th({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <th className="px-3 py-2.5 font-medium">
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 transition-colors", active ? "text-content" : "hover:text-content-muted")}>
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "text-iris-300" : "text-content-subtle/50")} />
      </button>
    </th>
  );
}

function FilterSelect({
  value, onChange, options, labelAll,
}: {
  value: string; onChange: (v: string) => void; options: string[]; labelAll: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-line bg-surface-inset px-2 text-xs text-content-muted outline-none focus:border-iris-400/50"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o === "all" ? labelAll : o.charAt(0).toUpperCase() + o.slice(1)}</option>
      ))}
    </select>
  );
}
