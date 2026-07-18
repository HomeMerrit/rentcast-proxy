// Demo mode — a fully-populated, living AgentOS with no backend.
// Active whenever NEXT_PUBLIC_API_URL is not configured (e.g. the public demo deploy).
import type {
  Agent, AgentStat, ActivityItem, TimePoint, StatsOverview, NetworkGraph,
  AgentComm, AGUIEvent, AgentStatus, SkillCatalog, EvalSummary, Memory,
} from "@/types/agent";

export const DEMO = !process.env.NEXT_PUBLIC_API_URL;

const now = () => Date.now();
const iso = (msAgo: number) => new Date(now() - msAgo).toISOString();
const MIN = 60_000, HR = 3_600_000, DAY = 86_400_000;

type Seed = {
  id: string; name: string; title: string; dept: string; model: string;
  status: AgentStatus; tasks: number; ok: number; eval: number; task?: string;
  skills: [string, number][];
};

const SEEDS: Seed[] = [
  { id: "maya", name: "Maya Chen", title: "Lead Research Analyst", dept: "Research", model: "claude-sonnet-5", status: "active", tasks: 342, ok: 322, eval: 91, task: "Analyzing Q3 competitor pricing across 12 SaaS verticals", skills: [["Market Research", 92], ["Data Analysis", 88], ["Competitive Intel", 84], ["Report Writing", 79]] },
  { id: "ravi", name: "Ravi Menon", title: "Market Analyst", dept: "Research", model: "claude-haiku-4-5", status: "idle", tasks: 188, ok: 171, eval: 83, skills: [["Trend Analysis", 81], ["Survey Design", 74]] },
  { id: "jake", name: "Jake Rivera", title: "Sales Intelligence", dept: "Sales", model: "claude-sonnet-5", status: "thinking", tasks: 512, ok: 447, eval: 82, task: "Drafting outreach for 47 enterprise prospects", skills: [["Lead Qualification", 86], ["Email Drafting", 91], ["CRM Management", 74]] },
  { id: "sofia", name: "Sofia Marín", title: "Account Executive", dept: "Sales", model: "claude-sonnet-5", status: "active", tasks: 274, ok: 240, eval: 85, task: "Preparing the renewal deck for Northwind", skills: [["Negotiation", 83], ["Forecasting", 77], ["Demos", 88]] },
  { id: "sam", name: "Sam Ops", title: "Operations Manager", dept: "Operations", model: "claude-haiku-4-5", status: "idle", tasks: 921, ok: 894, eval: 90, skills: [["Workflow Automation", 95], ["System Monitoring", 89], ["Incident Response", 82]] },
  { id: "dana", name: "Dana Lin", title: "Logistics Coordinator", dept: "Operations", model: "claude-haiku-4-5", status: "active", tasks: 356, ok: 338, eval: 87, task: "Rebalancing the fulfillment queue", skills: [["Scheduling", 84], ["Vendor Ops", 79]] },
  { id: "ada", name: "Ada Reyes", title: "Support Specialist", dept: "Support", model: "claude-haiku-4-5", status: "active", tasks: 1187, ok: 1131, eval: 88, task: "Answering a billing question from Acme", skills: [["Ticket Triage", 90], ["Knowledge Base", 86], ["Sentiment", 80]] },
  { id: "theo", name: "Theo Park", title: "Support Lead", dept: "Support", model: "claude-sonnet-5", status: "idle", tasks: 604, ok: 566, eval: 86, skills: [["Escalation", 88], ["QA Review", 82], ["Coaching", 76]] },
  { id: "nora", name: "Nora Vale", title: "Finance Controller", dept: "Finance", model: "claude-sonnet-5", status: "active", tasks: 418, ok: 401, eval: 93, task: "Reconciling 128 invoice line items", skills: [["Reconciliation", 92], ["Reporting", 88], ["Forecasting", 81]] },
  { id: "omar", name: "Omar Haddad", title: "Billing Analyst", dept: "Finance", model: "claude-haiku-4-5", status: "idle", tasks: 233, ok: 221, eval: 84, skills: [["Invoicing", 85], ["Dunning", 72]] },
  { id: "leo", name: "Leo Park", title: "Automation Engineer", dept: "Engineering", model: "claude-sonnet-5", status: "thinking", tasks: 489, ok: 451, eval: 87, task: "Wiring a new data pipeline for Research", skills: [["Python", 90], ["Pipelines", 86], ["APIs", 83], ["Testing", 78]] },
  { id: "priya", name: "Priya Nair", title: "Data Engineer", dept: "Engineering", model: "claude-sonnet-5", status: "idle", tasks: 361, ok: 339, eval: 89, skills: [["SQL", 91], ["ETL", 85], ["Modeling", 80]] },
  { id: "iris", name: "Iris Vega", title: "Content Strategist", dept: "Marketing", model: "claude-sonnet-5", status: "active", tasks: 298, ok: 268, eval: 85, task: "Outlining the launch campaign for Q4", skills: [["Copywriting", 89], ["SEO", 81], ["Editing", 84]] },
  { id: "ben", name: "Ben Ortiz", title: "Growth Marketer", dept: "Marketing", model: "claude-haiku-4-5", status: "idle", tasks: 205, ok: 179, eval: 78, skills: [["Paid Ads", 80], ["Analytics", 76], ["A/B Testing", 73]] },
];

