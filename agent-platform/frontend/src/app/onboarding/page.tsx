"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2, Sparkles, ArrowRight, ArrowLeft, Rocket, Users, Brain,
  Network, SkipForward, FileText, Pencil,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button, Field, Input, Textarea, Select, Card, Stepper, useToast } from "@/components/ui";
import { FileDropzone } from "@/components/create/FileDropzone";
import { CreateAgentStudio } from "@/components/create/CreateAgentStudio";
import { api } from "@/lib/api";
import type { Company } from "@/types/agent";

type Mode = "company" | "scratch";
const INDUSTRIES = [
  "Technology", "Real Estate", "Finance", "Healthcare", "E-commerce",
  "Marketing", "Consulting", "Education", "Legal", "Other",
];

// Persisted so a refresh or a return trip resumes exactly where you left off.
// Files themselves can't be serialized, so only the ingested count is kept.
const STORAGE_KEY = "ao.onboarding.v1";
type Persisted = {
  mode: Mode | null;
  step: number;
  biz: { name: string; industry: string; description: string; website: string; size: string };
  company: Company | null;
  docCount: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState(0); // 0 welcome, then flow
  const [company, setCompany] = useState<Company | null>(null);
  const [biz, setBiz] = useState({ name: "", industry: "", description: "", website: "", size: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const steps = useMemo(
    () => (mode === "company" ? ["Business", "Knowledge", "Review", "First agent"] : ["First agent"]),
    [mode]
  );
  // step 0 = welcome; steps 1..n map to `steps`
  const flowIndex = step - 1;

  // --- Resume: hydrate from localStorage once on mount ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Persisted;
        if (saved.step > 0) {
          setMode(saved.mode);
          setStep(saved.step);
          setBiz(saved.biz);
          setCompany(saved.company);
          setDocCount(saved.docCount ?? 0);
          toast({ tone: "info", title: "Welcome back", description: "Picking up where you left off." });
        }
      }
    } catch {
      /* corrupt state — ignore and start fresh */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Resume: persist on every meaningful change (after hydration) ---
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        if (step <= 0) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          const payload: Persisted = { mode, step, biz, company, docCount };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        }
      } catch {
        /* storage unavailable — non-fatal */
      }
    }, 200);
  }, [hydrated, mode, step, biz, company, docCount]);

  const clearSaved = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const goWorkspace = () => {
    clearSaved();
    router.push("/");
  };

  const start = (m: Mode) => {
    setMode(m);
    setStep(1);
  };

  const saveBusiness = async () => {
    if (!biz.name.trim()) {
      toast({ tone: "error", title: "Company name required" });
      return;
    }
    setBusy(true);
    try {
      const c = company
        ? await api.company.update(company.id, biz)
        : await api.company.create({ ...biz, name: biz.name.trim() });
      setCompany(c);
      setStep(2);
    } catch (e) {
      toast({ tone: "error", title: "Could not save", description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(false);
    }
  };

  const uploadKnowledge = async (skip = false) => {
    if (!skip && files.length && company) {
      setBusy(true);
      try {
        const docs = await api.company.uploadDocuments(company.id, files);
        setDocCount((n) => n + docs.length);
        toast({
          tone: "success",
          title: "Knowledge ingested",
          description: `${docs.length} file${docs.length > 1 ? "s" : ""} added to ${company.name}.`,
        });
      } catch (e) {
        toast({ tone: "error", title: "Upload failed", description: e instanceof Error ? e.message : "" });
      } finally {
        setBusy(false);
      }
    }
    setStep(3); // -> Review
  };

  return (
    <main className="app-backdrop relative min-h-screen overflow-hidden">
      {/* ambient orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-iris-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-10 top-40 h-72 w-72 rounded-full bg-aqua/10 blur-[120px]" />

      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <Link href="/" className="text-xs text-content-subtle hover:text-content-muted">
          Skip for now
        </Link>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16">
        {/* Wait for localStorage hydration so a resumed session doesn't flash the welcome screen. */}
        {!hydrated ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-iris-400" />
          </div>
        ) : (
        <>
        {step > 0 && (
          <div className="mx-auto mb-8 mt-2 max-w-3xl">
            <Stepper steps={steps} current={flowIndex} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ---------- WELCOME ---------- */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-4xl pt-8 text-center"
            >
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-content/[0.04] px-3 py-1 text-2xs font-medium text-content-muted"
              >
                <Sparkles className="h-3 w-3 text-iris-300" /> Welcome to your AI workforce
              </motion.span>
              <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-content sm:text-5xl">
                Build a company of <span className="text-gradient">AI employees</span> that work,
                learn and collaborate — 24/7.
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base text-content-muted">
                Onboard your business in minutes. Hire specialized agents, give them your knowledge,
                and watch them run in real time.
              </p>

              <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
                <ChoiceCard
                  icon={<Building2 className="h-6 w-6" />}
                  title="Onboard my company"
                  desc="Set up your business, upload reference docs, and hire your first team of agents with shared context."
                  onClick={() => start("company")}
                  primary
                />
                <ChoiceCard
                  icon={<Rocket className="h-6 w-6" />}
                  title="Start from scratch"
                  desc="Skip the setup and jump straight to designing your first AI agent. Add your company later."
                  onClick={() => start("scratch")}
                />
              </div>

              <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4 text-left">
                <Highlight icon={<Users className="h-4 w-4" />} label="Hire specialists" />
                <Highlight icon={<Brain className="h-4 w-4" />} label="Self-improving" />
                <Highlight icon={<Network className="h-4 w-4" />} label="Agents collaborate" />
              </div>
            </motion.div>
          )}

          {/* ---------- BUSINESS ---------- */}
          {step === 1 && mode === "company" && (
            <StepShell
              key="business"
              title="Tell us about your business"
              subtitle="This context is shared with every agent you hire, so their work fits your company."
            >
              <Card className="space-y-4 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company name" required>
                    <Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} placeholder="Acme Inc." />
                  </Field>
                  <Field label="Industry">
                    <Select value={biz.industry} onChange={(e) => setBiz({ ...biz, industry: e.target.value })}>
                      <option value="">Select…</option>
                      {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                    </Select>
                  </Field>
                  <Field label="Website">
                    <Input value={biz.website} onChange={(e) => setBiz({ ...biz, website: e.target.value })} placeholder="acme.com" />
                  </Field>
                  <Field label="Team size">
                    <Select value={biz.size} onChange={(e) => setBiz({ ...biz, size: e.target.value })}>
                      <option value="">Select…</option>
                      {["1–10", "11–50", "51–200", "201–1000", "1000+"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="What does your company do?" hint="A short description helps agents understand your mission">
                  <Textarea
                    value={biz.description}
                    onChange={(e) => setBiz({ ...biz, description: e.target.value })}
                    placeholder="We help real-estate investors find and analyze off-market properties…"
                  />
                </Field>
              </Card>
              <FlowNav onBack={() => setStep(0)} onNext={saveBusiness} busy={busy} nextLabel="Continue" />
            </StepShell>
          )}

          {/* ---------- KNOWLEDGE ---------- */}
          {step === 2 && mode === "company" && (
            <StepShell
              key="knowledge"
              title="Bring in your knowledge"
              subtitle="Upload documents, playbooks or a whole folder. We embed them so your agents can reference them."
            >
              <Card className="p-6">
                <FileDropzone files={files} onChange={setFiles} />
              </Card>
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-sm text-content-muted hover:text-content"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => uploadKnowledge(true)} icon={<SkipForward className="h-4 w-4" />}>
                    Skip
                  </Button>
                  <Button onClick={() => uploadKnowledge(false)} loading={busy} iconRight={<ArrowRight className="h-4 w-4" />}>
                    {files.length ? `Ingest ${files.length} & continue` : "Continue"}
                  </Button>
                </div>
              </div>
            </StepShell>
          )}

          {/* ---------- REVIEW ---------- */}
          {step === 3 && mode === "company" && (
            <StepShell
              key="review"
              title="Review your setup"
              subtitle="Make sure everything looks right before you hire your first agent. You can go back and edit."
            >
              <Card className="divide-y divide-line p-0">
                <ReviewRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Company"
                  value={company?.name || biz.name || "—"}
                  meta={[biz.industry, biz.size].filter(Boolean).join(" · ") || undefined}
                  onEdit={() => setStep(1)}
                />
                {biz.description ? (
                  <ReviewRow
                    icon={<FileText className="h-4 w-4" />}
                    label="What you do"
                    value={biz.description}
                    onEdit={() => setStep(1)}
                  />
                ) : null}
                <ReviewRow
                  icon={<Brain className="h-4 w-4" />}
                  label="Knowledge"
                  value={docCount ? `${docCount} document${docCount > 1 ? "s" : ""} ingested` : "No documents added"}
                  meta={docCount ? "Your agents can reference these" : "You can add these later"}
                  onEdit={() => setStep(2)}
                />
              </Card>
              <FlowNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Looks good — hire my first agent" />
            </StepShell>
          )}

          {/* ---------- HIRE FIRST AGENT ---------- */}
          {((step === 4 && mode === "company") || (step === 1 && mode === "scratch")) && (
            <StepShell
              key="hire"
              title="Hire your first agent"
              subtitle={
                company
                  ? `They'll join ${company.name} with full access to your uploaded knowledge.`
                  : "Design your first AI employee. You can add a company anytime."
              }
              wide
            >
              <CreateAgentStudio
                companyId={company?.id ?? null}
                compact
                onCreated={() => {
                  clearSaved();
                  toast({ tone: "success", title: "You're all set!", description: "Taking you to your workspace…" });
                  setTimeout(() => router.push("/"), 700);
                }}
              />
              <div className="mt-4 text-center">
                <button
                  onClick={goWorkspace}
                  className="text-xs text-content-subtle hover:text-content-muted"
                >
                  I&apos;ll do this later — go to my workspace
                </button>
              </div>
            </StepShell>
          )}
        </AnimatePresence>
        </>
        )}
      </div>
    </main>
  );
}

/* ---------- sub-components ---------- */

function ChoiceCard({
  icon, title, desc, onClick, primary,
}: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-colors ${
        primary
          ? "border-iris-500/40 bg-iris-soft hover:border-iris-400/60"
          : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <div
        className={`mb-4 grid h-12 w-12 place-items-center rounded-xl ${
          primary ? "bg-iris-gradient text-white shadow-glow" : "bg-content/[0.05] text-content"
        }`}
      >
        {icon}
      </div>
      <p className="font-display text-lg font-semibold text-content">{title}</p>
      <p className="mt-1.5 text-sm text-content-muted">{desc}</p>
      <ArrowRight className="mt-4 h-5 w-5 text-content-subtle transition-all group-hover:translate-x-1 group-hover:text-iris-300" />
    </motion.button>
  );
}

function ReviewRow({
  icon, label, value, meta, onEdit,
}: {
  icon: React.ReactNode; label: string; value: string; meta?: string; onEdit: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-iris-soft text-iris-300">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-medium uppercase tracking-wide text-content-subtle">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-content">{value}</p>
        {meta ? <p className="mt-0.5 text-xs text-content-muted">{meta}</p> : null}
      </div>
      <button
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-content-muted hover:bg-content/[0.05] hover:text-content"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  );
}

function Highlight({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-content/[0.03] px-3.5 py-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-iris-soft text-iris-300">{icon}</span>
      <span className="text-xs font-medium text-content-muted">{label}</span>
    </div>
  );
}

function StepShell({
  title, subtitle, children, wide,
}: {
  title: string; subtitle: string; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={wide ? "mx-auto max-w-5xl" : "mx-auto max-w-2xl"}
    >
      <div className="mb-6 text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-content sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-content-muted">{subtitle}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </motion.div>
  );
}

function FlowNav({
  onBack, onNext, busy, nextLabel,
}: {
  onBack: () => void; onNext: () => void; busy?: boolean; nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-content-muted hover:text-content">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <Button onClick={onNext} loading={busy} iconRight={!busy ? <ArrowRight className="h-4 w-4" /> : undefined}>
        {nextLabel}
      </Button>
    </div>
  );
}
