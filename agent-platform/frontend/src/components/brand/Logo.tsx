import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-iris-gradient shadow-[0_6px_18px_-6px_rgba(114,87,255,0.9)]">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
          <path
            d="M12 2.5 4 7v10l8 4.5 8-4.5V7l-8-4.5Z"
            stroke="white"
            strokeWidth="1.6"
            strokeLinejoin="round"
            opacity="0.9"
          />
          <circle cx="12" cy="12" r="2.4" fill="white" />
        </svg>
      </span>
      {showText && (
        <span className="font-display text-[0.95rem] font-semibold tracking-tight text-content">
          Agent<span className="text-gradient">OS</span>
        </span>
      )}
    </span>
  );
}
