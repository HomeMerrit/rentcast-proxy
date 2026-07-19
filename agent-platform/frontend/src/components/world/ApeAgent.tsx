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
      new THREE.MeshStandardMaterial({ color: c, roughness, metalness: 0, wireframe: debug });
    return {
      body: std(color, 0.45),
      eye: new THREE.MeshPhysicalMaterial({
        color: "#0B0A09", roughness: 0.08, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.12, wireframe: debug,
      }),
      hole: std("#3F1D08", 0.9),         // deep recessed cavities (nostrils + ears)
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
        {/* TORSO — small pedestal, ~half the head's width, front near the face plane */}
        <RoundedBox args={[1.14, 0.9, 0.95]} radius={0.14} smoothness={5} position={[0, 0.92, 0.1]} material={mats.body} castShadow receiveShadow />

        {/* LEGS — short stubs, clear square gap, stepping slightly forward */}
        <RoundedBox args={[0.5, 0.52, 0.62]} radius={0.1} smoothness={5} position={[-0.34, 0.26, 0.14]} material={mats.body} castShadow />
        <RoundedBox args={[0.5, 0.52, 0.62]} radius={0.1} smoothness={5} position={[0.34, 0.26, 0.14]} material={mats.body} castShadow />

        {/* ARMS (pivot at the shoulder, emerging from under the head's corners) + FISTS */}
        <group ref={leftArm} position={[-0.88, 1.42, 0.06]}>
          <RoundedBox args={[0.48, 0.85, 0.58]} radius={0.13} smoothness={5} position={[0, -0.36, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.42, 0.38, 0.52]} radius={0.12} smoothness={5} position={[0, -0.93, 0.02]} material={mats.body} castShadow />
        </group>
        <group ref={rightArm} position={[0.88, 1.42, 0.06]}>
          <RoundedBox args={[0.48, 0.85, 0.58]} radius={0.13} smoothness={5} position={[0, -0.36, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.42, 0.38, 0.52]} radius={0.12} smoothness={5} position={[0, -0.93, 0.02]} material={mats.body} castShadow />
        </group>

        {/* HEAD group — the hero: ~2/3 of the character's height, deep near-cube */}
        <group ref={head} position={[0, 2.28, 0]}>
          <RoundedBox args={[2.1, 2.1, 1.75]} radius={0.15} smoothness={5} position={[0, 0, -0.05]} material={mats.body} castShadow />

          {/* BROW — full-width visor bar across the face */}
          <RoundedBox args={[2.1, 0.26, 0.5]} radius={0.11} smoothness={5} position={[0, 0.4, 0.82]} material={mats.body} castShadow />

          {/* EYES — glossy black, tight against the nose, tucked under the brow */}
          <RoundedBox ref={leftEye} args={[0.32, 0.46, 0.07]} radius={0.07} smoothness={5} position={[-0.5, 0.0, 0.83]} material={mats.eye} />
          <RoundedBox ref={rightEye} args={[0.32, 0.46, 0.07]} radius={0.07} smoothness={5} position={[0.5, 0.0, 0.83]} material={mats.eye} />
          <mesh position={[-0.58, 0.13, 0.875]} material={mats.hi}><sphereGeometry args={[0.06, 18, 18]} /></mesh>
          <mesh position={[0.42, 0.13, 0.875]} material={mats.hi}><sphereGeometry args={[0.06, 18, 18]} /></mesh>

          {/* NOSE block — between the eyes, its top at the eye-bottom line (both eyes
              read fully); nostril holes punched into its TOP face near the front edge */}
          <RoundedBox args={[0.86, 0.5, 0.62]} radius={0.11} smoothness={5} position={[0, -0.45, 0.92]} material={mats.body} castShadow />
          <RoundedBox args={[0.16, 0.1, 0.16]} radius={0.02} smoothness={4} position={[-0.19, -0.22, 1.1]} material={mats.hole} />
          <RoundedBox args={[0.16, 0.1, 0.16]} radius={0.02} smoothness={4} position={[0.19, -0.22, 1.1]} material={mats.hole} />

          {/* MOUTH slab — wider than the nose, stepped back, chin reaching the head's base */}
          <RoundedBox args={[1.36, 0.46, 0.55]} radius={0.16} smoothness={5} position={[0, -0.94, 0.78]} material={mats.body} castShadow />

          {/* EARS — big tall tabs at mid-head, pushed forward so the ring reads; square through-hole */}
          <group position={[-1.18, -0.05, 0.45]}>
            <RoundedBox args={[0.54, 0.76, 0.5]} radius={0.14} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.22, 0.22, 0.2]} radius={0.03} smoothness={4} position={[-0.02, 0.02, 0.17]} material={mats.hole} />
          </group>
          <group position={[1.18, -0.05, 0.45]}>
            <RoundedBox args={[0.54, 0.76, 0.5]} radius={0.14} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.22, 0.22, 0.2]} radius={0.03} smoothness={4} position={[0.02, 0.02, 0.17]} material={mats.hole} />
          </group>
        </group>
      </group>
    </group>
  );
}
