// Framework-agnostic "stories" enumerating the room presets (no Storybook yet).
import { singleAgentOperationsRoom, twoAgentSharedRoom, fourAgentPodRoom, eightAgentTeamFloor } from "./WorkspaceRoom.config";
import type { RoomConfig } from "./WorkspaceRoom.types";

export const stories: { name: string; room: RoomConfig }[] = [
  { name: "single-agent-operations", room: singleAgentOperationsRoom },
  { name: "two-agent-shared", room: twoAgentSharedRoom },
  { name: "four-agent-pod", room: fourAgentPodRoom },
  { name: "eight-agent-team-floor", room: eightAgentTeamFloor },
];

export default { title: "world/WorkspaceRoom", stories };
