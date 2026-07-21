"use client";
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, OrbitControls, Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, N8AO, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { WorkspaceRoom } from "./WorkspaceRoom";
import { RoomCameraController, type CamShot } from "./RoomCameraController";
import { resolveRoom } from "./WorkspaceRoom.config";
import type { WorkspaceAgent, WorkspaceType, WorkspaceQuality } from "./WorkspaceRoom.types";

export function WorkspacePreviewScene({
  type = "operations", agents, selectedAgentId = null, focusAgentId = null, onAgentClick, onCreateAgent,
  quality = "high", orbit = false, paused = false,
}: {
  type?: WorkspaceType; agents: WorkspaceAgent[]; selectedAgentId?: string | null;
  /** camera-only focus (e.g. a promotion moment) — overrides selection for the shot */
  focusAgentId?: string | null;
  onAgentClick?: (id: string) => void; onCreateAgent?: (id: string) => void;
  quality?: WorkspaceQuality; orbit?: boolean; paused?: boolean;
}) {
  const room = useMemo(() => resolveRoom(type, agents.length), [type, agents.length]);
  const overview = room.camera.overview;

  const focusId = focusAgentId ?? selectedAgentId;
  const focus: CamShot | null = useMemo(() => {
    if (!focusId) return null;
    const idx = agents.findIndex((a) => a.id === focusId);
    const slot = room.slots[idx];
    if (!slot) return null;
    const [x, , z] = slot.position;
    return { position: [x + 1.8, 2.3, z + 3.0], target: [x, 1.25, z - 0.4] };
  }, [focusId, agents, room]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.94;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.background = new THREE.Color("#EFE7D9");
      }}
    >
      <PerspectiveCamera makeDefault fov={overview.fov} position={overview.position} near={0.1} far={100} />
      {orbit
        ? <OrbitControls target={overview.target} enablePan={false} minPolarAngle={0.3} maxPolarAngle={1.45} />
        : <RoomCameraController overview={overview} focus={focus} fov={overview.fov} />}

      {/* warm wrap-around studio env for richer material response (local, no HDR) */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={1.6} position={[-6, 6, 5]} scale={[7, 6, 1]} color="#fff4e4" target={[0, 1.6, 0]} />
        <Lightformer intensity={0.7} position={[7, 3, 3]} scale={[5, 5, 1]} color="#ffd9b0" target={[0, 1.6, 0]} />
        <Lightformer intensity={0.5} position={[0, 3, 9]} scale={[12, 7, 1]} color="#fff0dc" target={[0, 1.6, 0]} />
      </Environment>

      <WorkspaceRoom
        id={room.id} type={type} agents={agents} selectedAgentId={selectedAgentId}
        onAgentClick={onAgentClick} onCreateAgent={onCreateAgent} quality={quality}
      />

      {/* comp-quality grade: crevice AO + soft glow on the cove strips + vignette */}
      {quality !== "low" && (
        <EffectComposer enableNormalPass={false}>
          <N8AO aoRadius={0.55} intensity={1.7} distanceFalloff={0.9} quality={quality === "high" ? "high" : "medium"} />
          <Bloom intensity={0.32} luminanceThreshold={1.1} luminanceSmoothing={0.25} mipmapBlur />
          <Vignette offset={0.28} darkness={0.5} eskil={false} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
