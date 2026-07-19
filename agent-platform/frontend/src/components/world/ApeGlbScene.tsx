"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, OrbitControls, Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import * as THREE from "three";
import { ApeAgentModel } from "./ApeAgentModel";

export type ApeView = "three-quarter" | "front" | "side";

const CAM: Record<ApeView, [number, number, number]> = {
  "three-quarter": [4.0, 3.05, 8.7],
  front: [0, 2.1, 9.6],
  side: [9.6, 2.3, 0.4],
};

/** Studio viewer for the locked GLB master (Blender owns look; this owns placement). */
export function ApeGlbScene({ view = "three-quarter" }: { view?: ApeView }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.98;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.background = new THREE.Color("#ffffff");
      }}
    >
      <OrthographicCamera key={view} makeDefault position={CAM[view]} zoom={150} near={0.1} far={100} />

      {/* warm wrap-around studio env (local, no HDR downloads) — richer material response */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[-5, 6, 4]} scale={[6, 6, 1]} color="#ffffff" target={[0, 1.6, 0]} />
        <Lightformer intensity={0.6} position={[6, 2, 2]} scale={[5, 5, 1]} color="#ffd9b0" target={[0, 1.6, 0]} />
        <Lightformer intensity={0.9} position={[0, 7, -3]} scale={[9, 3, 1]} color="#ffffff" target={[0, 1.6, 0]} />
        <Lightformer intensity={0.4} position={[0, 2, 7]} scale={[12, 8, 1]} color="#fff2e2" target={[0, 1.6, 0]} />
      </Environment>

      <ambientLight intensity={0.28} />
      <directionalLight
        position={[-4.5, 6.2, 5.0]} intensity={2.9} color="#fff7ee" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.03} shadow-radius={6}
      >
        <orthographicCamera attach="shadow-camera" args={[-4, 4, 5, -1, 0.5, 24]} />
      </directionalLight>
      <directionalLight position={[4.5, 3.5, 4.0]} intensity={1.0} />
      <directionalLight position={[1.5, 5.0, -4.5]} intensity={1.25} />

      <Suspense fallback={null}>
        {/* -16° root rotation to match the reference three-quarter angle */}
        <ApeAgentModel rotation={[0, -0.279, 0]} />
      </Suspense>

      {/* seamless white studio — shadow-catcher shows only the soft grounded shadow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial transparent opacity={0.24} />
      </mesh>

      {/* screen-space ambient occlusion — deep crevice shadow so it reads 3D, not flat */}
      <EffectComposer enableNormalPass={false}>
        <N8AO aoRadius={0.5} intensity={2.4} distanceFalloff={0.8} quality="high" />
      </EffectComposer>

      <OrbitControls target={[0, 1.5, 0]} enablePan={false} enableZoom makeDefault />
    </Canvas>
  );
}
