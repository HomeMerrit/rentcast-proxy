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
    skill.proficiency >= 60 ? "bg-amber-400" : "bg-slate-500";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-200">{skill.skill}</span>
        <span className="text-xs text-gray-500">{level}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${skill.proficiency}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{skill.proficiency}% proficiency</span>
        <span>{skill.times_used.toLocaleString()} uses</span>
      </div>
    </div>
  );
}
