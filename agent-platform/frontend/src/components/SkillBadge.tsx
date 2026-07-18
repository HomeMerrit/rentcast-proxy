import type { AgentSkill } from "@/types/agent";

interface Props {
  skill: AgentSkill;
}

export function SkillBadge({ skill }: Props) {
  const level =
    skill.proficiency >= 90 ? "Expert" :
    skill.proficiency >= 75 ? "Advanced" :
    skill.proficiency >= 60 ? "Intermediate" : "Learning";

  const barColor =
    skill.proficiency >= 90 ? "bg-emerald-500" :
    skill.proficiency >= 75 ? "bg-brand-500" :
    skill.proficiency >= 60 ? "bg-amber-400" : "bg-content-muted";

  return (
    <div className="bg-surface border border-line rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-content">{skill.skill}</span>
        <span className="text-xs text-content-subtle">{level}</span>
      </div>
      <div className="h-1.5 bg-surface-inset rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${skill.proficiency}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-content-subtle">
        <span>{skill.proficiency}% proficiency</span>
        <span>{skill.times_used.toLocaleString()} uses</span>
      </div>
    </div>
  );
}
