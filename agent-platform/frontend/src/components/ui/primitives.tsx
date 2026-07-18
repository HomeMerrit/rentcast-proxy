"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------- Card ---------- */
export function Card({
  className,
  interactive,
  glow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; glow?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-card",
        interactive &&
          "transition-all duration-300 hover:border-line-strong hover:-translate-y-0.5 hover:shadow-raised",
        glow && "shadow-glow",
        className
      )}
      {...props}
    />
  );
}

/* ---------- Badge ---------- */
type Tone = "iris" | "aqua" | "positive" | "warning" | "danger" | "info" | "neutral";
const toneMap: Record<Tone, string> = {
  iris: "bg-iris-500/12 text-iris-300 border-iris-500/25",
  aqua: "bg-aqua/10 text-aqua border-aqua/25",
  positive: "bg-positive/12 text-positive border-positive/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  danger: "bg-danger/12 text-danger border-danger/25",
  info: "bg-info/12 text-info border-info/25",
  neutral: "bg-white/5 text-content-muted border-line",
};
export function Badge({
  tone = "neutral",
  className,
  children,
  icon,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium",
        toneMap[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ---------- Progress ---------- */
export function Progress({
  value,
  className,
  tone = "iris",
  showGlow = true,
}: {
  value: number;
  className?: string;
  tone?: "iris" | "positive" | "warning" | "danger";
  showGlow?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const bar =
    tone === "iris"
      ? "bg-iris-gradient"
      : tone === "positive"
      ? "bg-positive"
      : tone === "warning"
      ? "bg-warning"
      : "bg-danger";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/6", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bar, showGlow && tone === "iris" && "shadow-[0_0_12px_rgba(237,113,80,0.6)]")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ---------- Spinner ---------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-iris-400",
        className
      )}
    />
  );
}

/* ---------- Chip (selectable) ---------- */
export function Chip({
  selected,
  onClick,
  children,
  className,
  icon,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95",
        selected
          ? "border-iris-400/50 bg-iris-500/15 text-iris-200 shadow-[0_0_0_1px_rgba(237,113,80,0.3),0_0_20px_-8px_rgba(237,113,80,0.7)]"
          : "border-line bg-white/[0.03] text-content-muted hover:border-line-strong hover:text-content hover:bg-white/[0.06]",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg bg-white/[0.04]", className)} />;
}
