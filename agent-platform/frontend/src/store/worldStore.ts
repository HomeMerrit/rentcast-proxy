import { create } from "zustand";

export type CameraMode = "overview" | "agent-focus" | "workstation-focus" | "collaboration-focus";
export type RoomQuality = "low" | "medium" | "high";

export interface WorldState {
  activeRoomId: string | null;
  selectedAgentId: string | null;
  selectedWorkstationId: string | null;
  cameraMode: CameraMode;
  roomQuality: RoomQuality;
  setSelectedAgent: (id: string | null) => void;
  setSelectedWorkstation: (id: string | null) => void;
  setCameraMode: (mode: CameraMode) => void;
  setActiveRoom: (id: string) => void;
  reset: () => void;
}

// Purely visual world state — kept separate from live backend task data.
export const useWorldStore = create<WorldState>((set) => ({
  activeRoomId: null,
  selectedAgentId: null,
  selectedWorkstationId: null,
  cameraMode: "overview",
  roomQuality: "high",
  setSelectedAgent: (id) =>
    set({ selectedAgentId: id, cameraMode: id ? "agent-focus" : "overview" }),
  setSelectedWorkstation: (id) => set({ selectedWorkstationId: id }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setActiveRoom: (id) => set({ activeRoomId: id }),
  reset: () => set({ selectedAgentId: null, selectedWorkstationId: null, cameraMode: "overview" }),
}));
