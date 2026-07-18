"use client";
import { useMemo, useState } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { ApeStatus } from "./ApeAgent.types";
import type { WorkstationType } from "./WorkspaceRoom.types";
import { PALETTE } from "./WorkspaceRoom.config";
import { WorkstationStatusFX, makeScreenTexture } from "./RoomStatusEffects";

/** A built-in rounded desk + screen + chair + status broadcast. Placed inside a
 *  workstation anchor; the ApeAgent is placed alongside it by the room. */
export function AgentWorkstation({
  id, status = "idle", type = "standard", empty = false, onCreate,
}: {
  id: string; status?: ApeStatus; type?: WorkstationType; empty?: boolean; onCreate?: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const M = useMemo(() => ({
    desk: new THREE.MeshStandardMaterial({ color: PALETTE.desk, roughness: 0.55, metalness: 0 }),
    base: new THREE.MeshStandardMaterial({ color: "#ECE5DA", roughness: 0.7 }),
    frame: new THREE.MeshStandardMaterial({ color: PALETTE.screenFrame, roughness: 0.4 }),
    chair: new THREE.MeshStandardMaterial({ color: "#EFE7DB", roughness: 0.7 }),
    chairAccent: new THREE.MeshStandardMaterial({ color: PALETTE.orange, roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2a2622", roughness: 0.6 }),
  }), []);

  const screenMat = useMemo(() => {
    const tex = makeScreenTexture(empty ? "idle" : status, 0.62);
    return new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: empty ? 0.25 : 0.9, roughness: 0.35 });
  }, [status, empty]);

  return (
    <group>
      {/* desk */}
      <RoundedBox args={[2.1, 0.16, 1.05]} radius={0.12} smoothness={4} position={[0, 0.78, 0]} material={M.desk} castShadow receiveShadow />
      <RoundedBox args={[1.7, 0.7, 0.8]} radius={0.12} smoothness={4} position={[0, 0.4, -0.02]} material={M.base} castShadow />

      {/* monitor (faces the room / camera; kept low so the ape's face reads) */}
      <group position={[0, 0.86, -0.28]}>
        <RoundedBox args={[0.13, 0.24, 0.13]} radius={0.05} smoothness={3} position={[0, 0.12, 0]} material={M.base} />
        <RoundedBox args={[1.08, 0.64, 0.06]} radius={0.05} smoothness={3} position={[0, 0.5, 0]} material={M.frame} castShadow />
        <mesh position={[0, 0.5, 0.035]} material={screenMat}><planeGeometry args={[0.96, 0.56]} /></mesh>
      </group>

      {/* chair (compact, tucked behind) */}
      {!empty && (
        <group position={[0, 0, -1.15]}>
          <RoundedBox args={[0.86, 0.16, 0.78]} radius={0.1} smoothness={3} position={[0, 0.48, 0]} material={M.chair} castShadow />
          <RoundedBox args={[0.8, 0.02, 0.72]} radius={0.02} smoothness={2} position={[0, 0.57, 0]} material={M.chairAccent} />
          <RoundedBox args={[0.82, 0.62, 0.14]} radius={0.1} smoothness={3} position={[0, 0.9, -0.32]} material={M.chair} castShadow />
          <mesh position={[0, 0.24, 0]} material={M.dark}><cylinderGeometry args={[0.08, 0.12, 0.48, 12]} /></mesh>
        </group>
      )}

      {!empty && <WorkstationStatusFX status={status} deskWidth={2.1} />}

      {/* empty station: available capacity */}
      {empty && (
        <group
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
          onClick={(e) => { e.stopPropagation(); onCreate?.(id); }}
        >
          <RoundedBox args={[2.0, 0.03, 0.05]} radius={0.015} smoothness={2} position={[0, 0.64, 0.53]}
            material={new THREE.MeshStandardMaterial({ color: PALETTE.orange, emissive: PALETTE.orange, emissiveIntensity: hover ? 0.9 : 0.25, roughness: 0.5 })} />
          <group position={[0, 1.5, 0]} scale={hover ? 1.15 : 1}>
            <mesh material={M.chairAccent}><boxGeometry args={[0.5, 0.12, 0.08]} /></mesh>
            <mesh material={M.chairAccent}><boxGeometry args={[0.12, 0.5, 0.08]} /></mesh>
          </group>
        </group>
      )}
    </group>
  );
}
