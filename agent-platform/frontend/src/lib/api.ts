import type {
  Agent,
  Memory,
  AgentCard,
  AgentComm,
  EvalResult,
  EvalSummary,
  AgentConfigInfo,
  Company,
  CompanyDocument,
  SkillCatalog,
  StatsOverview,
  AgentStat,
  ActivityItem,
  TimePoint,
  NetworkGraph,
} from "@/types/agent";

export const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authKey(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("agentos_api_key") : null;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = authKey();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Multipart upload — do NOT set Content-Type (browser sets the boundary). */
async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const apiKey = authKey();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: form,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export interface AgentCreateInput {
  name: string;
  title: string;
  department: string;
  bio?: string;
  avatar_seed: string;
  avatar_url?: string | null;
  model?: string;
  company_id?: string | null;
}

export const api = {
  agents: {
    list: () => apiFetch<Agent[]>("/agents/"),
    get: (id: string) => apiFetch<Agent>(`/agents/${id}`),
    create: (input: AgentCreateInput) =>
      apiFetch<Agent>("/agents/", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, patch: Partial<AgentCreateInput>) =>
      apiFetch<Agent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (id: string) => apiFetch<void>(`/agents/${id}`, { method: "DELETE" }),
    addSkills: (id: string, skills: { skill: string; proficiency?: number }[]) =>
      apiFetch<Agent>(`/agents/${id}/skills`, {
        method: "POST",
        body: JSON.stringify({ skills }),
      }),
    removeSkill: (id: string, skillId: string) =>
      apiFetch<void>(`/agents/${id}/skills/${skillId}`, { method: "DELETE" }),
    run: (id: string, task_type: string, task_input: Record<string, unknown> = {}) =>
      apiFetch<{ task_id: string; agent_id: string; status: string }>(`/agents/${id}/run`, {
        method: "POST",
        body: JSON.stringify({ task_type, task_input }),
      }),
    updateStatus: (id: string, status: string, current_task?: string | null) =>
      apiFetch<Agent>(`/agents/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, current_task: current_task ?? null }),
      }),
  },
  skills: {
    catalog: () => apiFetch<SkillCatalog>("/skills/catalog"),
    recommend: (department: string, title?: string) =>
      apiFetch<{ recommended: string[] }>(
        `/skills/recommend?department=${encodeURIComponent(department)}${
          title ? `&title=${encodeURIComponent(title)}` : ""
        }`
      ),
  },
  company: {
    list: () => apiFetch<Company[]>("/company"),
    get: (id: string) => apiFetch<Company>(`/company/${id}`),
    create: (input: Partial<Company> & { name: string }) =>
      apiFetch<Company>("/company", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, patch: Partial<Company>) =>
      apiFetch<Company>(`/company/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    documents: (id: string) => apiFetch<CompanyDocument[]>(`/company/${id}/documents`),
    uploadDocuments: (id: string, files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      return apiUpload<CompanyDocument[]>(`/company/${id}/documents`, form);
    },
  },
  memories: {
    list: (agentId: string) => apiFetch<Memory[]>(`/agents/${agentId}/memories`),
    search: (agentId: string, q: string) =>
      apiFetch<Memory[]>(`/agents/${agentId}/memories/search?q=${encodeURIComponent(q)}&limit=5`),
    add: (agentId: string, content: string, task_type = "manual") =>
      apiFetch<{ id: string; agent_id: string; content: string }>(`/agents/${agentId}/memories`, {
        method: "POST",
        body: JSON.stringify({ content, task_type }),
      }),
    delete: (agentId: string, memoryId: string) =>
      apiFetch<void>(`/agents/${agentId}/memories/${memoryId}`, { method: "DELETE" }),
  },
  comms: {
    humanInbox: (unread_only = false) =>
      apiFetch<AgentComm[]>(`/comms/human-inbox${unread_only ? "?unread_only=true" : ""}`),
    unreadCount: () => apiFetch<{ unread: number }>("/comms/human-inbox/count"),
    reply: (commId: string, message: string) =>
      apiFetch<AgentComm>(`/comms/${commId}/reply`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    markRead: (commId: string) =>
      apiFetch<{ ok: boolean }>(`/comms/${commId}/read`, { method: "PATCH" }),
  },
  evals: {
    list: (agentId: string) => apiFetch<EvalResult[]>(`/agents/${agentId}/evals`),
    summary: (agentId: string) => apiFetch<EvalSummary>(`/agents/${agentId}/evals/summary`),
    config: (agentId: string) => apiFetch<AgentConfigInfo>(`/agents/${agentId}/config`),
    evolve: (agentId: string) =>
      apiFetch<{ status: string; agent_id: string }>(`/agents/${agentId}/evolve`, {
        method: "POST",
      }),
  },
  a2a: {
    card: (agentId: string) => apiFetch<AgentCard>(`/agents/${agentId}/card`),
    platformCard: () => apiFetch<Record<string, unknown>>("/.well-known/agent-card.json"),
  },
  stats: {
    overview: () => apiFetch<StatsOverview>("/stats/overview"),
    agents: () => apiFetch<AgentStat[]>("/stats/agents"),
    activity: (limit = 40) => apiFetch<ActivityItem[]>(`/stats/activity?limit=${limit}`),
    timeseries: (days = 14) => apiFetch<{ days: number; series: TimePoint[] }>(`/stats/timeseries?days=${days}`),
    network: () => apiFetch<NetworkGraph>("/stats/network"),
  },
};
