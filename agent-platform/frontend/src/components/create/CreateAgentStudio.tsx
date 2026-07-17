"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Building2, Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Field, Input, Textarea, Select, Card, Badge, useToast } from "@/components/ui";
import { AvatarPicker, type AvatarValue } from "./AvatarPicker";
import { SkillPicker, type PickedSkill } from "./SkillPicker";
import type { Agent } from "@/types/agent";

const DEPARTMENTS = [
  "Research", "Sales", "Marketing", "Engineering", "Operations",
  "Finance", "Support", "Design", "Legal", "Data",
];

const MODELS = [
  { id: "claude-sonnet-5", label: "Sonnet 5 · balanced", hint: "Best default — fast & capable" },
  { id: "claude-opus-4-8", label: "Opus 4.8 · most capable", hint: "Deepest reasoning, higher cost" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 · fastest", hint: "Cheapest, great for volume" },
];

export function CreateAgentStudio({
  companyId,
  onCreated,
  compact = false,
}: {
  companyId?: string | null;
  onCreated?: (agent: Agent) => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const [avatar, setAvatar] = useState<AvatarValue>({
    avatar_seed: Math.random().toString(36).slice(2, 10),
    avatar_url: null,
  });
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [model, setModel] = useState("claude-sonnet-5");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<PickedSkill[]>([]);
  const [saving, setSaving] = useState(false);

  const valid = name.trim() && title.trim() && department;

  const submit = async () => {
    if (!valid) {
      toast({ tone: "error", title: "Missing details", description: "Name, title and department are required." });
      return;
    }
    setSaving(true);
    try {
      const agent = await api.agents.create({
        name: name.trim(),
        title: title.trim(),
        department,
        bio: bio.trim() || undefined,
        avatar_seed: avatar.avatar_seed,
        avatar_url: avatar.avatar_url,
        model,
        company_id: companyId ?? null,
      });
      if (skills.length) {
        try {
          await api.agents.addSkills(agent.id, skills);
        } catch {
          /* skills are non-fatal */
        }
      }
      toast({ tone: "success", title: `${agent.name} hired`, description: `${title} joined your workforce.` });
      onCreated?.(agent);
    } catch (e) {
      toast({
        tone: "error",
        title: "Could not create agent",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? "" : "mx-auto max-w-5xl"}>
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-6">
            <AvatarPicker value={avatar} onChange={setAvatar} />
            <div className="mt-5 border-t border-line pt-4 text-center">
              <p className="font-display text-lg font-semibold text-content">
                {name || "New Agent"}
              </p>
              <p className="text-sm text-content-muted">{title || "Job title"}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {department && <Badge tone="iris" icon={<Building2 className="h-3 w-3" />}>{department}</Badge>}
                <Badge tone="neutral" icon={<Cpu className="h-3 w-3" />}>
                  {MODELS.find((m) => m.id === model)?.label.split(" ·")[0]}
                </Badge>
              </div>
              {skills.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1">
                  {skills.slice(0, 6).map((s) => (
                    <span key={s.skill} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-2xs text-content-muted">
                      {s.skill}
                    </span>
                  ))}
                  {skills.length > 6 && (
                    <span className="text-2xs text-content-subtle">+{skills.length - 6}</span>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          <Card className="space-y-4 p-6">
            <h3 className="font-display text-base font-semibold text-content">Identity</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required htmlFor="ag-name">
                <Input id="ag-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya Chen" />
              </Field>
              <Field label="Title" required htmlFor="ag-title">
                <Input id="ag-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lead Research Analyst" />
              </Field>
              <Field label="Department" required htmlFor="ag-dept">
                <Select id="ag-dept" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">Select a department…</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Model" htmlFor="ag-model" hint={MODELS.find((m) => m.id === model)?.hint}>
                <Select id="ag-model" value={model} onChange={(e) => setModel(e.target.value)}>
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description" hint="What is this agent responsible for?">
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe the agent's role, focus areas and personality…"
              />
            </Field>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 font-display text-base font-semibold text-content">Skills</h3>
            <SkillPicker department={department} title={title} value={skills} onChange={setSkills} />
          </Card>

          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-2xs text-content-subtle">
              <Sparkles className="h-3.5 w-3.5 text-iris-300" />
              Skills auto-improve as the agent completes work.
            </p>
            <Button size="lg" onClick={submit} loading={saving} disabled={!valid} iconRight={<ArrowRight className="h-4 w-4" />}>
              {saving ? "Hiring…" : "Hire agent"}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
