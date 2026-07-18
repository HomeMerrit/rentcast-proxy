"use client";
import { useId, useMemo } from "react";
import { renderCompany, type Building } from "@/lib/world";

/**
 * The living world — a sunlit isometric diorama of the company.
 * Buildings are departments (taller = bigger team), citizens are workers in
 * their team colour, gold coins pop when value is made. The world IS the view.
 */
export function LivingWorld({
  buildings,
  animate = true,
  showWorkers = true,
  className,
}: {
  buildings: Building[];
  animate?: boolean;
  showWorkers?: boolean;
  className?: string;
}) {
  const rawId = useId();
  const id = "world" + rawId.replace(/[^a-zA-Z0-9]/g, "");

  const { inner, viewBox } = useMemo(
    () => renderCompany({ buildings, id, animate, showWorkers }),
    [buildings, id, animate, showWorkers]
  );

  return (
    <svg
      id={id}
      viewBox={viewBox}
      role="img"
      aria-label="Your company as a living world — each building is a team, each figure a worker."
      className={className}
      style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
