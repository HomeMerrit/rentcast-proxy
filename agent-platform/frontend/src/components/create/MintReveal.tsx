"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Building2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { kitShades } from "@/components/world/kit";
import type { ApeJersey, ApePattern } from "@/components/world/ApeAgentModel";

const ApeTurntable = dynamic(
  () => import("@/components/world/ApeTurntable").then((m) => m.ApeTurntable),
  { ssr: false },
);

/** Full-screen mint moment after a successful hire: spotlight fades up on the
 *  new worker's mascot mid-celebration, then their card slides in. The CTA is
 *  the only exit — this is the handshake, not a toast. */
export function MintReveal({
  name,
  title,
  department,
  accent,
  jersey,
  pattern,
  onDone,
}: {
  name: string;
  title: string;
  department: string;
  accent: string;
  jersey: ApeJersey;
  pattern: ApePattern;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  // beat timings collapse to 0 when the viewer prefers reduced motion
  const t = (s: number) => (reduced ? 0 : s);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} joined your team`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#120c08]/95 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: t(0.45) }}
    >
      {/* spotlight cone fading up behind the mascot */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 46% 62% at 50% 44%, ${accent}2e, transparent 70%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: t(0.9), delay: t(0.35) }}
      />

      <motion.p
        className="mb-2 text-2xs font-semibold uppercase tracking-[0.2em] text-white/50"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: t(0.5), delay: t(0.3) }}
      >
        New hire minted
      </motion.p>

      {/* the mascot, celebrating under the spotlight */}
      <motion.div
        className="relative h-[46vh] min-h-[260px] w-full max-w-xl"
        initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: t(0.7), delay: t(0.35), ease: [0.16, 1, 0.3, 1] }}
      >
        <ApeTurntable
          status="completed"
          accent={accent}
          jersey={jersey}
          pattern={pattern}
          className="absolute inset-0"
        />
      </motion.div>

      {/* name card slides in under the turntable */}
      <motion.div
        className="mt-2 w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-center backdrop-blur-sm"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: t(0.55), delay: t(1.1), ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="font-display text-2xl font-semibold text-white">{name}</p>
        <p className="mt-0.5 text-sm text-white/60">{title}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {department && (
            <Badge tone="iris" icon={<Building2 className="h-3 w-3" />}>{department}</Badge>
          )}
          <span
            className="rounded-md border px-1.5 py-0.5 text-2xs font-semibold tabular-nums"
            style={{
              borderColor: `${accent}66`,
              background: `${accent}1f`,
              color: kitShades(accent).light,
            }}
          >
            #{String(jersey.number).padStart(2, "0")} · {pattern}
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: t(0.4), delay: t(1.7) }}
        className="mt-6"
      >
        <Button size="lg" onClick={onDone} iconRight={<ArrowRight className="h-4 w-4" />}>
          Put them to work
        </Button>
      </motion.div>
    </motion.div>
  );
}
