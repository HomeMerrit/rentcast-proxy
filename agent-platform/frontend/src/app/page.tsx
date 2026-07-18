import { redirect } from "next/navigation";
import { CommandCenter } from "@/components/CommandCenter";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Only treat an *empty* successful response as first-run. If the call fails
  // (backend unreachable), fall through to the Command Center, which shows its
  // own retryable error banner — don't bounce the user into onboarding.
  let reachable = true;
  let agents: Awaited<ReturnType<typeof api.agents.list>> = [];
  try {
    agents = await api.agents.list();
  } catch {
    reachable = false;
  }
  if (reachable && agents.length === 0) redirect("/onboarding");
  return <CommandCenter />;
}