const DEPT_MODEL_COST: Record<string, number> = { "claude-sonnet-5": 0.009, "claude-haiku-4-5": 0.0016 };
const perTaskTokens = 3200;

const RESULTS: Record<string, string[]> = {
  Research: ["Identified 3 pricing gaps worth $2M ARR.", "Summarized 40 competitor pages into a 1-pager.", "Flagged a churn signal in the mid-market cohort."],
  Sales: ["Drafted 47 personalized outreach sequences.", "Qualified 12 inbound leads, 4 hot.", "Booked 3 demos for next week."],
  Operations: ["Cleared the fulfillment backlog to zero.", "All 24 agents nominal · queue depth 0.", "Rebalanced 8 shipments to hit SLA."],
  Support: ["Resolved the ticket, customer satisfied.", "Deflected 18 tickets with KB answers.", "Escalated 1 edge case to Theo."],
  Finance: ["Matched 128 line items · 2 flagged.", "Closed the month, variance < 0.4%.", "Sent 22 invoices, 3 reminders."],
  Engineering: ["Shipped the pipeline, tests green.", "Cut ETL runtime by 38%.", "Patched the flaky retry logic."],
  Marketing: ["Outlined a 6-week launch calendar.", "Rewrote the hero, +14% on the test.", "Queued 9 posts for the week."],
};

const TASK_TYPES: Record<string, string[]> = {
  Research: ["competitor_analysis", "market_scan", "trend_report"],
  Sales: ["outreach_draft", "lead_qualify", "deal_review"],
  Operations: ["health_check", "queue_rebalance", "sla_audit"],
  Support: ["ticket_resolve", "kb_answer", "escalation"],
  Finance: ["invoice_reconcile", "month_close", "billing_run"],
  Engineering: ["pipeline_build", "etl_optimize", "bugfix"],
  Marketing: ["campaign_plan", "copy_test", "content_queue"],
};

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const costOf = (s: Seed) => +(s.tasks * (DEPT_MODEL_COST[s.model] ?? 0.006)).toFixed(2);

