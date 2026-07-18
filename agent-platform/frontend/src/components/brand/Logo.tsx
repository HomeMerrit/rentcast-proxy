import { cn } from "@/lib/utils";

/** Atlas mark — a little isometric building block (the brand object), coral window lit. */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 40 40" className="h-7 w-7" aria-hidden>
        <polygon points="20,6 32,12.5 20,19 8,12.5" fill="#EDBE5E" />
        <polygon points="8,12.5 20,19 20,32 8,25.5" fill="#EBDFCB" />
        <polygon points="20,19 32,12.5 32,25.5 20,32" fill="#DCCDB2" />
        <polygon points="22,22 28,18.7 28,24 22,27.3" fill="#ED7150" opacity="0.95" />
      </svg>
      {showText && (
        <span className="font-display text-[1.05rem] font-semibold tracking-tight text-content">
          Atlas
        </span>
      )}
    </span>
  );
}
