import type { WorkLogEntry } from "@/types/agent";

interface Props {
  entries: WorkLogEntry[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function WorkLogFeed({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-content-subtle text-sm">No tasks recorded yet.</div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="bg-surface border border-line rounded-lg p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${entry.success ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="text-sm font-medium text-content">{entry.task_type.replace(/_/g, " ")}</span>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-xs text-content-subtle">{timeAgo(entry.started_at)}</span>
              {entry.duration_ms && (
                <p className="text-xs text-content-subtle">{(entry.duration_ms / 1000).toFixed(1)}s</p>
              )}
            </div>
          </div>

          {entry.result && (
            <p className="mt-2 text-sm text-content-muted pl-4">{entry.result}</p>
          )}

          {entry.reflection && (
            <div className="mt-2 pl-4 border-l-2 border-amber-500/30">
              <p className="text-xs text-amber-500/80 italic">
                Reflection: {entry.reflection}
              </p>
            </div>
          )}

          <div className="mt-2 pl-4 text-xs text-content-subtle">
            {entry.tokens_used.toLocaleString()} tokens
          </div>
        </div>
      ))}
    </div>
  );
}
