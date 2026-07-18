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
      eye: new THREE.MeshStandardMaterial({ color: "#121110", roughness: 0.2, metalness: 0, wireframe: debug }),
      nostril: std("#8A3E12", 0.6),
      innerEar: std("#B85A1E", 0.7),
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
        {/* torso — short and wide, smaller than the head */}
        <RoundedBox args={[1.6, 1.16, 0.9]} radius={0.14} smoothness={5} position={[0, 1.36, 0]} material={mats.body} />

        {/* legs — short, stubby, separated by a rectangular gap */}
        <RoundedBox args={[0.52, 0.84, 0.68]} radius={0.11} smoothness={5} position={[-0.36, 0.42, 0]} material={mats.body} />
        <RoundedBox args={[0.52, 0.84, 0.68]} radius={0.11} smoothness={5} position={[0.36, 0.42, 0]} material={mats.body} />

        {/* arms — long, hanging almost to the feet; pivot at the shoulder */}
        <group ref={leftArm} position={[-0.99, 1.82, 0.03]}>
          <RoundedBox args={[0.44, 1.18, 0.58]} radius={0.13} smoothness={5} position={[0, -0.62, 0]} material={mats.body} />
          <RoundedBox args={[0.42, 0.46, 0.5]} radius={0.12} smoothness={5} position={[0, -1.36, 0.03]} material={mats.body} />
        </group>
        <group ref={rightArm} position={[0.99, 1.82, 0.03]}>
          <RoundedBox args={[0.44, 1.18, 0.58]} radius={0.13} smoothness={5} position={[0, -0.62, 0]} material={mats.body} />
          <RoundedBox args={[0.42, 0.46, 0.5]} radius={0.12} smoothness={5} position={[0, -1.36, 0.03]} material={mats.body} />
        </group>

        {/* head group (origin at head center) — big wide rectangle, > body */}
        <group ref={head} position={[0, 2.82, 0]}>
          <RoundedBox args={[2.02, 1.8, 1.16]} radius={0.16} smoothness={5} material={mats.body} castShadow />

          {/* thick brow ridge — spans the face, projects forward, overhangs eyes */}
          <RoundedBox args={[1.72, 0.32, 0.34]} radius={0.12} smoothness={5} position={[0, 0.43, 0.55]} material={mats.body} castShadow />

          {/* eyes (tall black rounded rectangles), recessed under the brow, + highlights */}
          <RoundedBox ref={leftEye} args={[0.24, 0.42, 0.06]} radius={0.05} smoothness={5} position={[-0.5, 0.12, 0.575]} material={mats.eye} />
          <RoundedBox ref={rightEye} args={[0.24, 0.42, 0.06]} radius={0.05} smoothness={5} position={[0.5, 0.12, 0.575]} material={mats.eye} />
          <mesh position={[-0.44, 0.23, 0.61]} material={mats.hi}><sphereGeometry args={[0.05, 16, 16]} /></mesh>
          <mesh position={[0.44, 0.23, 0.61]} material={mats.hi}><sphereGeometry args={[0.05, 16, 16]} /></mesh>

          {/* muzzle — one wide rounded block in the lower-center face, projecting
              forward, with two square nostrils near its top. Reads as an ape
              muzzle (not a bear snout). */}
          <group position={[0, -0.46, 0.62]}>
            <RoundedBox args={[1.16, 0.66, 0.56]} radius={0.13} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.16, 0.19, 0.09]} radius={0.03} smoothness={4} position={[-0.21, 0.16, 0.27]} material={mats.nostril} />
            <RoundedBox args={[0.16, 0.19, 0.09]} radius={0.03} smoothness={4} position={[0.21, 0.16, 0.27]} material={mats.nostril} />
          </group>

          {/* ears — small square tabs on the sides, with a recessed dark inset */}
          <group position={[-1.04, 0.04, 0]}>
            <RoundedBox args={[0.44, 0.5, 0.44]} radius={0.12} smoothness={5} material={mats.body} />
            <RoundedBox args={[0.2, 0.24, 0.06]} radius={0.04} smoothness={4} position={[-0.02, 0, 0.22]} material={mats.innerEar} />
          </group>
          <group position={[1.04, 0.04, 0]}>
            <RoundedBox args={[0.44, 0.5, 0.44]} radius={0.12} smoothness={5} material={mats.body} />
            <RoundedBox args={[0.2, 0.24, 0.06]} radius={0.04} smoothness={4} position={[0.02, 0, 0.22]} material={mats.innerEar} />
          </group>
        </group>
      </group>
    </group>
  );
}