export function agents(): Agent[] {
  return SEEDS.map((s, i) => ({
    id: `agent-${s.id}`,
    name: s.name, title: s.title, department: s.dept, model: s.model,
    bio: `${s.title} on the ${s.dept} team. Runs around the clock and improves from every task.`,
    avatar_seed: s.id, avatar_url: null, status: s.status,
    current_task: s.task, task_count: s.tasks, success_count: s.ok,
    created_at: iso(120 * DAY - i * DAY), updated_at: iso(i * 7 * MIN),
    skills: s.skills.map(([skill, p], k) => ({ id: `sk-${s.id}-${k}`, skill, proficiency: p, times_used: Math.round(s.tasks * (0.2 + k * 0.1)), last_used: iso((i + k) * HR) })),
    recent_work: [0, 1, 2].map((k) => ({
      id: `wl-${s.id}-${k}`, task_type: pick(TASK_TYPES[s.dept], k), task_input: {},
      result: pick(RESULTS[s.dept], k + i), reflection: "Would add more segmentation next time.",
      success: !(k === 2 && s.status === "error"), tokens_used: perTaskTokens - k * 300,
      duration_ms: 9000 + k * 2400, started_at: iso((k + 1) * HR), finished_at: iso((k + 1) * HR - 11000),
    })),
    recent_comms: [],
  }));
}

const A = agents();
const byId = (id: string) => A.find((a) => a.id === id)!;

export function agentStats(): AgentStat[] {
  return SEEDS.map((s, i) => ({
    id: `agent-${s.id}`, name: s.name, title: s.title, department: s.dept, status: s.status,
    avatar_seed: s.id, avatar_url: null, current_task: s.task ?? null,
    task_count: s.tasks, success_count: s.ok, success_rate: Math.round((s.ok / s.tasks) * 100),
    cost_usd: costOf(s), tokens: s.tasks * perTaskTokens, avg_eval: s.eval,
    last_active: s.status === "idle" ? iso((i + 1) * 6 * MIN) : iso(i * MIN),
  }));
}

export function overview(): StatsOverview {
  const st = agentStats();
  const tasks = st.reduce((a, b) => a + b.task_count, 0);
  const success = SEEDS.reduce((a, b) => a + b.ok, 0);
  const depts = Array.from(new Set(SEEDS.map((s) => s.dept))).map((d) => {
    const g = SEEDS.filter((s) => s.dept === d);
    return { department: d, agents: g.length, tasks: g.reduce((a, b) => a + b.tasks, 0), success: g.reduce((a, b) => a + b.ok, 0) };
  }).sort((a, b) => b.tasks - a.tasks);
  return {
    agents: SEEDS.length,
    active: SEEDS.filter((s) => s.status === "active" || s.status === "thinking").length,
    idle: SEEDS.filter((s) => s.status === "idle").length, error: 0,
    tasks, success, success_rate: Math.round((success / tasks) * 100),
    total_cost_usd: +st.reduce((a, b) => a + b.cost_usd, 0).toFixed(2),
    total_tokens: st.reduce((a, b) => a + b.tokens, 0),
    avg_eval: Math.round(SEEDS.reduce((a, b) => a + b.eval, 0) / SEEDS.length),
    departments: depts,
  };
}

export function activity(limit = 40): ActivityItem[] {
  const items: ActivityItem[] = [];
  SEEDS.forEach((s, i) => {
    [0, 1, 2].forEach((k) => {
      items.push({
        id: `act-${s.id}-${k}`, agent_id: `agent-${s.id}`, agent_name: s.name, avatar_seed: s.id,
        avatar_url: null, department: s.dept, task_type: pick(TASK_TYPES[s.dept], k),
        success: !(k === 2 && i % 7 === 0), cost_usd: +((DEPT_MODEL_COST[s.model] ?? 0.006) * (1 + k)).toFixed(3),
        tokens_used: perTaskTokens - k * 250, duration_ms: 8000 + k * 1800,
        result_preview: pick(RESULTS[s.dept], k + i),
        started_at: iso((i * 3 + k) * 7 * MIN + 11000), finished_at: iso((i * 3 + k) * 7 * MIN),
      });
    });
  });
  return items.sort((a, b) => (b.finished_at! > a.finished_at! ? 1 : -1)).slice(0, limit);
}

