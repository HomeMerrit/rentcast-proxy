import Image from "next/image";
import { StatusDot } from "./StatusDot";
import { avatarUrl } from "@/lib/utils";
import type { AgentStatus } from "@/types/agent";

interface Props {
  seed: string;
  name: string;
  status: AgentStatus;
  size?: number;
  url?: string | null;
  showStatus?: boolean;
}

export function AgentAvatar({ seed, name, status, size = 64, url, showStatus = true }: Props) {
  const src = url || avatarUrl(seed);
  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-2xl bg-surface-inset object-cover ring-1 ring-line-strong"
        unoptimized
      />
      {showStatus && (
        <span className="absolute -bottom-1 -right-1">
          <StatusDot status={status} size={size >= 64 ? "md" : "sm"} />
        </span>
      )}
    </div>
  );
}
