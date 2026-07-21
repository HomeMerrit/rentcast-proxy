"use client";
import { useId, useMemo, type MouseEvent } from "react";
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
  onPick,
}: {
  buildings: Building[];
  animate?: boolean;
  showWorkers?: boolean;
  className?: string;
  /** When set, buildings become clickable and this fires with the team name. */
  onPick?: (team: string) => void;
}) {
  const rawId = useId();
  const id = "world" + rawId.replace(/[^a-zA-Z0-9]/g, "");

  const { inner, viewBox } = useMemo(
    () => renderCompany({ buildings, id, animate, showWorkers, interactive: !!onPick }),
    [buildings, id, animate, showWorkers, onPick]
  );

  const handleClick = onPick
    ? (e: MouseEvent) => {
        const g = (e.target as Element).closest("[data-team]");
        const team = g?.getAttribute("data-team");
        if (team) onPick(team);
      }
    : undefined;

  return (
    <svg
      id={id}
      viewBox={viewBox}
      role="img"
      aria-label="Your company as a living world. Each building is a team and each figure a worker."
      className={className}
      style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
