"use client";
import { useEffect, useRef } from "react";
import { avatarHue } from "./AgentAvatar";
import { kitKeyOf, patternOf, jerseyNumberOf, vestPatternCanvas, kitShades } from "@/components/world/kit";

/** Flat badge of an agent's kit identity — the exact accent, pattern and squad
 *  number its 3D mascot wears, for 2D surfaces (cards, rows, tickers). */
export function KitChip({
  agent,
  className = "",
}: {
  agent: { id: string; avatar_seed?: string | null; name: string };
  className?: string;
}) {
  const key = kitKeyOf(agent);
  const accent = avatarHue(agent.avatar_seed || agent.name)[0];
  const pattern = patternOf(key);
  const number = jerseyNumberOf(key);
  const swatch = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = swatch.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, cv.width, cv.height);
    // same artwork the vest wears, at chip scale
    ctx.drawImage(vestPatternCanvas(pattern, accent, 64), 0, 0, cv.width, cv.height);
  }, [accent, pattern]);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-semibold tabular-nums ${className}`}
      style={{ borderColor: `${accent}55`, background: `${accent}14`, color: kitShades(accent).dark }}
      title={`Kit #${String(number).padStart(2, "0")} · ${pattern}`}
    >
      <canvas ref={swatch} width={32} height={32} className="h-3.5 w-3.5 rounded-[4px] ring-1 ring-black/10" />
      #{String(number).padStart(2, "0")}
    </span>
  );
}
