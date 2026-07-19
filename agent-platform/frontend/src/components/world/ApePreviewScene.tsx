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
      <OrthographicCamera makeDefault position={[4.6, 4.6, 8.0]} zoom={160} near={0.1} far={100} />

      {/* wrap-around studio light (local — no network HDRs): strong upper-left key,
          weak warm fill right, top rim — gives every face a gradient like the ref */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={3.4} position={[-5, 6, 4]} scale={[6, 6, 1]} color="#ffffff" target={[0, 1.5, 0]} />
        <Lightformer intensity={0.55} position={[6, 2, 2]} scale={[5, 5, 1]} color="#ffe3c4" target={[0, 1.5, 0]} />
        <Lightformer intensity={1.2} position={[0, 7, -3]} scale={[9, 3, 1]} color="#ffffff" target={[0, 1.5, 0]} />
        <Lightformer intensity={0.5} position={[0, 1.8, 7]} scale={[14, 10, 1]} color="#fff4e8" target={[0, 1.5, 0]} />
      </Environment>

      <ambientLight intensity={0.16} />
      {/* soft key with REAL cast shadows — brow onto face, muzzle onto chin, head onto body */}
      <directionalLight
        position={[-3, 7.5, 6]} intensity={1.7} color="#fff7ee" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.03}
      >
        <orthographicCamera attach="shadow-camera" args={[-2.6, 2.6, 4.2, -0.4, 0.5, 20]} />
      </directionalLight>

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
