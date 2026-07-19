"use client";
import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, ContactShadows, OrbitControls, Stats } from "@react-three/drei";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import * as THREE from "three";
import { ApeAgent } from "./ApeAgent";
import type { ApeStatus } from "./ApeAgent.types";

function KeyLight() {
  const ref = useRef<THREE.RectAreaLight>(null);
  useEffect(() => {
    RectAreaLightUniformsLib.init();
    ref.current?.lookAt(0, 1.72, 0);
  }, []);
  return <rectAreaLight ref={ref} position={[-4, 6, 5]} intensity={4.6} width={5} height={5} color="#fff4e6" />;
}

export function ApePreviewScene({
  status = "idle", selected = false, autoRotate = false, paused = false,
  debug = false, showFps = false, onSelect,
}: {
  status?: ApeStatus; selected?: boolean; autoRotate?: boolean; paused?: boolean;
  debug?: boolean; showFps?: boolean; onSelect?: (id: string) => void;
}) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        scene.background = new THREE.Color("#ffffff");
      }}
    >
      <OrthographicCamera makeDefault position={[4.6, 5.3, 8.0]} zoom={98} near={0.1} far={100} />

      <ambientLight intensity={0.55} />
      <KeyLight />
      <directionalLight position={[4, 3, 4]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[1, 5, -4]} intensity={1.4} color="#ffe9cf" />
      {/* gentle rim from behind-side to catch the bevels */}
      <directionalLight position={[-3.5, 2.4, -4.5]} intensity={1.7} color="#fff1db" />

      <ApeAgent id="operator" status={status} selected={selected} debug={debug} onClick={onSelect} />

      {/* matte white floor + grounded contact shadow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>
      <ContactShadows position={[0, 0.005, 0]} opacity={0.22} scale={6} blur={2.8} far={4} />

      <OrbitControls target={[0, 1.72, 0]} enablePan={false} enableZoom autoRotate={autoRotate} autoRotateSpeed={1.2} minPolarAngle={0.35} maxPolarAngle={1.5} />
      {showFps && <Stats />}
    </Canvas>
  );
}
