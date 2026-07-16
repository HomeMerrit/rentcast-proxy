import type { Agent, Memory, AgentCard, AgentComm, EvalResult, EvalSummary, AgentConfigInfo } from "@/types/agent";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  agents: {
    list: () => apiFetch<Agent[]>("/agents/"),
    get: (id: string) => apiFetch<Agent>(`/agents/${id}`),
    run: (
      id: string,
      task_type: string,
      task_input: Record<string, unknown> = {}
    ) =>
      apiFetch<{ task_id: string; agent_id: string; status: string }>(
        `/agents/${id}/run`,
        {
          method: "POST",
          body: JSON.stringify({ task_type, task_input }),
        }
      ),
    updateStatus: (
      id: string,
      status: string,
      current_task?: string | null
    ) =>
      apiFetch<Agent>(`/agents/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, current_task: current_task ?? null }),
      }),
  },
  memories: {
    list: (agentId: string) =>
      apiFetch<Memory[]>(`/agents/${agentId}/memories`),
    search: (agentId: string, q: string) =>
      apiFetch<Memory[]>(
        `/agents/${agentId}/memories/search?q=${encodeURIComponent(q)}&limit=5`
      ),
    add: (agentId: string, content: string, task_type = "manual") =>
      apiFetch<{ id: string; agent_id: string; content: string }>(
        `/agents/${agentId}/memories`,
        {
          method: "POST",
          body: JSON.stringify({ content, task_type }),
        }
      ),
    delete: (agentId: string, memoryId: string) =>
      apiFetch<void>(`/agents/${agentId}/memories/${memoryId}`, {
        method: "DELETE",
      }),
  },
  comms: {
    humanInbox: (unread_only = false) =>
      apiFetch<AgentComm[]>(`/comms/human-inbox${unread_only ? "?unread_only=true" : ""}`),
    unreadCount: () =>
      apiFetch<{ unread: number }>("/comms/human-inbox/count"),
    reply: (commId: string, message: string) =>
      apiFetch<AgentComm>(`/comms/${commId}/reply`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    markRead: (commId: string) =>
      apiFetch<{ ok: boolean }>(`/comms/${commId}/read`, { method: "PATCH" }),
  },
  evals: {
    list: (agentId: string) =>
      apiFetch<EvalResult[]>(`/agents/${agentId}/evals`),
    summary: (agentId: string) =>
      apiFetch<EvalSummary>(`/agents/${agentId}/evals/summary`),
    config: (agentId: string) =>
      apiFetch<AgentConfigInfo>(`/agents/${agentId}/config`),
    evolve: (agentId: string) =>
      apiFetch<{ status: string; agent_id: string }>(`/agents/${agentId}/evolve`, {
        method: "POST",
      }),
  },
  a2a: {
    card: (agentId: string) =>
      apiFetch<AgentCard>(`/agents/${agentId}/card`),
    platformCard: () =>
      apiFetch<Record<string, unknown>>("/.well-known/agent-card.json"),
  },
};
