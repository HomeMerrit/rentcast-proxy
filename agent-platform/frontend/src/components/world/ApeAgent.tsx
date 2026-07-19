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
  color = "#E97B29",
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
      body: std(color, 0.55),
      eye: new THREE.MeshStandardMaterial({ color: "#0E0D0C", roughness: 0.16, metalness: 0, wireframe: debug }),
      hole: std("#5C2A0A", 0.85),        // deep recessed cavities (nostrils + ears)
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
        {/* TORSO — shorter & narrower than the head */}
        <RoundedBox args={[1.32, 1.12, 0.9]} radius={0.12} smoothness={5} position={[0, 1.04, 0]} material={mats.body} castShadow receiveShadow />

        {/* LEGS — short stubby, small gap */}
        <RoundedBox args={[0.5, 0.54, 0.62]} radius={0.1} smoothness={5} position={[-0.33, 0.27, 0.03]} material={mats.body} castShadow />
        <RoundedBox args={[0.5, 0.54, 0.62]} radius={0.1} smoothness={5} position={[0.33, 0.27, 0.03]} material={mats.body} castShadow />

        {/* ARMS (pivot at the shoulder) + HANDS — hanging at the sides */}
        <group ref={leftArm} position={[-0.86, 1.56, 0.02]}>
          <RoundedBox args={[0.46, 0.8, 0.56]} radius={0.13} smoothness={5} position={[0, -0.43, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.44, 0.36, 0.52]} radius={0.13} smoothness={5} position={[0, -0.94, 0.02]} material={mats.body} castShadow />
        </group>
        <group ref={rightArm} position={[0.86, 1.56, 0.02]}>
          <RoundedBox args={[0.46, 0.8, 0.56]} radius={0.13} smoothness={5} position={[0, -0.43, 0]} material={mats.body} castShadow />
          <RoundedBox args={[0.44, 0.36, 0.52]} radius={0.13} smoothness={5} position={[0, -0.94, 0.02]} material={mats.body} castShadow />
        </group>

        {/* HEAD group (origin at head center) — big near-cubic hero, seated on torso */}
        <group ref={head} position={[0, 2.42, 0]}>
          <RoundedBox args={[1.9, 1.78, 1.18]} radius={0.14} smoothness={5} material={mats.body} castShadow />

          {/* BROW — thick visor bar projecting forward over the eyes */}
          <RoundedBox args={[1.5, 0.28, 0.38]} radius={0.12} smoothness={5} position={[0, 0.34, 0.52]} material={mats.body} castShadow />

          {/* EYES — black rounded rectangles tucked under the brow + matching highlights */}
          <RoundedBox ref={leftEye} args={[0.2, 0.32, 0.06]} radius={0.05} smoothness={5} position={[-0.42, 0.05, 0.6]} material={mats.eye} castShadow />
          <RoundedBox ref={rightEye} args={[0.2, 0.32, 0.06]} radius={0.05} smoothness={5} position={[0.42, 0.05, 0.6]} material={mats.eye} castShadow />
          <mesh position={[-0.48, 0.14, 0.645]} material={mats.hi}><sphereGeometry args={[0.038, 18, 18]} /></mesh>
          <mesh position={[0.36, 0.14, 0.645]} material={mats.hi}><sphereGeometry args={[0.038, 18, 18]} /></mesh>

          {/* MUZZLE — large block projecting well forward, sitting below the eyes,
              with two recessed square nostril holes near its top */}
          <group position={[0, -0.46, 0.58]}>
            <RoundedBox args={[0.98, 0.66, 0.72]} radius={0.14} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.15, 0.15, 0.14]} radius={0.02} smoothness={4} position={[-0.17, 0.16, 0.3]} material={mats.hole} />
            <RoundedBox args={[0.15, 0.15, 0.14]} radius={0.02} smoothness={4} position={[0.17, 0.16, 0.3]} material={mats.hole} />
          </group>

          {/* EARS — cubic tabs on the sides, each with a recessed square hole */}
          <group position={[-1.02, 0.06, 0.04]}>
            <RoundedBox args={[0.5, 0.56, 0.5]} radius={0.12} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.2, 0.2, 0.16]} radius={0.025} smoothness={4} position={[0, 0, 0.19]} material={mats.hole} />
          </group>
          <group position={[1.02, 0.06, 0.04]}>
            <RoundedBox args={[0.5, 0.56, 0.5]} radius={0.12} smoothness={5} material={mats.body} castShadow />
            <RoundedBox args={[0.2, 0.2, 0.16]} radius={0.025} smoothness={4} position={[0, 0, 0.19]} material={mats.hole} />
          </group>
        </group>
      </group>
    </group>
  );
}
