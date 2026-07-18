import type { RoomConfig, WorkspaceType, WorkstationType } from "./WorkspaceRoom.types";

// ── APE Agents workspace palette ──────────────────────────────────────────────
export const PALETTE = {
  arch: "#F4EFE8",       // primary architecture
  archWarm: "#FFF9F2",   // secondary warm white
  charcoal: "#181716",
  orange: "#F47C20",
  orangeSoft: "#FF9A3C",
  metal: "#C9C3BB",
  floor: "#DDD5CB",
  desk: "#F8F1E9",
  screenFrame: "#24211F",
};

// Status → workstation accent + screen treatment.
export const STATUS_LOOK: Record<string, { edge: string; screen: string; dot: string; emissive: number }> = {
  idle: { edge: "#C9C3BB", screen: "#201e1c", dot: "#F47C20", emissive: 0.15 },
  working: { edge: "#F47C20", screen: "#241f1a", dot: "#FF9A3C", emissive: 0.9 },
  thinking: { edge: "#FF9A3C", screen: "#22201e", dot: "#FF9A3C", emissive: 0.55 },
  waiting: { edge: "#E6AE3C", screen: "#2a2620", dot: "#E6AE3C", emissive: 0.7 },
  completed: { edge: "#4E9E63", screen: "#1f241f", dot: "#4E9E63", emissive: 0.8 },
  error: { edge: "#E06A50", screen: "#2a1f1c", dot: "#E06A50", emissive: 0.6 },
};

const SMALL = { width: 12, depth: 8, height: 4.8 };
const BIG = { width: 18, depth: 12, height: 5.4 };
const OVERVIEW_SINGLE = { position: [7.0, 4.7, 8.6] as [number, number, number], target: [0.7, 1.5, 0] as [number, number, number], fov: 33 };
const OVERVIEW_SMALL = { position: [9.2, 6.4, 10.4] as [number, number, number], target: [0, 1.35, 0] as [number, number, number], fov: 33 };
const OVERVIEW_BIG = { position: [15, 10, 16] as [number, number, number], target: [0, 1.6, 0] as [number, number, number], fov: 37 };

// Workstation placements per layout (from the spec).
function slots(layout: string, type: WorkstationType) {
  if (layout === "single-agent")
    return [{ id: "ws-1", type, position: [0.8, 0, 0.4] as [number, number, number], rotation: [0, -0.18, 0] as [number, number, number] }];
  if (layout === "two-agent")
    return [
      { id: "ws-1", type, position: [-2.2, 0, 0.3] as [number, number, number], rotation: [0, 0.18, 0] as [number, number, number] },
      { id: "ws-2", type, position: [2.2, 0, 0.3] as [number, number, number], rotation: [0, -0.18, 0] as [number, number, number] },
    ];
  if (layout === "four-agent")
    return [
      { id: "ws-1", type, position: [-3.2, 0, 0.8] as [number, number, number], rotation: [0, 0.28, 0] as [number, number, number] },
      { id: "ws-2", type, position: [-1.1, 0, -0.5] as [number, number, number], rotation: [0, 0.12, 0] as [number, number, number] },
      { id: "ws-3", type, position: [1.1, 0, -0.5] as [number, number, number], rotation: [0, -0.12, 0] as [number, number, number] },
      { id: "ws-4", type, position: [3.2, 0, 0.8] as [number, number, number], rotation: [0, -0.28, 0] as [number, number, number] },
    ];
  // team floor: three pods
  const out = [];
  const pods = [-5.6, 0, 5.6];
  let i = 0;
  for (const px of pods)
    for (const [dx, dz] of [[-1.4, 0.6], [1.4, 0.6], [0, -0.9]] as [number, number][]) {
      out.push({ id: `ws-${++i}`, type, position: [px + dx, 0, dz] as [number, number, number], rotation: [0, -dx * 0.12, 0] as [number, number, number] });
    }
  return out;
}

export function makeRoom(id: string, type: WorkspaceType, layout: string): RoomConfig {
  const team = layout === "team-floor";
  const wsType = (type === "custom" ? "standard" : type) as WorkstationType;
  const canonical = layout === "team-floor" ? "team" : layout;
  return {
    id, type,
    layout: (layout === "single-agent" ? "single-agent" : team ? "team-floor" : "multi-agent-pod"),
    size: team ? BIG : SMALL,
    slots: slots(canonical === "team" ? "team-floor" : layout, wsType),
    camera: { overview: team ? OVERVIEW_BIG : layout === "single-agent" ? OVERVIEW_SINGLE : OVERVIEW_SMALL },
    rug: layout === "single-agent"
      ? { size: [4.5, 3.2], position: [0.8, 0, 0.6] }
      : team ? undefined : { size: [5.5, 4.0], position: [0, 0, 0.2] },
  };
}

// Named presets (deliverables).
export const singleAgentOperationsRoom: RoomConfig = makeRoom("operations-room", "operations", "single-agent");
export const twoAgentSharedRoom: RoomConfig = makeRoom("sales-room", "sales", "two-agent");
export const fourAgentPodRoom: RoomConfig = makeRoom("research-room", "research", "four-agent");
export const eightAgentTeamFloor: RoomConfig = makeRoom("team-floor", "operations", "team-floor");

/** Build a room config for an arbitrary agent count (used by the preview route). */
export function roomForCount(type: WorkspaceType, count: number): RoomConfig {
  const layout = count <= 1 ? "single-agent" : count === 2 ? "two-agent" : count <= 4 ? "four-agent" : "team-floor";
  return makeRoom(`${type}-${layout}`, type, layout);
}

/** Single source of truth used by both the room and its camera. */
export function resolveRoom(type: WorkspaceType, count: number): RoomConfig {
  return roomForCount(type, Math.max(1, count));
}
