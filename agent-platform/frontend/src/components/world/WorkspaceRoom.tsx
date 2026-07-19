"use client";
import { useMemo } from "react";
import { ContactShadows } from "@react-three/drei";
import { WorkspaceShell } from "./WorkspaceShell";
import { WorkspaceLighting } from "./WorkspaceLighting";
import { AgentWorkstation } from "./AgentWorkstation";
import { ApeAgent } from "./ApeAgent";
import { resolveRoom } from "./WorkspaceRoom.config";
import type { WorkspaceRoomProps, RoomConfig } from "./WorkspaceRoom.types";

/** Scene contents for one room (no Canvas). Data-driven: agents fill slots in
 *  order; remaining slots render as intentional empty capacity. */
export function WorkspaceRoom({
  type = "operations", agents, selectedAgentId,
  onAgentClick, onCreateAgent, quality = "high",
}: WorkspaceRoomProps) {
  const room: RoomConfig = useMemo(() => resolveRoom(type, agents.length), [type, agents.length]);

  return (
    <group>
      <WorkspaceShell room={room} />
      <WorkspaceLighting room={room} quality={quality} />

      {room.slots.map((slot, i) => {
        const agent = agents[i];
        return (
          <group key={slot.id} position={slot.position} rotation={slot.rotation}>
            <AgentWorkstation id={slot.id} status={agent?.status ?? "idle"} type={slot.type} empty={!agent} onCreate={onCreateAgent} />
            {agent && (
              <ApeAgent
                id={agent.id}
                position={[0, 0, -0.86]}
                scale={0.62}
                status={agent.status}
                selected={agent.id === selectedAgentId}
                color={agent.accentColor ?? "#E97B29"}
                onClick={onAgentClick}
              />
            )}
          </group>
        );
      })}

      <ContactShadows position={[0, 0.02, 0]} opacity={0.28} scale={room.size.width + 4} blur={2.6} far={5} resolution={quality === "low" ? 512 : 1024} />
    </group>
  );
}
