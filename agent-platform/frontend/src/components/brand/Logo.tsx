import Link from "next/link";
import { cn } from "@/lib/utils";

/** ApeAgents mark — the blocky ape head (same proportions as the locked
 *  mascot's face panel), orange with the lit muzzle. Always links home. */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <Link href="/" aria-label="ApeAgents home" className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 40 40" className="h-7 w-7" aria-hidden>
        {/* ears */}
        <rect x="2" y="14" width="6" height="12" rx="1.5" fill="#F58220" />
        <rect x="32" y="14" width="6" height="12" rx="1.5" fill="#F58220" />
        {/* head */}
        <rect x="6" y="7" width="28" height="26" rx="3" fill="#F58220" />
        {/* brow */}
        <rect x="8" y="10" width="24" height="5" rx="1.5" fill="#E07012" />
        {/* eyes */}
        <rect x="11" y="17" width="5" height="6" rx="1" fill="#1E1B18" />
        <rect x="24" y="17" width="5" height="6" rx="1" fill="#1E1B18" />
        <rect x="12" y="18" width="2" height="2" fill="#fff" />
        <rect x="25" y="18" width="2" height="2" fill="#fff" />
        {/* muzzle */}
        <rect x="12" y="24" width="16" height="8" rx="2" fill="#F9A23F" />
        <rect x="16" y="26" width="2" height="2" rx="0.5" fill="#1E1B18" />
        <rect x="22" y="26" width="2" height="2" rx="0.5" fill="#1E1B18" />
        <rect x="15" y="29.5" width="10" height="1.6" rx="0.8" fill="#B85712" />
      </svg>
      {showText && (
        <span className="font-display text-[1.05rem] font-semibold tracking-tight text-content">
          Ape<span className="text-iris-300">Agents</span>
        </span>
      )}
    </Link>
  );
}
