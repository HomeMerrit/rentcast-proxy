"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Building2, Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Field, Input, Textarea, Select, Card, Badge, useToast } from "@/components/ui";
import { AvatarPicker, type AvatarValue } from "./AvatarPicker";
import { SkillPicker, type PickedSkill } from "./SkillPicker";
import { MintReveal } from "./MintReveal";
import { avatarHue } from "@/components/AgentAvatar";
import { patternOf, jerseyNumberOf, kitShades } from "@/components/world/kit";
import type { Agent } from "@/types/agent";

// the live 3D mascot preview — the kit this hire will actually wear
const ApeTurntable = dynamic(
  () => import("@/components/world/ApeTurntable").then((m) => m.ApeTurntable),
  { ssr: false },
);

const DEPARTMENTS = [
  "Research", "Sales", "Marketing", "Engineering", "Operations",
  "Finance", "Support", "Design", "Legal", "Data",
];

// Plain-language "brainpower" tiers — the technical engine stays under the hood.
const MODELS = [
  { id: "claude-sonnet-5", label: "Balanced", hint: "Best all-rounder, quick and capable" },
  { id: "claude-opus-4-8", label: "Deepest", hint: "Most thorough thinking, higher cost" },
  { id: "claude-haiku-4-5-20251001", label: "Fastest", hint: "Quickest and cheapest, great for volume" },
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
  // Stable seed on first render (server + client match); randomize after mount
  // to avoid a hydration mismatch from Math.random() in the initializer.
  const [avatar, setAvatar] = useState<AvatarValue>({ avatar_seed: "new-agent", avatar_url: null });
  useEffect(() => {
    setAvatar((v) =>
      v.avatar_seed === "new-agent" && !v.avatar_url
        ? { ...v, avatar_seed: Math.random().toString(36).slice(2, 10) }
        : v
    );
  }, []);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [model, setModel] = useState("claude-sonnet-5");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<PickedSkill[]>([]);
  const [saving, setSaving] = useState(false);
  const [minted, setMinted] = useState<Agent | null>(null);

  const valid = name.trim() && title.trim() && department;

  // The kit is dealt from the avatar seed, so this preview IS the mascot the
  // agent walks out with — "Generate" re-rolls the whole kit (mint moment).
  const kitSeed = avatar.avatar_seed;
  const kitAccent = avatarHue(kitSeed || name || "new-agent")[0];
  const kitNumber = jerseyNumberOf(kitSeed);
  const kitPattern = patternOf(kitSeed);
  const kitLabel = department.slice(0, 3).toUpperCase() || undefined;

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
      // the reveal overlay is the confirmation; onCreated fires from its CTA
      setMinted(agent);
    } catch (e) {
      toast({
        tone: "error",
        title: "Could not hire this worker",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? "" : "mx-auto max-w-5xl"}>
      {minted && (
        <MintReveal
          name={minted.name}
          title={title.trim()}
          department={department}
          accent={kitAccent}
          jersey={{ number: kitNumber, label: kitLabel }}
          pattern={kitPattern}
          onDone={() => onCreated?.(minted)}
        />
      )}
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-6">
            {/* the 3D mascot — spins with the exact kit this hire will wear */}
            <div className="relative mb-4 h-52 overflow-hidden rounded-xl bg-surface-inset ring-1 ring-black/5">
              <ApeTurntable
                status="idle"
                accent={kitAccent}
                jersey={{ number: kitNumber, label: kitLabel }}
                pattern={kitPattern}
                className="absolute inset-0"
              />
              <span className="absolute left-3 top-2.5 text-2xs font-semibold uppercase tracking-wide text-content-subtle">
                Their mascot
              </span>
              <span
                className="absolute right-3 top-2.5 rounded-md border px-1.5 py-0.5 text-2xs font-semibold tabular-nums"
                style={{ borderColor: `${kitAccent}55`, background: `${kitAccent}14`, color: kitShades(kitAccent).dark }}
              >
                #{String(kitNumber).padStart(2, "0")} · {kitPattern}
              </span>
            </div>
            <AvatarPicker value={avatar} onChange={setAvatar} name={name} />
            <div className="mt-5 border-t border-line pt-4 text-center">
              <p className="font-display text-lg font-semibold text-content">
                {name || "New worker"}
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
                    <span key={s.skill} className="rounded-md bg-content/[0.05] px-1.5 py-0.5 text-2xs text-content-muted">
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
              <Field label="Brainpower" htmlFor="ag-model" hint={MODELS.find((m) => m.id === model)?.hint}>
                <Select id="ag-model" value={model} onChange={(e) => setModel(e.target.value)}>
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description" hint="What is this worker responsible for?">
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe their role, focus areas and personality…"
              />
            </Field>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 font-display text-base font-semibold text-content">Tools</h3>
            <SkillPicker department={department} title={title} value={skills} onChange={setSkills} />
          </Card>

          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-2xs text-content-subtle">
              <Sparkles className="h-3.5 w-3.5 text-iris-600" />
              They get sharper with every job they finish.
            </p>
            <Button size="lg" onClick={submit} loading={saving} disabled={!valid} iconRight={<ArrowRight className="h-4 w-4" />}>
              {saving ? "Hiring…" : "Hire worker"}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
