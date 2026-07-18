// ── Agent growth (the "Tamagotchi" layer) ────────────────────────────────────
// A single source of truth for how an agent levels up and how it's feeling.
//
// Everything here is DERIVED from real work the agent has already done — no new
// backend, no stored state. The level is computed only from fields that exist on
// *every* agent shape (task_count, success_count) so an agent shows the SAME
// level on the dashboard, its profile and the live floor. Richer signals
// (eval score, live status) only colour the *mood*, never the level number.

import type { AgentStatus } from "@/types/agent";

export type MoodTone = "positive" | "warning" | "danger" | "aqua" | "iris";

export interface Mood {
  label: string; // one warm word the user reads at a glance
  tone: MoodTone;
  hint: string; // a short caption explaining the feeling
}

export interface Growth {
  xp: number;
  level: number; // 1..7
  stage: string; // "Seasoned"
  next: string | null; // next stage name, or null at the top
  xpToNext: number | null; // XP remaining to the next stage
  pct: number; // 0..100 progress through the current level
  isMax: boolean;
  mood: Mood;
}

export interface GrowthInput {
  task_count: number;
  success_count?: number;
  avg_eval?: number | null; // 0..100, refines mood when present
  status?: AgentStatus;
}

// Plain-language growth ladder — instantly legible, a little playful, warm.
const STAGES: { name: string; at: number }[] = [
  { name: "Newcomer", at: 0 },
  { name: "Apprentice", at: 120 },
  { name: "Skilled", at: 360 },
  { name: "Seasoned", at: 800 },
  { name: "Expert", at: 1600 },
  { name: "Master", at: 3200 },
  { name: "Legend", at: 6000 },
];

/** XP earned from real work. Finishing jobs earns XP; succeeding earns a bonus. */
export function agentXp(input: GrowthInput): number {
  const tasks = Math.max(0, input.task_count || 0);
  const success = Math.max(0, Math.min(tasks, input.success_count ?? 0));
  return tasks * 12 + success * 8;
}

/** How the agent is "feeling" right now — the sticky, alive care signal. */
export function agentMood(input: GrowthInput): Mood {
  switch (input.status) {
    case "error":
      return { label: "Needs a look", tone: "danger", hint: "Ran into trouble on its last job." };
    case "active":
      return { label: "In the zone", tone: "positive", hint: "Working on a job right now." };
    case "thinking":
      return { label: "Thinking it over", tone: "aqua", hint: "Reasoning through a problem." };
    default:
      break;
  }

  const tasks = input.task_count || 0;
  if (tasks === 0)
    return { label: "Fresh start", tone: "iris", hint: "Brand new — give it a first job." };

  const rate = Math.round(((input.success_count ?? 0) / tasks) * 100);
  const quality = input.avg_eval != null ? input.avg_eval : rate;
  if (quality >= 85) return { label: "Thriving", tone: "positive", hint: "Doing great work lately." };
  if (quality >= 65) return { label: "Happy", tone: "positive", hint: "Steady and reliable." };
  if (quality >= 40) return { label: "Learning", tone: "warning", hint: "Still finding its footing." };
  return { label: "Needs care", tone: "danger", hint: "Struggling lately — check in on it." };
}

export function agentGrowth(input: GrowthInput): Growth {
  const xp = agentXp(input);

  let i = 0;
  for (let k = 0; k < STAGES.length; k++) if (xp >= STAGES[k].at) i = k;

  const cur = STAGES[i];
  const next = STAGES[i + 1] ?? null;
  const isMax = !next;
  const span = next ? next.at - cur.at : 1;
  const pct = isMax ? 100 : Math.max(0, Math.min(100, Math.round(((xp - cur.at) / span) * 100)));

  return {
    xp,
    level: i + 1,
    stage: cur.name,
    next: next?.name ?? null,
    xpToNext: next ? next.at - xp : null,
    pct,
    isMax,
    mood: agentMood(input),
  };
}

/** A one-line nudge that tells the user how to make this agent grow. */
export function growthHint(g: Growth): string {
  if (g.isMax) return "Top of the ladder — a true Legend.";
  if (g.xp === 0) return `Give them a first job to start earning XP toward ${g.next}.`;
  return `Every finished job earns XP toward ${g.next} — great results earn more.`;
}
