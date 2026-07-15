import Image from "next/image";
import { StatusDot } from "./StatusDot";
import { avatarUrl } from "@/lib/utils";
import type { AgentStatus } from "@/types/agent";

interface Props {
  seed: string;
  name: string;
  status: AgentStatus;
  size?: number;
}

export function AgentAvatar({ seed, name, status, size = 64 }: Props) {
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <Image
        src={avatarUrl(seed)}
        alt={name}
        width={size}
        height={size}
        className="rounded-full bg-gray-800 ring-2 ring-gray-700"
        unoptimized
      />
      <span className="absolute bottom-0 right-0 translate-x-1 translate-y-1">
        <StatusDot status={status} size={size >= 64 ? "md" : "sm"} />
      </span>
    </div>
  );
}
