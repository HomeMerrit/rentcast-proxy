"use client";
import { useMemo } from "react";
import { ContactShadows } from "@react-three/drei";
import { ApeworksShell } from "./ApeworksShell";
import { WorkspaceLighting } from "./WorkspaceLighting";
import { AgentWorkstation } from "./AgentWorkstation";
import { ApeAgentGlb } from "./ApeAgentGlb";
import { resolveRoom, HQ_MAX_AGENTS } from "./WorkspaceRoom.config";
import type { WorkspaceRoomProps, RoomConfig } from "./WorkspaceRoom.types";

/** Scene contents for one HQ floor (no Canvas). Data-driven: agents fill the
 *  floor's 5 slots in order; remaining slots render as intentional empty
 *  capacity. 5 agents per floor max. */
export function WorkspaceRoom({
  type = "operations", agents, selectedAgentId,
  onAgentClick, onCreateAgent, quality = "high",
}: WorkspaceRoomProps) {
  const room: RoomConfig = useMemo(() => resolveRoom(type, agents.length), [type, agents.length]);
  const floorAgents = agents.slice(0, HQ_MAX_AGENTS);

  return (
    <group>
      <ApeworksShell />
      <WorkspaceLighting room={room} quality={quality} />

      {room.slots.map((slot, i) => {
        const agent = floorAgents[i];
        const pouf = slot.kind === "pouf";
        return (
          <group key={slot.id} position={slot.position} rotation={slot.rotation}>
            {!pouf && (
              <AgentWorkstation id={slot.id} status={agent?.status ?? "idle"} type={slot.type} empty={!agent} onCreate={onCreateAgent} />
            )}
            {agent && (
              <ApeAgentGlb
                id={agent.id}
                position={pouf ? [0, 0.56, 0] : [0, 0, -1.22]}
                scale={0.6}
                status={agent.status}
                clip={pouf ? "Sit" : null}
                selected={agent.id === selectedAgentId}
                onClick={onAgentClick}
              />
            )}
          </group>
        );
      })}

      <ContactShadows position={[0, 0.02, 0]} opacity={0.25} scale={room.size.width + 4} blur={2.6} far={5} resolution={quality === "low" ? 512 : 1024} />
    </group>
  );
}
