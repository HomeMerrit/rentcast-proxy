const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchAgents() {
  const res = await fetch(`${API_URL}/agents`, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
}

export async function fetchAgent(id: string) {
  const res = await fetch(`${API_URL}/agents/${id}`, { next: { revalidate: 5 } });
  if (!res.ok) throw new Error("Failed to fetch agent");
  return res.json();
}

export async function updateAgentStatus(id: string, status: string, current_task?: string) {
  const res = await fetch(`${API_URL}/agents/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, current_task }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}