export function timeseries(days = 14): { days: number; series: TimePoint[] } {
  const series: TimePoint[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const base = 180 + (days - d) * 16 + Math.round(40 * Math.sin(d));
    const tasks = Math.max(60, base);
    series.push({
      date: new Date(now() - d * DAY).toISOString().slice(0, 10),
      tasks, cost: +(tasks * 0.0055).toFixed(2), tokens: tasks * perTaskTokens,
      success: Math.round(tasks * 0.94),
    });
  }
  return { days, series };
}

const EDGE_PAIRS: [string, string, number][] = [
  ["maya", "jake", 34], ["maya", "iris", 12], ["jake", "nora", 26], ["jake", "sofia", 19],
  ["nora", "sam", 15], ["sam", "dana", 22], ["sam", "ada", 9], ["ada", "theo", 28],
  ["leo", "maya", 17], ["leo", "priya", 24], ["iris", "ben", 14], ["sofia", "ada", 11],
  ["priya", "nora", 8], ["theo", "sam", 13], ["ben", "jake", 10],
];

export function network(): NetworkGraph {
  return {
    nodes: SEEDS.map((s) => ({
      id: `agent-${s.id}`, name: s.name, title: s.title, department: s.dept, status: s.status,
      avatar_seed: s.id, avatar_url: null, task_count: s.tasks,
      comm_count: EDGE_PAIRS.filter((e) => e[0] === s.id || e[1] === s.id).reduce((a, e) => a + e[2], 0),
    })),
    edges: EDGE_PAIRS.map(([f, t, c], i) => ({ from: `agent-${f}`, to: `agent-${t}`, count: c, last_at: iso(i * 4 * MIN) })),
    recent: EDGE_PAIRS.slice(0, 8).map(([f, t], i) => ({
      id: `a2a-${i}`, from_id: `agent-${f}`, to_id: `agent-${t}`,
      from_name: byId(`agent-${f}`).name, to_name: byId(`agent-${t}`).name,
      message: pick(["Handing this off — context attached.", "Can you take the numbers from here?", "Flagged for your review.", "Done on my side, over to you."], i),
      message_type: "task", created_at: iso(i * 5 * MIN),
    })),
  };
}

export function humanInbox(): AgentComm[] {
  return [
    { id: "hc-1", from_agent_id: "agent-jake", from_agent_name: "Jake Rivera", message: "Northwind is asking for a 12% discount to close today — approve?", message_type: "human_message", created_at: iso(6 * MIN), read: false },
    { id: "hc-2", from_agent_id: "agent-nora", from_agent_name: "Nora Vale", message: "Two invoice line items don't match the PO. Write them off or investigate?", message_type: "human_message", created_at: iso(22 * MIN), read: false },
    { id: "hc-3", from_agent_id: "agent-ada", from_agent_name: "Ada Reyes", message: "A customer wants a refund outside policy. How should I proceed?", message_type: "human_message", created_at: iso(51 * MIN), read: true },
  ];
}

const SKILLS_BY_DEPT: Record<string, string[]> = {
  Sales: ["Lead Qualification", "Email Drafting", "CRM Management", "Negotiation", "Forecasting", "Demos"],
  Marketing: ["Copywriting", "SEO", "Paid Ads", "Analytics", "A/B Testing", "Editing"],
  Research: ["Market Research", "Data Analysis", "Competitive Intel", "Trend Analysis", "Report Writing"],
  Operations: ["Workflow Automation", "System Monitoring", "Scheduling", "Vendor Ops", "Incident Response"],
  Finance: ["Reconciliation", "Reporting", "Invoicing", "Forecasting", "Dunning"],
  Support: ["Ticket Triage", "Knowledge Base", "Sentiment", "Escalation", "QA Review"],
  Engineering: ["Python", "Pipelines", "APIs", "SQL", "ETL", "Testing"],
};

