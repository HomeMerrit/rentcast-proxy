"use client";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { agentGrowth, growthHint, type Growth, type GrowthInput, type MoodTone } from "@/lib/growth";

const MOOD_DOT: Record<MoodTone, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  danger: "bg-danger",
  aqua: "bg-aqua",
  iris: "bg-iris-500",
};

const MOOD_TEXT: Record<MoodTone, string> = {
  positive: "text-positive",
  warning: "text-warning",
  danger: "text-danger",
  aqua: "text-aqua",
  iris: "text-iris-600",
};

// ── Small parts ───────────────────────────────────────────────────────────────

export function LevelChip({ growth: g, className }: { growth: Growth; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-surface-inset px-2 py-0.5 text-2xs font-medium text-content",
        className
      )}
    >
      <span className="text-iris-600">Lv {g.level}</span>
      <span className="text-content-subtle/70">·</span>
      <span>{g.stage}</span>
    </span>
  );
}

export function MoodPill({ mood }: { mood: Growth["mood"] }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-2xs font-medium", MOOD_TEXT[mood.tone])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", MOOD_DOT[mood.tone])} />
      {mood.label}
    </span>
  );
}

export function XpBar({ growth: g, className }: { growth: Growth; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-inset", className)}>
      <div
        className="h-full rounded-full bg-iris-500 transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(g.xp > 0 ? 6 : 0, g.pct)}%` }}
      />
    </div>
  );
}

// ── Compact strip — for agent cards & live tiles ──────────────────────────────

export function CardGrowth({ input, className }: { input: GrowthInput; className?: string }) {
  const g = agentGrowth(input);
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <LevelChip growth={g} />
        <MoodPill mood={g.mood} />
      </div>
      <XpBar growth={g} />
    </div>
  );
}

// ── Rich panel — for the agent profile (the daily "visit your agent" moment) ──

export function GrowthPanel({ input }: { input: GrowthInput }) {
  const g = agentGrowth(input);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-iris-200 bg-iris-soft p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-iris-500/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/70 shadow-sm ring-1 ring-iris-200">
              <span className="font-display text-lg font-semibold tabular-nums text-iris-600">{g.level}</span>
            </div>
            <div>
              <p className="flex items-center gap-1 text-2xs font-medium uppercase tracking-[0.12em] text-iris-600">
                <Sparkles className="h-3 w-3" /> Level {g.level}
              </p>
              <p className="font-display text-lg font-semibold leading-tight text-content">{g.stage}</p>
            </div>
          </div>
          <MoodPill mood={g.mood} />
        </div>

        <div className="mt-4">
          <XpBar growth={g} />
          <div className="mt-1.5 flex items-center justify-between text-2xs">
            <span className="tabular-nums text-content-muted">{g.xp.toLocaleString()} XP</span>
            <span className="font-medium text-iris-600">
              {g.isMax ? "Max level reached" : `${g.xpToNext?.toLocaleString()} XP to ${g.next}`}
            </span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-content-muted">{growthHint(g)}</p>
      </div>
    </div>
  );
}
