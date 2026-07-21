import type { ApeStatus } from "./ApeAgent.types";
import type { ApeAccessory } from "./kit";

export type WorkspaceLayout = "single-agent" | "multi-agent-pod" | "team-floor" | "hq";
export type WorkspaceType = "operations" | "research" | "creative" | "sales" | "command" | "custom";
export type RoomStatus = "idle" | "active" | "attention" | "blocked" | "offline";
export type WorkspaceQuality = "low" | "medium" | "high";
export type WorkstationType = "standard" | "research" | "creative" | "sales" | "command" | "empty";

export interface WorkspaceAgent {
  id: string;
  name: string;
  role: string;
  status: ApeStatus;
  workstationId: string;
  progress?: number;
  currentTask?: string;
  selected?: boolean;
  accentColor?: string;
  /** kit identity key (avatar seed) — falls back to id when absent */
  kitId?: string;
  /** growth-earned gear (headset, crown) */
  accessories?: ApeAccessory[];
  /** set to the new level while a just-earned promotion celebration plays */
  promotedLevel?: number | null;
}

/** A placed workstation anchor within a room layout. */
export interface WorkstationSlot {
  id: string;
  type: WorkstationType;
  position: [number, number, number];
  rotation: [number, number, number];
  /** "desk" gets a workstation; "pouf" is a lounge seat baked into the room (agent sits) */
  kind?: "desk" | "pouf";
}

export interface RoomConfig {
  id: string;
  type: WorkspaceType;
  layout: WorkspaceLayout;
  size: { width: number; depth: number; height: number };
  slots: WorkstationSlot[];
  camera: { overview: { position: [number, number, number]; target: [number, number, number]; fov: number } };
  rug?: { size: [number, number]; position: [number, number, number] };
}

export interface WorkspaceRoomProps {
  id: string;
  type?: WorkspaceType;
  layout?: WorkspaceLayout;
  agents: WorkspaceAgent[];
  selectedAgentId?: string | null;
  onAgentClick?: (id: string) => void;
  onWorkstationClick?: (id: string) => void;
  onCreateAgent?: (workstationId: string) => void;
  roomStatus?: RoomStatus;
  quality?: WorkspaceQuality;
  showBounds?: boolean;
  showAnchors?: boolean;
}
