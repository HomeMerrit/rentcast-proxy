import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function successRate(agent: { task_count: number; success_count: number }): number {
  if (agent.task_count === 0) return 0;
  return Math.round((agent.success_count / agent.task_count) * 100);
}
