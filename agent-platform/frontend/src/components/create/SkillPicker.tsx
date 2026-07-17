"use client";
import { useEffect, useState } from "react";
import { Sparkles, Plus, X, Wand2 } from "lucide-react";
import { api } from "@/lib/api";
import { Chip } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface PickedSkill {
  skill: string;
  proficiency: number;
}

export function SkillPicker({
  department,
  title,
  value,
  onChange,
}: {
  department: string;
  title: string;
  value: PickedSkill[];
  onChange: (skills: PickedSkill[]) => void;
}) {
  const [recommended, setRecommended] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (!department) return;
    let alive = true;
    setLoading(true);
    api.skills
      .recommend(department, title)
      .then((r) => alive && setRecommended(r.recommended || []))
      .catch(() => alive && setRecommended([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [department, title]);

  const has = (s: string) => value.some((v) => v.skill.toLowerCase() === s.toLowerCase());
  const toggle = (s: string) => {
    if (has(s)) onChange(value.filter((v) => v.skill.toLowerCase() !== s.toLowerCase()));
    else onChange([...value, { skill: s, proficiency: 65 }]);
  };
  const setProf = (s: string, p: number) =>
    onChange(value.map((v) => (v.skill === s ? { ...v, proficiency: p } : v)));
  const addCustom = () => {
    const s = custom.trim();
    if (s && !has(s)) onChange([...value, { skill: s, proficiency: 60 }]);
    setCustom("");
  };
  const addAll = () => {
    const merged = [...value];
    recommended.forEach((s) => {
      if (!merged.some((v) => v.skill.toLowerCase() === s.toLowerCase()))
        merged.push({ skill: s, proficiency: 65 });
    });
    onChange(merged);
  };

  return (
    <div className="space-y-5">
      {/* Recommended */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-content">
            <Sparkles className="h-4 w-4 text-iris-300" />
            Recommended for {department || "this role"}
          </span>
          {recommended.length > 0 && (
            <button
              type="button"
              onClick={addAll}
              className="inline-flex items-center gap-1 text-2xs font-medium text-iris-300 hover:text-iris-200"
            >
              <Wand2 className="h-3 w-3" /> Add all
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shimmer h-8 w-24 rounded-full bg-white/[0.04]" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recommended.map((s) => (
              <Chip key={s} selected={has(s)} onClick={() => toggle(s)} icon={has(s) ? undefined : <Plus className="h-3.5 w-3.5" />}>
                {s}
              </Chip>
            ))}
            {recommended.length === 0 && (
              <p className="text-xs text-content-subtle">Pick a department to see recommendations.</p>
            )}
          </div>
        )}
      </div>

      {/* Custom add */}
      <div className="flex items-center gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          placeholder="Add a custom skill…"
          className="h-9 flex-1 rounded-lg border border-line bg-surface-inset px-3 text-sm text-content placeholder:text-content-subtle outline-none focus:border-iris-400/60"
        />
        <button
          type="button"
          onClick={addCustom}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong bg-surface-overlay text-content hover:bg-surface-raised"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Selected with proficiency */}
      {value.length > 0 && (
        <div className="space-y-2">
          <p className="text-2xs font-medium uppercase tracking-wide text-content-subtle">
            {value.length} skill{value.length > 1 ? "s" : ""} selected — set starting proficiency
          </p>
          <div className="space-y-2">
            {value.map((v) => (
              <div
                key={v.skill}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface-inset px-3 py-2.5"
              >
                <span className="w-32 shrink-0 truncate text-sm text-content">{v.skill}</span>
                <input
                  type="range"
                  min={10}
                  max={95}
                  value={v.proficiency}
                  onChange={(e) => setProf(v.skill, Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-iris-500"
                />
                <span
                  className={cn(
                    "w-9 shrink-0 text-right text-xs font-medium tabular-nums",
                    v.proficiency >= 75 ? "text-positive" : v.proficiency >= 45 ? "text-iris-300" : "text-content-muted"
                  )}
                >
                  {v.proficiency}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(v.skill)}
                  className="text-content-subtle hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
