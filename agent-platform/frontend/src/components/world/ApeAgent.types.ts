// APE Agents — hero mascot. Locked visual spec; do not reinterpret proportions.

export type ApeStatus =
  | "idle"
  | "working"
  | "thinking"
  | "waiting"
  | "completed"
  | "error";

export interface ApeAgentProps {
  id: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  status?: ApeStatus;
  selected?: boolean;
  color?: string;
  /** dev-only wireframe overlay */
  debug?: boolean;
  onClick?: (id: string) => void;
}
