"use client";
import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { ApeAgentModel, type ApeStatus, type ApeJersey } from "./ApeAgentModel";
import { StatusFx } from "./StatusFx";

function Spinner({ status, accent, jersey }: { status: ApeStatus; accent?: string | null; jersey?: ApeJersey | null }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.55;
  });
  return (
    <group ref={group}>
      <ApeAgentModel status={status} accent={accent} jersey={jersey} />
      <StatusFx status={status} accent={accent ?? undefined} height={2.7} />
    </group>
  );
}

/** Slow-spinning showcase of the agent's mascot — the locked GLB with the
 *  agent's accent vest and live status clip + FX. Transparent canvas, so it
 *  sits directly on any card surface. */
export function ApeTurntable({
  status = "idle", accent = null, jersey = null, className,
}: { status?: ApeStatus; accent?: string | null; jersey?: ApeJersey | null; className?: string }) {
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.98;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <PerspectiveCamera makeDefault fov={34} position={[0, 0.35, 6.2]} near={0.1} far={40} />
        <ambientLight intensity={0.55} color="#fff3e2" />
        <directionalLight
          position={[-4, 6, 5]} intensity={2.2} color="#fff7ee" castShadow
          shadow-mapSize={[1024, 1024]} shadow-bias={-0.0003} shadow-radius={5}
        />
        <directionalLight position={[4.5, 3, 3]} intensity={0.8} color="#ffd9b0" />
        <directionalLight position={[0, 5, -5]} intensity={1.0} />
        {/* character centered on the camera axis (ape is ~2.2 tall + FX above) */}
        <group position={[0, -1.45, 0]}>
          <Suspense fallback={null}>
            <Spinner status={status} accent={accent} jersey={jersey} />
          </Suspense>
          {/* soft grounding shadow only — the card supplies the surface */}
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <shadowMaterial transparent opacity={0.2} />
          </mesh>
        </group>
      </Canvas>
    </div>
  );
}
