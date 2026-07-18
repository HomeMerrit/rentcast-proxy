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
  color = "#F47C20",
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
      body: std(color, 0.52),
      face: std("#FF8A2A", 0.5),
      eye: new THREE.MeshStandardMaterial({ color: "#11100E", roughness: 0.2, metalness: 0, wireframe: debug }),
      nostril: std("#8F3E0A", 0.6),
      innerEar: std("#C95D12", 0.6),
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
        {/* torso */}
        <RoundedBox args={[1.22, 1.34, 0.78]} radius={0.1} smoothness={5} position={[0, 1.22, 0]} material={mats.body} />

        {/* legs (separated, with a rectangular gap) */}
        <RoundedBox args={[0.48, 0.72, 0.63]} radius={0.075} smoothness={5} position={[-0.34, 0.36, 0]} material={mats.body} />
        <RoundedBox args={[0.48, 0.72, 0.63]} radius={0.075} smoothness={5} position={[0.34, 0.36, 0]} material={mats.body} />

        {/* arms — pivot at the shoulder so they can raise / type */}
        <group ref={leftArm} position={[-0.83, 1.765, 0]}>
          <RoundedBox args={[0.42, 0.91, 0.52]} radius={0.09} smoothness={5} position={[0, -0.455, 0]} material={mats.body} />
          <RoundedBox args={[0.29, 0.43, 0.38]} radius={0.065} smoothness={5} position={[0, -1.05, 0.03]} material={mats.body} />
        </group>
        <group ref={rightArm} position={[0.83, 1.765, 0]}>
          <RoundedBox args={[0.42, 0.91, 0.52]} radius={0.09} smoothness={5} position={[0, -0.455, 0]} material={mats.body} />
          <RoundedBox args={[0.29, 0.43, 0.38]} radius={0.065} smoothness={5} position={[0, -1.05, 0.03]} material={mats.body} />
        </group>

        {/* head group (origin at head center) */}
        <group ref={head} position={[0, 2.77, 0]}>
          <RoundedBox args={[1.86, 1.68, 1.02]} radius={0.12} smoothness={5} material={mats.body} />

          {/* face panel — subtly brighter orange */}
          <RoundedBox args={[1.54, 0.88, 0.1]} radius={0.08} smoothness={5} position={[0, -0.12, 0.515]} material={mats.face} />

          {/* single thick brow */}
          <RoundedBox args={[1.58, 0.27, 0.2]} radius={0.07} smoothness={5} position={[0, 0.37, 0.6]} material={mats.body} />

          {/* eyes (tall black rectangles) + tiny highlights */}
          <RoundedBox ref={leftEye} args={[0.2, 0.39, 0.055]} radius={0.045} smoothness={5} position={[-0.46, 0.05, 0.585]} material={mats.eye} />
          <RoundedBox ref={rightEye} args={[0.2, 0.39, 0.055]} radius={0.045} smoothness={5} position={[0.46, 0.05, 0.585]} material={mats.eye} />
          <mesh position={[-0.5, 0.14, 0.62]} material={mats.hi}><sphereGeometry args={[0.045, 16, 16]} /></mesh>
          <mesh position={[0.42, 0.14, 0.62]} material={mats.hi}><sphereGeometry args={[0.045, 16, 16]} /></mesh>

          {/* muzzle — one big, wide, flat block filling the lower face, its top
              just under the eyes, with two square nostrils near the top. Reads
              as an ape muzzle (not a rounded bear snout). Projects past the brow. */}
          <group position={[0, -0.44, 0.66]}>
            <RoundedBox args={[1.06, 0.66, 0.46]} radius={0.1} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.14, 0.17, 0.07]} radius={0.03} smoothness={4} position={[-0.2, 0.16, 0.24]} material={mats.nostril} />
            <RoundedBox args={[0.14, 0.17, 0.07]} radius={0.03} smoothness={4} position={[0.2, 0.16, 0.24]} material={mats.nostril} />
          </group>

          {/* ears — rectangular with a recessed square center */}
          <group position={[-1.08, -0.03, 0]}>
            <RoundedBox args={[0.43, 0.61, 0.3]} radius={0.09} smoothness={5} material={mats.body} />
            <RoundedBox args={[0.17, 0.22, 0.035]} radius={0.03} smoothness={4} position={[-0.06, 0, 0.14]} material={mats.innerEar} />
          </group>
          <group position={[1.08, -0.03, 0]}>
            <RoundedBox args={[0.43, 0.61, 0.3]} radius={0.09} smoothness={5} material={mats.body} />
            <RoundedBox args={[0.17, 0.22, 0.035]} radius={0.03} smoothness={4} position={[0.06, 0, 0.14]} material={mats.innerEar} />
          </group>
        </group>
      </group>
    </group>
  );
}
