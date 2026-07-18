"use client";
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { WorkspaceRoom } from "./WorkspaceRoom";
import { RoomCameraController, type CamShot } from "./RoomCameraController";
import { resolveRoom } from "./WorkspaceRoom.config";
import type { WorkspaceAgent, WorkspaceType, WorkspaceQuality } from "./WorkspaceRoom.types";

export function WorkspacePreviewScene({
  type = "operations", agents, selectedAgentId = null, onAgentClick, onCreateAgent,
  quality = "high", orbit = false, paused = false,
}: {
  type?: WorkspaceType; agents: WorkspaceAgent[]; selectedAgentId?: string | null;
  onAgentClick?: (id: string) => void; onCreateAgent?: (id: string) => void;
  quality?: WorkspaceQuality; orbit?: boolean; paused?: boolean;
}) {
  const room = useMemo(() => resolveRoom(type, agents.length), [type, agents.length]);
  const overview = room.camera.overview;

  const focus: CamShot | null = useMemo(() => {
    if (!selectedAgentId) return null;
    const idx = agents.findIndex((a) => a.id === selectedAgentId);
    const slot = room.slots[idx];
    if (!slot) return null;
    const [x, , z] = slot.position;
    return { position: [x + 1.8, 2.3, z + 3.0], target: [x, 1.25, z - 0.4] };
  }, [selectedAgentId, agents, room]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        scene.background = new THREE.Color("#ECE6DB");
      }}
    >
      <PerspectiveCamera makeDefault fov={overview.fov} position={overview.position} near={0.1} far={100} />
      {orbit
        ? <OrbitControls target={overview.target} enablePan={false} minPolarAngle={0.3} maxPolarAngle={1.45} />
        : <RoomCameraController overview={overview} focus={focus} fov={overview.fov} />}

      <WorkspaceRoom
        id={room.id} type={type} agents={agents} selectedAgentId={selectedAgentId}
        onAgentClick={onAgentClick} onCreateAgent={onCreateAgent} quality={quality}
      />
    </Canvas>
  );
}
