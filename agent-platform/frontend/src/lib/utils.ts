import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function avatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f0be4d,ed7150,e08a5b,5a97d6,4fb0aa,e6ae3c`;
}

export function successRate(agent: { task_count: number; success_count: number }): number {
  if (agent.task_count === 0) return 0;
  return Math.round((agent.success_count / agent.task_count) * 100);
}
