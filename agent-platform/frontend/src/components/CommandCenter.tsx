"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { formatDistanceToNow } from "date-fns";
import {
  Plus, DollarSign, Activity, Users, Zap, Gauge, TrendingUp,
  CheckCircle2, XCircle, Briefcase, Radio, ChevronDown,
} from "lucide-react";
import { Logo } from "./brand/Logo";
import HumanInbox from "./HumanInbox";
import { AccountMenu } from "./AccountMenu";
import { AgentAvatar } from "./AgentAvatar";
import { RunTaskDialog } from "./RunTaskDialog";
import type { Building } from "@/lib/world";
import { AreaChart } from "./charts/AreaChart";
import { BarList, RadialGauge, Sparkline, Segmented } from "./charts/mini";
import { Card, Banner, Skeleton } from "./ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StatsOverview, AgentStat, ActivityItem, TimePoint } from "@/types/agent";

// the real HQ — the Blender-built exterior, loaded client-side only
const ApeworksExteriorScene = dynamic(
  () => import("./world/ApeworksExteriorScene").then((m) => m.ApeworksExteriorScene),
  { ssr: false },
);

const money = (v: number) => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`);
const compact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

export function CommandCenter() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [agents, setAgents] = useState<AgentStat[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [series, setSeries] = useState<TimePoint[]>([]);
  const [metric, setMetric] = useState<"tasks" | "cost">("tasks");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false); // less is more: numbers on demand
  const router = useRouter();

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

  // Next-step spine: pick a target agent (idle first) and read the fleet's
  // state so the dashboard always proposes one clear next action.
  const target = useMemo(
    () => agents.find((a) => a.status === "idle") ?? agents[0] ?? null,
    [agents]
  );
  const agentCount = overview?.agents ?? agents.length;
  const totalTasks = overview?.tasks ?? 0;
  const activeCount = overview?.active ?? 0;

  // The living world: each department becomes a building, sized by headcount,
  // lit up when someone on that team is working right now.
  const buildings: Building[] = useMemo(() => {
    const activeDepts = new Set(
      agents.filter((a) => a.status === "active" || a.status === "thinking").map((a) => a.department)
    );
    const src = overview?.departments?.length
      ? overview.departments.map((d) => ({ dept: d.department, count: d.agents }))
      : Array.from(
          agents.reduce((m, a) => m.set(a.department, (m.get(a.department) ?? 0) + 1), new Map<string, number>()),
          ([dept, count]) => ({ dept, count })
        );
    return src.map((b) => ({ ...b, active: activeDepts.has(b.dept) }));
  }, [overview, agents]);

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
              <span className="rounded-lg bg-content/5 px-3 py-1.5 text-sm font-medium text-content">Company</span>
              <Link href="/network" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">Flow</Link>
              <Link href="/live" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">Floor</Link>
              <Link href="/hq" className="rounded-lg px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-content/5 hover:text-content">HQ</Link>
            </nav>
            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-content/[0.04] px-2.5 py-1 text-2xs font-medium text-positive lg:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
              </span>
              {overview?.active ?? 0} working
            </span>
          </div>
          <div className="flex items-center gap-2">
            <HumanInbox />
            <Link
              href="/agents/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-iris-gradient px-3.5 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(237,113,80,0.8)] transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" /> Hire
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        {error && (
          <Banner tone="danger" onRetry={load} className="mb-4">
            Can&apos;t reach the server right now — showing the last data we have. It will retry automatically.
          </Banner>
        )}

        {/* The company IS the building — the real HQ, live at dusk */}
        {buildings.length > 0 && (
          <section className="relative mb-4 overflow-hidden rounded-3xl border border-line shadow-card" style={{ background: "#2C3550" }}>
            <div className="relative h-[380px] sm:h-[460px]">
              <ApeworksExteriorScene hero onEnterHq={() => router.push("/hq")} />
              {/* copy floats on the dusk sky; the scene stays draggable below */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-[#232B45]/90 via-[#232B45]/40 to-transparent px-5 pb-14 pt-6 sm:px-8 sm:pt-7">
                <p className="text-2xs font-medium uppercase tracking-[0.14em] text-white/60">Your company</p>
                <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                  A company that builds itself
                </h1>
                <p className="mt-1 max-w-md text-sm text-white/75">
                  {agentCount <= 1
                    ? "It starts with one. Give them a job — and watch your company grow."
                    : `${agentCount} workers across ${buildings.length} ${buildings.length === 1 ? "team" : "teams"}. They're inside, working right now.`}
                </p>
              </div>
              <span className="absolute right-5 top-6 z-10 hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-2xs font-medium text-white/80 backdrop-blur sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-iris-400" /> live · dusk at HQ
              </span>
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-1.5">
                <Link
                  href="/hq"
                  className="pointer-events-auto rounded-xl bg-iris-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(237,113,80,0.9)] transition-transform active:scale-95"
                >
                  Step inside HQ →
                </Link>
                <span className="text-2xs text-white/50">or knock on the front door</span>
              </div>
            </div>
          </section>
        )}

        {/* Next step — always one clear action */}
        <div className="mb-4">
          <NextStep
            loaded={loaded}
            agentCount={agentCount}
            totalTasks={totalTasks}
            activeCount={activeCount}
            targetName={target?.name ?? null}
            onGiveJob={() => setJobOpen(true)}
          />
        </div>

        {target && (
          <RunTaskDialog
            agentId={target.id}
            agentName={target.name}
            open={jobOpen}
            onClose={() => setJobOpen(false)}
            onQueued={() => load()}
          />
        )}

        {/* Less is more: the world is the screen. Numbers live one calm tap away. */}
        {loaded && buildings.length > 0 && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => setShowNumbers((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/70 px-4 py-1.5 text-xs font-medium text-content-muted transition-colors hover:border-line-strong hover:text-content"
            >
              {showNumbers ? "Hide the numbers" : "See the numbers"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showNumbers && "rotate-180")} />
            </button>
          </div>
        )}

        {showNumbers && (
        <div className="mt-4 space-y-4 animate-fade-up">
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
          <Kpi icon={<Users className="h-4 w-4" />} label="Workers" value={overview?.agents ?? "—"} />
          <Kpi icon={<Activity className="h-4 w-4" />} label="Working now" value={overview?.active ?? "—"} tone="positive" />
          <Kpi
            icon={<Zap className="h-4 w-4" />}
            label="Work done (14d)"
            value={compact(series.reduce((s, d) => s + d.tasks, 0))}
            spark={taskSpark}
            sparkTone="iris"
          />
          <Kpi icon={<Gauge className="h-4 w-4" />} label="Success" value={overview ? `${overview.success_rate}%` : "—"} tone="positive" />
          <Kpi
            icon={<DollarSign className="h-4 w-4" />}
            label="Spend"
            value={overview ? money(overview.total_cost_usd) : "—"}
            spark={costSpark}
            sparkTone="aqua"
          />
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Teams" value={buildings.length || "—"} />
        </div>
        )}

        {/* Charts */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-content">
                {metric === "tasks" ? "Work done" : "Spend"} · last 14 days
              </h3>
              <Segmented
                value={metric}
                onChange={setMetric}
                options={[{ value: "tasks", label: "Work" }, { value: "cost", label: "Spend" }]}
              />
            </div>
            <AreaChart
              data={chartData}
              tone={metric === "tasks" ? "iris" : "aqua"}
              format={(v) => (metric === "tasks" ? `${v} jobs` : money(v))}
              valueLabel={metric}
            />
          </Card>

          <Card className="flex flex-col items-center justify-center gap-3 p-5">
            <h3 className="self-start font-display text-sm font-semibold text-content">Success rate</h3>
            <RadialGauge value={overview?.success_rate ?? 0} sublabel={`${overview?.success ?? 0}/${overview?.tasks ?? 0} jobs`} />
            {overview?.avg_eval != null && (
              <p className="text-2xs text-content-subtle">
                Avg quality <span className="text-content">{overview.avg_eval}/100</span>
              </p>
            )}
          </Card>
        </div>

        {/* Teams + workers + activity */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Card className="p-5">
            <h3 className="mb-4 font-display text-sm font-semibold text-content">Teams</h3>
            <BarList
              items={(overview?.departments ?? []).map((d) => ({ label: d.department, value: d.tasks }))}
              format={(v) => `${compact(v)} jobs`}
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
                  No work yet. Give any worker a job to see the floor come alive.
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
                      <span className="text-content-muted">did</span>{" "}
                      <span className="text-content-muted">{a.task_type.replace(/_/g, " ")}</span>
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

        {/* The fleet table is retired: the world is the roster now — tap a building. */}
        </div>
        )}
      </main>
    </div>
  );
}

