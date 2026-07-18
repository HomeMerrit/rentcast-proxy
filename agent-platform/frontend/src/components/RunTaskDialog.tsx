"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Modal, Button, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { JOBS, buildTaskInput, jobReady, type JobTemplate } from "@/lib/tasks";

/**
 * The one way to give an agent work. No task-type box, no JSON — pick a job
 * card, fill in a plain-language field or two, done. Reused on the agent page,
 * the live floor, and the dashboard so the gesture is identical everywhere.
 */
export function RunTaskDialog({
  agentId,
  agentName,
  open,
  onClose,
  onQueued,
}: {
  agentId: string;
  agentName: string;
  open: boolean;
  onClose: () => void;
  onQueued?: (summary: string) => void;
}) {
  const toast = useToast();
  const [job, setJob] = useState<JobTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setJob(null);
    setValues({});
    setBusy(false);
  };
  const close = () => {
    onClose();
    // Let the exit animation play before wiping state.
    setTimeout(reset, 200);
  };
  const back = () => {
    setJob(null);
    setValues({});
  };

  const pick = (j: JobTemplate) => {
    setJob(j);
    setValues({});
  };

  const submit = async () => {
    if (!job || !jobReady(job, values)) return;
    setBusy(true);
    try {
      await api.agents.run(agentId, job.id, buildTaskInput(job, values));
      const summary = job.summary(values);
      toast({
        tone: "success",
        title: `${agentName} is on it`,
        description: summary,
      });
      onQueued?.(summary);
      close();
    } catch (e) {
      toast({
        tone: "error",
        title: "Couldn't start the job",
        description: e instanceof Error ? e.message : "Please try again.",
      });
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} className="max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        {job && (
          <button
            onClick={back}
            className="grid h-7 w-7 place-items-center rounded-lg text-content-subtle transition-colors hover:bg-content/5 hover:text-content"
            aria-label="Back to jobs"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold text-content">
            {job ? job.title : `Give ${agentName} a job`}
          </h3>
          <p className="truncate text-xs text-content-muted">
            {job ? job.blurb : "Pick what you'd like done — no setup required."}
          </p>
        </div>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">
          {/* ---------- pick a job ---------- */}
          {!job ? (
            <motion.div
              key="pick"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="grid gap-2.5 sm:grid-cols-2"
            >
              {JOBS.map((j) => {
                const Icon = j.icon;
                return (
                  <button
                    key={j.id}
                    onClick={() => pick(j)}
                    className="group flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-iris-400/50 hover:shadow-card"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-iris-soft text-iris-500 transition-colors group-hover:bg-iris-gradient group-hover:text-white">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-content">{j.title}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-content-muted">{j.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </motion.div>
          ) : (
            /* ---------- fill the job ---------- */
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {job.fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-sm font-medium text-content">
                    {f.label}
                    {f.required && <span className="ml-1 text-iris-500">*</span>}
                  </label>
                  {f.multiline ? (
                    <textarea
                      autoFocus={job.fields[0].key === f.key}
                      rows={4}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full resize-none rounded-xl border border-line bg-surface-inset px-3 py-2.5 text-sm text-content placeholder:text-content-subtle outline-none transition-colors focus:border-iris-400/60"
                    />
                  ) : (
                    <input
                      autoFocus={job.fields[0].key === f.key}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && jobReady(job, values)) submit();
                      }}
                      placeholder={f.placeholder}
                      className="h-11 w-full rounded-xl border border-line bg-surface-inset px-3 text-sm text-content placeholder:text-content-subtle outline-none transition-colors focus:border-iris-400/60"
                    />
                  )}
                  {f.hint && <p className="mt-1 text-xs text-content-subtle">{f.hint}</p>}
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={back}
                  className="text-sm text-content-muted transition-colors hover:text-content"
                >
                  Choose a different job
                </button>
                <Button
                  onClick={submit}
                  loading={busy}
                  disabled={!jobReady(job, values)}
                  iconRight={!busy ? <ArrowRight className="h-4 w-4" /> : undefined}
                >
                  {busy ? "Starting…" : job.cta}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
