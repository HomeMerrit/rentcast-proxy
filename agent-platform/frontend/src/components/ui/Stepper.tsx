"use client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300",
                  done && "border-iris-300 bg-iris-50 text-iris-700",
                  active && "border-iris-500 bg-iris-500 text-white",
                  !done && !active && "border-line bg-surface text-content-subtle"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                {active && (
                  <motion.span
                    layoutId="stepper-ring"
                    className="absolute inset-0 rounded-full ring-2 ring-iris-400/40"
                  />
                )}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-medium transition-colors sm:block",
                  active ? "text-content" : done ? "text-content-muted" : "text-content-subtle"
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-1 hidden h-px flex-1 bg-line sm:block">
                <div
                  className="h-full bg-iris-400/60 transition-all duration-500"
                  style={{ width: done ? "100%" : "0%" }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
