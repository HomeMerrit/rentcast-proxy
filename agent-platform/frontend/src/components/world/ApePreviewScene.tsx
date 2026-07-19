"use client";
import { Canvas } from "@react-three/fiber";
import {
  OrthographicCamera, ContactShadows, OrbitControls, Stats,
  Environment, Lightformer,
} from "@react-three/drei";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import * as THREE from "three";
import { ApeAgent } from "./ApeAgent";
import type { ApeStatus } from "./ApeAgent.types";

/** Studio product-shot scene for the mascot: soft white cyc, wrap-around
 *  environment light, gentle key shadow and screen-space ambient occlusion. */
export function ApePreviewScene({
  status = "idle", selected = false, autoRotate = false, paused = false,
  debug = false, showFps = false, onSelect,
}: {
  status?: ApeStatus; selected?: boolean; autoRotate?: boolean; paused?: boolean;
  debug?: boolean; showFps?: boolean; onSelect?: (id: string) => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        scene.background = new THREE.Color("#ffffff");
      }}
    >
      <OrthographicCamera makeDefault position={[4.6, 4.2, 8.0]} zoom={160} near={0.1} far={100} />

      {/* wrap-around studio light (local — no network HDRs) */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.6} position={[-4, 5, 4]} scale={[7, 7, 1]} color="#ffffff" target={[0, 1.5, 0]} />
        <Lightformer intensity={1.1} position={[5, 2, 3]} scale={[6, 6, 1]} color="#fff2e2" target={[0, 1.5, 0]} />
        <Lightformer intensity={1.4} position={[0, 6, -4]} scale={[9, 4, 1]} color="#ffffff" target={[0, 1.5, 0]} />
        <Lightformer intensity={0.7} position={[0, 1.6, 7]} scale={[16, 12, 1]} color="#ffffff" target={[0, 1.5, 0]} />
      </Environment>

      <ambientLight intensity={0.18} />
      {/* soft key (no hard shadow map — grounding comes from the contact shadow + AO) */}
      <directionalLight position={[-3.5, 7, 5]} intensity={1.5} color="#fff7ee" />

      <ApeAgent id="operator" status={status} selected={selected} debug={debug} onClick={onSelect} />

      {/* seamless white cyc floor + grounded soft shadow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
      </mesh>
      <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={7} blur={2.6} far={3.2} resolution={1024} />

      <EffectComposer enableNormalPass={false}>
        <N8AO aoRadius={0.35} intensity={1.8} distanceFalloff={0.9} quality="high" />
      </EffectComposer>

      <OrbitControls target={[0, 1.5, 0]} enablePan={false} enableZoom autoRotate={autoRotate} autoRotateSpeed={1.2} minPolarAngle={0.35} maxPolarAngle={1.5} />
      {showFps && <Stats />}
    </Canvas>
  );
}
