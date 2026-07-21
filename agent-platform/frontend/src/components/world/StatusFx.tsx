"use client";
import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import type { ApeStatus } from "./ApeAgent.types";

/**
 * Floating status glyphs above an agent's head. The mascot GLB is locked, so
 * all status FX live out here as procedural R3F geometry — no textures, no
 * HTML. Every material is meshBasicMaterial with toneMapped={false} so the
 * glyphs clear the ~1 bloom threshold and stay readable at dusk and indoors.
 */

const ARC_SEGMENTS = 64;

function WorkingFx({ accent }: { accent: string }) {
  const arc = useRef<THREE.Mesh>(null);
  const geo = useRef<THREE.RingGeometry>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Sweep 0→2π via drawRange (6 indices per theta segment) instead of
    // rebuilding the ring geometry every frame.
    const sweep = (t * 0.8) % 1;
    geo.current?.setDrawRange(0, Math.max(1, Math.floor(sweep * ARC_SEGMENTS)) * 6);
    if (arc.current) arc.current.rotation.z = -t * 0.5;
  });
  return (
    <group rotation-x={-Math.PI / 2}>
      <mesh ref={arc}>
        <ringGeometry ref={geo} args={[0.41, 0.45, ARC_SEGMENTS]} />
        <meshBasicMaterial
          color={accent} toneMapped={false} transparent opacity={0.95}
          depthWrite={false} side={THREE.DoubleSide}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#FFB45C" toneMapped={false} />
      </mesh>
    </group>
  );
}

function ThinkingFx() {
  const dots = useRef<Array<THREE.Mesh | null>>([null, null, null]);
  useFrame(({ clock }) => {
    dots.current.forEach((dot, i) => {
      if (dot) dot.position.y = Math.sin(clock.elapsedTime * 4 - i * 0.55) * 0.06;
    });
  });
  return (
    <Billboard>
      {[-0.18, 0, 0.18].map((x, i) => (
        <mesh key={x} ref={(m) => { dots.current[i] = m; }} position={[x, 0, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#FFF6E8" toneMapped={false} transparent depthWrite={false} />
        </mesh>
      ))}
    </Billboard>
  );
}

function WaitingFx() {
  const ring = useRef<THREE.Mesh>(null);
  const hand = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // gentle breathing only — a bigger pulse throbs across the bloom threshold
    ring.current?.scale.setScalar(1.025 + Math.sin(t * 2.2) * 0.025);
    // Clock-hand orbiter, negative angle so it reads as clockwise face-on.
    hand.current?.position.set(Math.cos(-t * 1.1) * 0.3, Math.sin(-t * 1.1) * 0.3, 0);
  });
  return (
    <Billboard>
      <mesh ref={ring}>
        <ringGeometry args={[0.27, 0.3, 48]} />
        <meshBasicMaterial
          color="#FFD9A0" toneMapped={false} transparent opacity={0.85}
          depthWrite={false} side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={hand}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#FFD9A0" toneMapped={false} transparent depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

function CompletedFx() {
  const root = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (born.current === null) born.current = t;
    const k = Math.min((t - born.current) / 0.4, 1);
    if (root.current) {
      root.current.scale.setScalar(1 - Math.pow(1 - k, 3));
      root.current.position.y = Math.sin(t * 1.6) * 0.04;
    }
  });
  return (
    <Billboard>
      <group ref={root} scale={0}>
        <mesh position={[-0.1, -0.02, 0]} rotation-z={0.78}>
          <boxGeometry args={[0.045, 0.17, 0.045]} />
          <meshBasicMaterial color="#4ADE80" toneMapped={false} />
        </mesh>
        <mesh position={[0.05, 0.02, 0]} rotation-z={-0.6}>
          <boxGeometry args={[0.045, 0.3, 0.045]} />
          <meshBasicMaterial color="#4ADE80" toneMapped={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.3, 0.34, 48]} />
          <meshBasicMaterial
            color="#4ADE80" toneMapped={false} transparent opacity={0.35}
            depthWrite={false} side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </Billboard>
  );
}

function ErrorFx() {
  const root = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) root.current.position.y = Math.abs(Math.sin(t * 5)) * 0.05;
    if (ringMat.current) ringMat.current.opacity = 0.3 + Math.sin(t * 5) * 0.15;
  });
  return (
    <Billboard>
      <group ref={root}>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.06, 0.26, 0.06]} />
          <meshBasicMaterial color="#FF6B5E" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.06]} />
          <meshBasicMaterial color="#FF6B5E" toneMapped={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.3, 0.34, 48]} />
          <meshBasicMaterial
            ref={ringMat} color="#FF6B5E" toneMapped={false} transparent opacity={0.3}
            depthWrite={false} side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </Billboard>
  );
}

export function StatusFx({
  status, accent = "#F58220", height = 3.1,
}: { status: ApeStatus; accent?: string; height?: number }) {
  if (status === "idle") return null;
  return (
    <group position={[0, height, 0]}>
      {status === "working" && <WorkingFx accent={accent} />}
      {status === "thinking" && <ThinkingFx />}
      {status === "waiting" && <WaitingFx />}
      {status === "completed" && <CompletedFx />}
      {status === "error" && <ErrorFx />}
    </group>
  );
}
