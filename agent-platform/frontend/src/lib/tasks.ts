import {
  Search, PenLine, BarChart3, FileText, ListChecks, Send, Wand2,
  type LucideIcon,
} from "lucide-react";

/**
 * Job catalog — the single source of truth for "give an agent work".
 *
 * The agent runtime is fully generic: `task_type` and `task_input` are just
 * stringified into the model's prompt (see backend base_agent). So we own the
 * whole vocabulary here, in plain language, and never make a user think about
 * JSON or invent a "task type". Each job maps its friendly fields straight into
 * `task_input`.
 */

export type JobField = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  hint?: string;
};

export type JobTemplate = {
  /** Sent to the backend as `task_type`. */
  id: string;
  icon: LucideIcon;
  title: string;
  blurb: string;
  /** Verb for the primary button, e.g. "Research it". */
  cta: string;
  fields: JobField[];
  /** Short human summary of the queued job (for toasts / current task). */
  summary: (v: Record<string, string>) => string;
};

export const JOBS: JobTemplate[] = [
  {
    id: "research",
    icon: Search,
    title: "Research a topic",
    blurb: "Dig into a subject and come back with the key findings.",
    cta: "Research it",
    fields: [
      {
        key: "topic",
        label: "What should they look into?",
        placeholder: "The EV market in Europe in 2024",
        required: true,
      },
      {
        key: "focus",
        label: "Anything specific to focus on?",
        placeholder: "Pricing trends, top players, what's changing…",
        multiline: true,
      },
    ],
    summary: (v) => `Research: ${v.topic}`,
  },
  {
    id: "write",
    icon: PenLine,
    title: "Write something",
    blurb: "Draft content in your voice: posts, emails, copy.",
    cta: "Write it",
    fields: [
      {
        key: "what",
        label: "What should they write?",
        placeholder: "A launch email for our new pricing",
        required: true,
      },
      {
        key: "notes",
        label: "Tone & key points",
        placeholder: "Friendly but professional. Mention the free trial…",
        multiline: true,
      },
    ],
    summary: (v) => `Write: ${v.what}`,
  },
  {
    id: "analyze",
    icon: BarChart3,
    title: "Analyze something",
    blurb: "Look at data or a situation and draw clear conclusions.",
    cta: "Analyze it",
    fields: [
      {
        key: "subject",
        label: "What should they analyze?",
        placeholder: "Last quarter's sales numbers",
        required: true,
      },
      {
        key: "question",
        label: "What do you want to know?",
        placeholder: "Which channel is growing fastest, and why?",
        multiline: true,
      },
    ],
    summary: (v) => `Analyze: ${v.subject}`,
  },
  {
    id: "summarize",
    icon: FileText,
    title: "Summarize",
    blurb: "Turn a long document or messy notes into the essentials.",
    cta: "Summarize it",
    fields: [
      {
        key: "content",
        label: "Paste what they should summarize",
        placeholder: "Paste an article, transcript, or your notes here…",
        multiline: true,
        required: true,
      },
    ],
    summary: () => `Summarize a document`,
  },
  {
    id: "plan",
    icon: ListChecks,
    title: "Make a plan",
    blurb: "Break a goal into clear, ordered steps.",
    cta: "Plan it",
    fields: [
      {
        key: "goal",
        label: "What's the goal?",
        placeholder: "Launch our product on Product Hunt",
        required: true,
      },
      {
        key: "constraints",
        label: "Any constraints?",
        placeholder: "Two weeks, budget of $500, team of three…",
        multiline: true,
      },
    ],
    summary: (v) => `Plan: ${v.goal}`,
  },
  {
    id: "outreach",
    icon: Send,
    title: "Draft outreach",
    blurb: "Write a message aimed at a person or audience.",
    cta: "Draft it",
    fields: [
      {
        key: "audience",
        label: "Who's it for?",
        placeholder: "Series A SaaS founders",
        required: true,
      },
      {
        key: "goal",
        label: "What should it get them to do?",
        placeholder: "Book a 15-minute demo",
        required: true,
      },
    ],
    summary: (v) => `Outreach to ${v.audience}`,
  },
  {
    id: "custom",
    icon: Wand2,
    title: "Something else",
    blurb: "Describe the job in your own words and they'll figure it out.",
    cta: "Give it to them",
    fields: [
      {
        key: "instructions",
        label: "What should they do?",
        placeholder: "Tell the agent exactly what you need…",
        multiline: true,
        required: true,
      },
    ],
    summary: () => `Custom job`,
  },
];

/** Build the `task_input` object from the collected field values, trimmed. */
export function buildTaskInput(
  job: JobTemplate,
  values: Record<string, string>
): Record<string, string> {
  const input: Record<string, string> = {};
  for (const f of job.fields) {
    const val = (values[f.key] ?? "").trim();
    if (val) input[f.key] = val;
  }
  return input;
}

/** True when every required field has a non-empty value. */
export function jobReady(job: JobTemplate, values: Record<string, string>): boolean {
  return job.fields.every((f) => !f.required || (values[f.key] ?? "").trim().length > 0);
}