function evalSummary(id: string): EvalSummary {
  const s = SEEDS.find((x) => `agent-${x.id}` === id);
  const base = s?.eval ?? 85;
  return { avg_score: base, total_evals: Math.round((s?.tasks ?? 100) / 6), min_score: base - 14, max_score: Math.min(99, base + 7), recent: [0, 1, 2, 3, 4].map((k) => ({ score: base + ((k % 2 ? 3 : -4) + k), created_at: iso((k + 1) * HR) })) };
}

function memories(id: string): Memory[] {
  const s = SEEDS.find((x) => `agent-${x.id}` === id);
  const d = s?.dept ?? "Research";
  return (RESULTS[d] ?? []).map((r, k) => ({ id: `mem-${id}-${k}`, content: r, task_type: pick(TASK_TYPES[d], k), created_at: iso((k + 1) * 2 * HR) }));
}

// Resolve a REST path → demo payload.
export function demoResponse(path: string): unknown {
  const p = path.split("?")[0];
  if (p === "/agents/" || p === "/agents") return A;
  const m = p.match(/^\/agents\/([^/]+)$/);
  if (m) return byId(m[1]) ?? A[0];
  if (/^\/agents\/[^/]+\/memories/.test(p)) return memories(p.split("/")[2]);
  if (/^\/agents\/[^/]+\/evals\/summary/.test(p)) return evalSummary(p.split("/")[2]);
  if (/^\/agents\/[^/]+\/evals/.test(p)) return [];
  if (p === "/stats/overview") return overview();
  if (p === "/stats/agents") return agentStats();
  if (p.startsWith("/stats/activity")) return activity();
  if (p.startsWith("/stats/timeseries")) return timeseries();
  if (p === "/stats/network") return network();
  if (p === "/comms/human-inbox") return humanInbox();
  if (p === "/comms/human-inbox/count") return { unread: humanInbox().filter((c) => !c.read).length };
  if (p === "/skills/catalog") return { departments: Object.entries(SKILLS_BY_DEPT).map(([department, skills]) => ({ department, skills })) } as SkillCatalog;
  if (p.startsWith("/skills/recommend")) {
    const dept = decodeURIComponent((path.split("department=")[1] || "").split("&")[0]) || "Sales";
    return { recommended: (SKILLS_BY_DEPT[dept] ?? SKILLS_BY_DEPT.Sales).slice(0, 4) };
  }
  if (p === "/company") return [];
  if (p === "/auth/keys") return { ok: true };
  // writes
  if (p.endsWith("/run")) return { task_id: "demo-task", agent_id: "demo", status: "started" };
  return {};
}

// ── Live fleet simulator ──────────────────────────────────────────────────────
const TOOLS = ["web_search", "sql_query", "send_email", "read_docs", "code_run", "crm_lookup"];
const SUB = ["A2A_SENT", "MEMORY_RETRIEVED", "REFLECTION", "HUMAN_NOTIFIED"];

let tick = 0;
export function nextFleetEvent(): AGUIEvent {
  tick++;
  const s = SEEDS[tick % SEEDS.length];
  const aid = `agent-${s.id}`;
  const roll = tick % 6;
  const t = new Date().toISOString();
  const mk = (type: AGUIEvent["type"], data: Record<string, unknown>): AGUIEvent => ({ type, agent_id: aid, data, timestamp: t });
  if (roll === 0) return mk("RUN_STARTED", { task_type: pick(TASK_TYPES[s.dept], tick) });
  if (roll === 1) return mk("TOOL_CALL_START", { tool_name: pick(TOOLS, tick) });
  if (roll === 2) return mk("TEXT_MESSAGE_CONTENT", { delta: pick(RESULTS[s.dept], tick) });
  if (roll === 3) { const sub = pick(SUB, tick); return mk("CUSTOM", { subtype: sub, to_agent: byId(aid).name, count: 3 + (tick % 5) }); }
  if (roll === 4) return mk("TOOL_CALL_RESULT", { result: "ok" });
  return mk("RUN_FINISHED", { tokens_used: 900 + (tick % 40) * 30 });
}
