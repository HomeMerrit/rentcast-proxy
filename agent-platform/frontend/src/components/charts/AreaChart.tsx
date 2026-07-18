"use client";
import { useMemo, useRef, useState } from "react";

export interface AreaPoint {
  label: string; // x label (e.g. date)
  value: number;
}

/**
 * Single-series area chart — magnitude over time. One iris hue (no categorical
 * palette). Crosshair + tooltip on hover, recessive axes, 2px line, filled area.
 */
export function AreaChart({
  data,
  height = 160,
  tone = "iris",
  format = (v: number) => String(v),
  valueLabel = "value",
}: {
  data: AreaPoint[];
  height?: number;
  tone?: "iris" | "positive" | "aqua";
  format?: (v: number) => string;
  valueLabel?: string;
}) {
  const W = 640;
  const H = height;
  const padX = 8;
  const padTop = 12;
  const padBottom = 22;
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const color =
    tone === "positive" ? "#4E9E63" : tone === "aqua" ? "#5A97D6" : "#ED7150";

  const { points, max, xs, ys, areaPath, linePath } = useMemo(() => {
    const n = data.length;
    if (n === 0) return { points: [], max: 1, xs: [], ys: [], areaPath: "", linePath: "" };
    const max = Math.max(1, ...data.map((d) => d.value));
    const innerW = W - padX * 2;
    const innerH = H - padTop - padBottom;
    const xs = data.map((_, i) => padX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW));
    const ys = data.map((d) => padTop + innerH - (d.value / max) * innerH);
    const points = data.map((d, i) => ({ x: xs[i], y: ys[i], ...d }));
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const baseY = padTop + innerH;
    const areaPath = `${linePath} L${xs[n - 1].toFixed(1)},${baseY} L${xs[0].toFixed(1)},${baseY} Z`;
    return { points, max, xs, ys, areaPath, linePath };
  }, [data, H]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    xs.forEach((px, i) => {
      const d = Math.abs(px - x);
      if (d < best) { best = d; nearest = i; }
    });
    setHover(nearest);
  };

  const id = `grad-${tone}`;
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-content-subtle" style={{ height }}>
        No data yet
      </div>
    );
  }
  const hi = hover != null ? points[hover] : null;
  // sparse x labels: first, middle, last
  const labelIdx = new Set([0, Math.floor(data.length / 2), data.length - 1]);

  return (
    <div className="relative w-full">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={padTop + (H - padTop - padBottom) * f}
            y2={padTop + (H - padTop - padBottom) * f}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}
        <path d={areaPath} fill={`url(#${id})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* hover crosshair */}
        {hi && (
          <>
            <line x1={hi.x} x2={hi.x} y1={padTop} y2={H - padBottom} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
            <circle cx={hi.x} cy={hi.y} r={4.5} fill={color} stroke="#20273f" strokeWidth={2} />
          </>
        )}
        {/* x labels */}
        {points.map((p, i) =>
          labelIdx.has(i) ? (
            <text
              key={i}
              x={Math.min(Math.max(p.x, 18), W - 18)}
              y={H - 6}
              fill="#877F6E"
              fontSize={11}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            >
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      {hi && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-surface-overlay/95 px-2.5 py-1.5 text-2xs shadow-raised backdrop-blur-xl"
          style={{ left: `${(hi.x / W) * 100}%`, top: 4 }}
        >
          <div className="font-medium text-content">{format(hi.value)}</div>
          <div className="text-content-subtle">{hi.label} · {valueLabel}</div>
        </div>
      )}
    </div>
  );
}
