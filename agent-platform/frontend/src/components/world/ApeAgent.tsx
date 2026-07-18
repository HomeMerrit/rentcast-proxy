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
      body: std(color, 0.5),
      face: std("#FF8728", 0.5),         // subtly brighter face / muzzle orange
      eye: new THREE.MeshStandardMaterial({ color: "#0E0D0C", roughness: 0.18, metalness: 0, wireframe: debug }),
      nostril: std("#A94A0A", 0.6),      // dark orange, recessed (not brown)
      innerEar: std("#C95D12", 0.5),
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
        {/* TORSO */}
        <RoundedBox args={[1.22, 1.1, 0.78]} radius={0.1} smoothness={5} position={[0, 1.08, 0]} material={mats.body} castShadow receiveShadow />

        {/* LEGS */}
        <RoundedBox args={[0.48, 0.62, 0.63]} radius={0.075} smoothness={5} position={[-0.32, 0.31, 0.04]} material={mats.body} castShadow />
        <RoundedBox args={[0.48, 0.62, 0.63]} radius={0.075} smoothness={5} position={[0.32, 0.31, 0.04]} material={mats.body} castShadow />

        {/* ARMS (pivot at the shoulder) + HANDS */}
        <group ref={leftArm} position={[-0.83, 1.64, 0]}>
          <RoundedBox args={[0.42, 0.92, 0.52]} radius={0.09} smoothness={5} position={[0, -0.46, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.29, 0.42, 0.38]} radius={0.065} smoothness={5} position={[0, -1.09, 0]} material={mats.body} castShadow />
        </group>
        <group ref={rightArm} position={[0.83, 1.64, 0]}>
          <RoundedBox args={[0.42, 0.92, 0.52]} radius={0.09} smoothness={5} position={[0, -0.46, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.29, 0.42, 0.38]} radius={0.065} smoothness={5} position={[0, -1.09, 0]} material={mats.body} castShadow />
        </group>

        {/* HEAD group (origin at head center) — seated on the torso, no neck gap */}
        <group ref={head} position={[0, 2.46, 0]}>
          <RoundedBox args={[1.86, 1.68, 1.02]} radius={0.12} smoothness={5} material={mats.body} castShadow />

          {/* FACE PANEL */}
          <RoundedBox args={[1.54, 0.88, 0.1]} radius={0.08} smoothness={5} position={[0, -0.12, 0.545]} material={mats.face} />

          {/* BROW */}
          <RoundedBox args={[1.58, 0.27, 0.2]} radius={0.07} smoothness={5} position={[0, 0.38, 0.62]} material={mats.body} castShadow />

          {/* EYES (+ highlight in the same corner of both) */}
          <group position={[-0.43, 0.17, 0.575]}>
            <RoundedBox ref={leftEye} args={[0.2, 0.39, 0.06]} radius={0.045} smoothness={5} material={mats.eye} castShadow />
            <mesh position={[-0.045, 0.085, 0.037]} material={mats.hi}><sphereGeometry args={[0.042, 20, 20]} /></mesh>
          </group>
          <group position={[0.43, 0.17, 0.575]}>
            <RoundedBox ref={rightEye} args={[0.2, 0.39, 0.06]} radius={0.045} smoothness={5} material={mats.eye} castShadow />
            <mesh position={[-0.045, 0.085, 0.037]} material={mats.hi}><sphereGeometry args={[0.042, 20, 20]} /></mesh>
          </group>

          {/* MUZZLE + LOWER MUZZLE */}
          <RoundedBox args={[0.9, 0.48, 0.33]} radius={0.08} smoothness={5} position={[0, -0.31, 0.72]} material={mats.face} castShadow />
          <RoundedBox args={[0.76, 0.14, 0.26]} radius={0.05} smoothness={5} position={[0, -0.64, 0.67]} material={mats.face} />

          {/* NOSTRILS */}
          <RoundedBox args={[0.105, 0.135, 0.035]} radius={0.018} smoothness={4} position={[-0.2, -0.28, 0.875]} material={mats.nostril} />
          <RoundedBox args={[0.105, 0.135, 0.035]} radius={0.018} smoothness={4} position={[0.2, -0.28, 0.875]} material={mats.nostril} />

          {/* EARS + INNER EARS */}
          <RoundedBox args={[0.43, 0.61, 0.3]} radius={0.09} smoothness={5} position={[-1.06, -0.02, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.43, 0.61, 0.3]} radius={0.09} smoothness={5} position={[1.06, -0.02, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.17, 0.22, 0.04]} radius={0.025} smoothness={4} position={[-1.06, -0.02, 0.17]} material={mats.innerEar} />
          <RoundedBox args={[0.17, 0.22, 0.04]} radius={0.025} smoothness={4} position={[1.06, -0.02, 0.17]} material={mats.innerEar} />
        </group>
      </group>
    </group>
  );
}
