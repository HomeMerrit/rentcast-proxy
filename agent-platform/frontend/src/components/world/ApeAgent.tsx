"use client";
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { ApeAgentProps } from "./ApeAgent.types";
import { createApeAnim, updateApe, type ApeRefs } from "./ApeAgent.animations";

/**
 * APE Agents hero mascot — built procedurally from rounded boxes to the locked
 * proportions. One warm-orange material across the body; subtle variation only
 * on face panel, inner ears, nostrils and eyes.
 */
export function ApeAgent({
  id,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  status = "idle",
  selected = false,
  color = "#E9843A",
  debug = false,
  onClick,
}: ApeAgentProps) {
  const bob = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const anim = useRef(createApeAnim());
  const [hovered, setHovered] = useState(false);

  const mats = useMemo(() => {
    const std = (c: string, roughness = 0.52) =>
      new THREE.MeshStandardMaterial({ color: c, roughness, metalness: 0, wireframe: debug });
    return {
      body: std(color, 0.5),
      eye: new THREE.MeshStandardMaterial({ color: "#141210", roughness: 0.2, metalness: 0, wireframe: debug }),
      nostril: std("#B15D1A", 0.5),      // darker orange, recessed (not brown)
      innerEar: std("#BF6A24", 0.6),
      hi: new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.2, wireframe: debug }),
    };
  }, [color, debug]);

  useFrame((s, dt) =>
    updateApe(
      { bob, head, leftArm, rightArm, leftEye, rightEye, ring } as ApeRefs,
      anim.current, status, dt, s.clock.elapsedTime, hovered, selected,
    ),
  );

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={(e) => { e.stopPropagation(); onClick?.(id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      {/* selection / error floor ring */}
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} visible={false}>
        <ringGeometry args={[1.32, 1.58, 64]} />
        <meshBasicMaterial color="#F9B27A" transparent opacity={0.5} depthWrite={false} />
      </mesh>

      <group ref={bob}>
        {/* torso — short, compact, wider than tall (≈25% of the height) */}
        <RoundedBox args={[1.62, 0.92, 0.96]} radius={0.16} smoothness={5} position={[0, 1.0, 0]} material={mats.body} />

        {/* legs — short, wide, squat; forward feet depth + a small gap (≈20%) */}
        <RoundedBox args={[0.62, 0.6, 0.78]} radius={0.13} smoothness={5} position={[-0.42, 0.3, 0.05]} material={mats.body} />
        <RoundedBox args={[0.62, 0.6, 0.78]} radius={0.13} smoothness={5} position={[0.42, 0.3, 0.05]} material={mats.body} />

        {/* arms — long & simple (one upper arm + integrated hand), hung low and
            outward with no human shoulder line; hands reach just beneath the torso */}
        <group ref={leftArm} position={[-0.99, 1.32, 0.05]}>
          <RoundedBox args={[0.46, 0.74, 0.58]} radius={0.15} smoothness={5} position={[0, -0.39, 0]} material={mats.body} />
          <RoundedBox args={[0.44, 0.4, 0.54]} radius={0.15} smoothness={5} position={[0, -0.84, 0.02]} material={mats.body} />
        </group>
        <group ref={rightArm} position={[0.99, 1.32, 0.05]}>
          <RoundedBox args={[0.46, 0.74, 0.58]} radius={0.15} smoothness={5} position={[0, -0.39, 0]} material={mats.body} />
          <RoundedBox args={[0.44, 0.4, 0.54]} radius={0.15} smoothness={5} position={[0, -0.84, 0.02]} material={mats.body} />
        </group>

        {/* head group (origin at head center) — oversized hero (≈55% of height) */}
        <group ref={head} position={[0, 2.32, 0]}>
          <RoundedBox args={[2.18, 1.96, 1.26]} radius={0.16} smoothness={5} material={mats.body} castShadow />

          {/* brow — clean horizontal bar, raised, with clear space above the eyes */}
          <RoundedBox args={[1.78, 0.24, 0.28]} radius={0.11} smoothness={5} position={[0, 0.53, 0.62]} material={mats.body} castShadow />

          {/* eyes — tall rounded black rectangles, set inward & lifted, calm & friendly */}
          <RoundedBox ref={leftEye} args={[0.32, 0.46, 0.06]} radius={0.06} smoothness={5} position={[-0.4, 0.15, 0.655]} material={mats.eye} />
          <RoundedBox ref={rightEye} args={[0.32, 0.46, 0.06]} radius={0.06} smoothness={5} position={[0.4, 0.15, 0.655]} material={mats.eye} />
          {/* identical small highlights in the same corner (upper-left) of both eyes */}
          <mesh position={[-0.49, 0.25, 0.69]} material={mats.hi}><sphereGeometry args={[0.045, 16, 16]} /></mesh>
          <mesh position={[0.31, 0.25, 0.69]} material={mats.hi}><sphereGeometry args={[0.045, 16, 16]} /></mesh>

          {/* muzzle — compact and clearly projecting forward (not a wide flat pad),
              with two small square dark-orange nostrils sitting flush as recessed
              sockets, plus a subtle lower-lip block beneath */}
          <group position={[0, -0.42, 0.66]}>
            <RoundedBox args={[0.9, 0.58, 0.72]} radius={0.14} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.14, 0.14, 0.06]} radius={0.02} smoothness={4} position={[-0.15, 0.09, 0.33]} material={mats.nostril} />
            <RoundedBox args={[0.14, 0.14, 0.06]} radius={0.02} smoothness={4} position={[0.15, 0.09, 0.33]} material={mats.nostril} />
            <RoundedBox args={[0.6, 0.16, 0.5]} radius={0.08} smoothness={5} position={[0, -0.29, -0.06]} material={mats.body} />
          </group>

          {/* ears — lifted & pushed forward, overlapping the head sides; inset cavity */}
          <group position={[-0.99, 0.24, 0.1]}>
            <RoundedBox args={[0.42, 0.52, 0.46]} radius={0.13} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.22, 0.28, 0.1]} radius={0.05} smoothness={4} position={[0, 0, 0.14]} material={mats.innerEar} />
          </group>
          <group position={[0.99, 0.24, 0.1]}>
            <RoundedBox args={[0.42, 0.52, 0.46]} radius={0.13} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.22, 0.28, 0.1]} radius={0.05} smoothness={4} position={[0, 0, 0.14]} material={mats.innerEar} />
          </group>
        </group>
      </group>
    </group>
  );
}
