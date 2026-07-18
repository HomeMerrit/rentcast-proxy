// Runner-agnostic smoke checks for the workspace config/presets.
import { resolveRoom, singleAgentOperationsRoom, fourAgentPodRoom, eightAgentTeamFloor } from "./WorkspaceRoom.config";

export function runWorkspaceSmokeTests(): { name: string; pass: boolean }[] {
  const out: { name: string; pass: boolean }[] = [];
  const ok = (name: string, pass: boolean) => out.push({ name, pass });

  ok("single-agent room has exactly one slot", singleAgentOperationsRoom.slots.length === 1);
  ok("four-agent pod has four slots", fourAgentPodRoom.slots.length === 4);
  ok("team floor has up to twelve slots", eightAgentTeamFloor.slots.length <= 12 && eightAgentTeamFloor.slots.length >= 5);
  ok("resolveRoom picks single-agent for 1", resolveRoom("operations", 1).layout === "single-agent");
  ok("resolveRoom picks team-floor for 8", resolveRoom("operations", 8).layout === "team-floor");
  ok("room is wider than deep", singleAgentOperationsRoom.size.width > singleAgentOperationsRoom.size.depth);

  return out;
}
