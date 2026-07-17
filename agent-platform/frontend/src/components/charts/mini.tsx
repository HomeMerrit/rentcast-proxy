"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

/* ---------- Horizontal bar list (single-hue magnitude per category) ---------- */
export function BarList({
  items,
  format = (v: number) => String(v),
}: {
  items: { label: string; value: number; sub?: string }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label} className="group">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="truncate text-content-muted">{it.label}</span>
            <span className="tabular-nums text-content">{format(it.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full bg-iris-gradient transition-[width] duration-700 ease-out"
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-content-subtle">No data yet.</p>}
    </div>
  );
}

/* ---------- Radial gauge (a single percentage / rate) ---------- */
export function RadialGauge({
  value,
  size = 132,
  label,
  sublabel,
  tone = "positive",
}: {
  value: number; // 0..100
  size?: number;
  label?: string;
  sublabel?: string;
  tone?: "positive" | "iris" | "warning";
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === "positive" ? "#34d399" : tone === "warning" ? "#fbbf24" : "#7257ff";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold tabular-nums text-content">
          {label ?? `${Math.round(pct)}%`}
        </span>
        {sublabel && <span className="text-2xs text-content-subtle">{sublabel}</span>}
      </div>
    </div>
  );
}

/* ---------- Sparkline (tiny inline trend) ---------- */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  tone = "iris",
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: "iris" | "positive" | "aqua";
}) {
  const color = tone === "positive" ? "#34d399" : tone === "aqua" ? "#22d3ee" : "#7257ff";
  if (data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Segmented control (filters) ---------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
            value === o.value ? "bg-surface-overlay text-content" : "text-content-subtle hover:text-content-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function useSegment<T extends string>(initial: T) {
  return useState<T>(initial);
}