function NextStep({
  loaded, agentCount, totalTasks, activeCount, targetName, onGiveJob,
}: {
  loaded: boolean;
  agentCount: number;
  totalTasks: number;
  activeCount: number;
  targetName: string | null;
  onGiveJob: () => void;
}) {
  if (!loaded) return <Skeleton className="h-[68px] w-full rounded-2xl" />;

  // No agents yet → hire (rare: root redirects to onboarding, but be safe).
  if (agentCount === 0) {
    return (
      <Prompt
        eyebrow="Start here"
        title="Hire your first worker"
        body="Your world is empty. Bring on your first worker — it takes about a minute."
        primary={
          <Link href="/agents/new" className={primaryBtn}>
            <Plus className="h-4 w-4" /> Hire a worker
          </Link>
        }
      />
    );
  }

  // Agents hired but no work done → the key first-run moment.
  if (totalTasks === 0) {
    return (
      <Prompt
        eyebrow="Next step"
        title={targetName ? `Give ${targetName} their first job` : "Give your team their first job"}
        body="Your team is hired — now put them to work. Pick a job in plain words and watch them go."
        primary={
          <button onClick={onGiveJob} className={primaryBtn}>
            <Briefcase className="h-4 w-4" /> Give a job
          </button>
        }
      />
    );
  }

  // Something is running → celebrate + point at the live floor.
  if (activeCount > 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-positive/30 bg-positive-soft px-4 py-3">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
        </span>
        <p className="text-sm text-content">
          <span className="font-medium">{activeCount} worker{activeCount > 1 ? "s" : ""} at work now.</span>{" "}
          <span className="text-content-muted">See the work and hand-offs in real time.</span>
        </p>
        <Link
          href="/live"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-content transition-colors hover:border-line-strong"
        >
          <Radio className="h-3.5 w-3.5 text-positive" /> Watch the floor
        </Link>
      </div>
    );
  }

  // Established & idle → a slim, low-profile nudge (less is more).
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-iris-soft text-iris-500">
        <Briefcase className="h-4 w-4" />
      </span>
      <p className="text-sm text-content">
        Your team is ready for the next task.
      </p>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onGiveJob}
          className="inline-flex items-center gap-1.5 rounded-lg bg-iris-gradient px-3 py-1.5 text-xs font-medium text-white shadow-[0_8px_24px_-12px_rgba(237,113,80,0.8)] transition-transform active:scale-95"
        >
          <Briefcase className="h-3.5 w-3.5" /> Give a job
        </button>
        <Link
          href="/agents/new"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-content-muted transition-colors hover:border-line-strong hover:text-content"
        >
          <Plus className="h-3.5 w-3.5" /> Hire a teammate
        </Link>
      </div>
    </div>
  );
}

const primaryBtn =
  "inline-flex items-center gap-1.5 rounded-xl bg-iris-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(237,113,80,0.8)] transition-transform active:scale-95";

function Prompt({
  eyebrow, title, body, primary,
}: {
  eyebrow: string; title: string; body: string; primary: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-iris-200 bg-iris-soft p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-iris-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-iris-600">{eyebrow}</p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-content">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-content-muted">{body}</p>
        </div>
        <div className="shrink-0">{primary}</div>
      </div>
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

