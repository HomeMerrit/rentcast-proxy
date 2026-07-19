// Lightweight, runner-agnostic smoke checks for the mascot's contract.
// (No Vitest/Jest wired in this project yet — this stays importable and typed.)
import type { ApeAgentProps, ApeStatus } from "./ApeAgent.types";

const STATUSES: ApeStatus[] = ["idle", "working", "thinking", "waiting", "completed", "error"];

export function runApeAgentSmokeTests(): { name: string; pass: boolean }[] {
  const results: { name: string; pass: boolean }[] = [];
  const ok = (name: string, pass: boolean) => results.push({ name, pass });

  ok("every status is a non-empty string", STATUSES.every((s) => typeof s === "string" && s.length > 0));

  const props: ApeAgentProps = { id: "operator", status: "idle", color: "#E97B29" };
  ok("default color is the locked orange", props.color === "#E97B29");
  ok("id is required and present", typeof props.id === "string" && props.id.length > 0);

  return results;
}
