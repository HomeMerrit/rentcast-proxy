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
  color = "#DC5F0E",
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
      new THREE.MeshStandardMaterial({ color: c, roughness, metalness: 0, envMapIntensity: 0.85, wireframe: debug });
    return {
      body: std(color, 0.38),
      eye: new THREE.MeshStandardMaterial({
        color: "#000000", roughness: 0.25, metalness: 0, envMapIntensity: 0.35, wireframe: debug,
      }),
      hole: std("#43200A", 0.9),         // deep recessed cavities (nostrils + ears)
      hi: new THREE.MeshBasicMaterial({ color: "#FFFFFF", wireframe: debug }),
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
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.018, 0]} visible={false}>
        <ringGeometry args={[0.82, 0.9, 64]} />
        <meshBasicMaterial color="#FFB36E" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <group ref={bob}>
        {/* TORSO — small pedestal under the head */}
        <RoundedBox args={[1.1, 0.85, 0.9]} radius={0.09} smoothness={4} position={[0, 0.52, 0.05]} material={mats.body} castShadow receiveShadow />

        {/* LEGS — short stubs, square gap */}
        <RoundedBox args={[0.44, 0.5, 0.6]} radius={0.07} smoothness={4} position={[-0.32, 0.25, 0.1]} material={mats.body} castShadow />
        <RoundedBox args={[0.44, 0.5, 0.6]} radius={0.07} smoothness={4} position={[0.32, 0.25, 0.1]} material={mats.body} castShadow />

        {/* ARMS — outer edge just past the head side; upper + fist */}
        <group ref={leftArm} position={[-0.825, 1.4, 0.02]}>
          <RoundedBox args={[0.47, 0.85, 0.55]} radius={0.09} smoothness={4} position={[0, -0.38, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.4, 0.36, 0.48]} radius={0.08} smoothness={4} position={[0, -0.85, 0.02]} material={mats.body} castShadow />
        </group>
        <group ref={rightArm} position={[0.825, 1.4, 0.02]}>
          <RoundedBox args={[0.47, 0.85, 0.55]} radius={0.09} smoothness={4} position={[0, -0.38, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.4, 0.36, 0.48]} radius={0.08} smoothness={4} position={[0, -0.85, 0.02]} material={mats.body} castShadow />
        </group>

        {/* HEAD — the hero (~69% of total height), crisp near-cube */}
        <group ref={head} position={[0, 1.98, 0]}>
          <RoundedBox args={[1.92, 2.1, 1.7]} radius={0.1} smoothness={4} position={[0, 0, -0.03]} material={mats.body} castShadow />

          {/* BROW — full-width visor bar, proud of the face */}
          <RoundedBox args={[1.98, 0.2, 0.36]} radius={0.06} smoothness={4} position={[0, 0.38, 0.68]} material={mats.body} castShadow />

          {/* EYES — big glossy black, fully visible below the brow */}
          <RoundedBox ref={leftEye} args={[0.26, 0.39, 0.1]} radius={0.045} smoothness={4} position={[-0.46, 0.05, 0.78]} material={mats.eye} />
          <RoundedBox ref={rightEye} args={[0.26, 0.39, 0.1]} radius={0.045} smoothness={4} position={[0.46, 0.05, 0.78]} material={mats.eye} />
          <mesh position={[-0.53, 0.15, 0.835]} material={mats.hi}><sphereGeometry args={[0.05, 18, 18]} /></mesh>
          <mesh position={[0.39, 0.15, 0.835]} material={mats.hi}><sphereGeometry args={[0.05, 18, 18]} /></mesh>

          {/* NOSE — clearly below the eyes so it never occludes them, projecting
              forward; nostril holes punched into its top near the front edge */}
          <RoundedBox args={[0.78, 0.42, 0.62]} radius={0.06} smoothness={4} position={[0, -0.5, 0.88]} material={mats.body} castShadow />
          <RoundedBox args={[0.15, 0.1, 0.15]} radius={0.02} smoothness={4} position={[-0.2, -0.325, 1.05]} material={mats.hole} />
          <RoundedBox args={[0.15, 0.1, 0.15]} radius={0.02} smoothness={4} position={[0.2, -0.325, 1.05]} material={mats.hole} />

          {/* MOUTH — wide slab under the nose, plus a thinner chin lip at the base */}
          <RoundedBox args={[1.09, 0.34, 0.5]} radius={0.07} smoothness={4} position={[0, -0.88, 0.7]} material={mats.body} castShadow />
          <RoundedBox args={[1.02, 0.2, 0.46]} radius={0.07} smoothness={4} position={[0, -1.03, 0.66]} material={mats.body} castShadow />

          {/* EARS — thick slabs sunk into the head sides, square through-hole */}
          <group position={[-1.0, -0.025, 0.45]}>
            <RoundedBox args={[0.42, 0.75, 0.5]} radius={0.08} smoothness={4} material={mats.body} castShadow />
            <RoundedBox args={[0.23, 0.23, 0.2]} radius={0.03} smoothness={4} position={[-0.02, 0.02, 0.16]} material={mats.hole} />
          </group>
          <group position={[1.0, -0.025, 0.45]}>
            <RoundedBox args={[0.42, 0.75, 0.5]} radius={0.08} smoothness={4} material={mats.body} castShadow />
            <RoundedBox args={[0.23, 0.23, 0.2]} radius={0.03} smoothness={4} position={[0.02, 0.02, 0.16]} material={mats.hole} />
          </group>
        </group>
      </group>
    </group>
  );
}
