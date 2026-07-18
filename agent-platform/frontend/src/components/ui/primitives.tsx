"use client";
import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
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
  neutral: "bg-content/5 text-content-muted border-line",
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
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-content/[0.06]", className)}>
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
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-content/12 border-t-iris-400",
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
          : "border-line bg-content/[0.04] text-content-muted hover:border-line-strong hover:text-content hover:bg-content/[0.06]",
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
  return <div className={cn("shimmer rounded-lg bg-content/[0.05]", className)} />;
}

/* ---------- EmptyState ---------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      {icon && (
        <span className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-content/[0.05] text-content-subtle">
          {icon}
        </span>
      )}
      <p className="font-display text-sm font-semibold text-content">{title}</p>
      {description && <p className="max-w-xs text-xs text-content-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------- ErrorState ---------- */
export function ErrorState({
  title = "Couldn't load this",
  description = "Something went wrong reaching the server.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <span className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-danger/10 text-danger">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="font-display text-sm font-semibold text-content">{title}</p>
      <p className="max-w-xs text-xs text-content-muted">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-inset px-3 py-1.5 text-xs font-medium text-content transition-colors hover:border-line-strong hover:bg-content/[0.05]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

/* ---------- Banner (thin inline notice) ---------- */
export function Banner({
  tone = "danger",
  children,
  onRetry,
  className,
}: {
  tone?: "danger" | "warning" | "info";
  children: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  const tones = {
    danger: "border-danger/25 bg-danger/[0.07] text-danger",
    warning: "border-warning/25 bg-warning/[0.07] text-warning",
    info: "border-info/25 bg-info/[0.07] text-info",
  } as const;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-content-muted">{children}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-content transition-colors hover:bg-content/[0.06]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}
