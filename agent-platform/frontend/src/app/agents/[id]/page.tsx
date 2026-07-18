import Link from "next/link";
import { AgentProfile } from "@/components/AgentProfile";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";

// Next.js 15: params is a Promise
export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let agent = null;
  let unreachable = false;
  try {
    agent = await api.agents.get(id);
  } catch (e) {
    // A genuine 404 is "no such agent"; anything else (network/5xx) is the
    // backend being unreachable — don't mislabel that as "not found".
    if (e instanceof Error && /→ 404$/.test(e.message)) return notFound();
    unreachable = true;
  }

  if (unreachable) {
    return (
      <main className="app-backdrop grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold text-content">Can&apos;t load this agent</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-content-muted">
            The server didn&apos;t respond. It may be starting up or temporarily unavailable.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link href={`/agents/${id}`} className="rounded-xl bg-iris-gradient px-4 py-2 text-sm font-medium text-white">
              Try again
            </Link>
            <Link href="/" className="rounded-xl border border-line bg-surface px-4 py-2 text-sm text-content-muted hover:text-content">
              Back to command center
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!agent) return notFound();
  return <AgentProfile agent={agent} />;
}
