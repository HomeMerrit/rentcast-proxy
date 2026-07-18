// Framework-agnostic "stories" for the ApeAgent mascot. The project has no
// Storybook runner yet; these describe the canonical states so a future
// Storybook (or the /dev/ape route) can enumerate them.
import type { ApeAgentProps, ApeStatus } from "./ApeAgent.types";

const STATUSES: ApeStatus[] = ["idle", "working", "thinking", "waiting", "completed", "error"];

export const stories: { name: string; props: ApeAgentProps }[] = STATUSES.map((status) => ({
  name: status,
  props: { id: `operator-${status}`, status, color: "#F47C20" },
}));

export default { title: "world/ApeAgent", stories };
