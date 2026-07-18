import { StatusDot } from "./StatusDot";
import type { AgentStatus } from "@/types/agent";

interface Props {
  seed: string;
  name: string;
  status: AgentStatus;
  size?: number;
  url?: string | null;
  showStatus?: boolean;
}

// Warm department-flavored gradients. Self-contained (no external avatar service).
const GRADS: [string, string][] = [
  ["#5A97D6", "#7FB0E0"], ["#4FB0AA", "#6FC7C0"], ["#E08A5B", "#F0A35B"], ["#E6AE3C", "#F0C65B"],
  ["#8B79D4", "#A99BE0"], ["#E06A9A", "#F08BC0"], ["#ED7150", "#F2936F"], ["#6BB47C", "#8FCF9E"],
];

export function avatarHue(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADS[h % GRADS.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase() || "A";
}

export function AgentAvatar({ seed, name, status, size = 64, url, showStatus = true }: Props) {
  const [c0, c1] = avatarHue(seed || name);
  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <div
        className="grid place-items-center overflow-hidden rounded-2xl font-semibold text-white ring-1 ring-black/5"
        style={{
          width: size, height: size, fontSize: Math.round(size * 0.38),
          background: url ? "var(--tw-color-surface-inset, #F0E7D5)" : `linear-gradient(135deg, ${c0}, ${c1})`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} width={size} height={size} className="h-full w-full object-cover" />
        ) : (
          initialsOf(name)
        )}
      </div>
      {showStatus && (
        <span className="absolute -bottom-1 -right-1">
          <StatusDot status={status} size={size >= 64 ? "md" : "sm"} />
        </span>
      )}
    </div>
  );
}
