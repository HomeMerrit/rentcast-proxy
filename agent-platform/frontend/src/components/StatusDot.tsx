import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/types/agent";

const STATUS_CONFIG: Record<AgentStatus, { color: string; pulse: boolean; label: string }> = {
  active: { color: "bg-emerald-500", pulse: true, label: "Active" },
  thinking: { color: "bg-amber-400", pulse: true, label: "Thinking" },
  idle: { color: "bg-slate-500", pulse: false, label: "Idle" },
  error: { color: "bg-red-500", pulse: false, label: "Error" },
  offline: { color: "bg-slate-700", pulse: false, label: "Offline" },
};

interface Props {
  status: AgentStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function StatusDot({ status, size = "md", showLabel = false }: Props) {
  const { color, pulse, label } = STATUS_CONFIG[status];
  const sizeClass = { sm: "h-2 w-2", md: "h-3 w-3", lg: "h-4 w-4" }[size];

  return (
    <span className="flex items-center gap-2">
      <span className="relative flex">
        {pulse && (
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", color)} />
        )}
        <span className={cn("relative inline-flex rounded-full", sizeClass, color)} />
      </span>
      {showLabel && <span className="text-sm text-gray-400">{label}</span>}
    </span>
  );
}
