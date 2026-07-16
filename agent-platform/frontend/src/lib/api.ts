import type { Agent } from "@/types/agent";

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
};
