"use client";
import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE } from "./WorkspaceRoom.config";
import type { RoomConfig } from "./WorkspaceRoom.types";

/** Warm, rounded architectural shell: floor, two walls, ceiling, window, emblem. */
export function WorkspaceShell({ room }: { room: RoomConfig }) {
  const { width: W, depth: D, height: H } = room.size;
  const M = useMemo(() => {
    const s = (c: string, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
    return {
      wall: s(PALETTE.arch, 0.85), wallWarm: s(PALETTE.archWarm, 0.85),
      floor: s("#ECE4D5", 0.7), charcoal: s(PALETTE.charcoal, 0.6),
      orange: new THREE.MeshStandardMaterial({ color: PALETTE.orange, emissive: PALETTE.orange, emissiveIntensity: 0.12, roughness: 0.5 }),
      leaf: s("#7FB06B", 1), pot: s(PALETTE.archWarm, 0.8),
      metal: s(PALETTE.metal, 0.5),
      ceil: s(PALETTE.archWarm, 0.9),
      panel: s("#EFE8DE", 0.9),
      sky: new THREE.MeshBasicMaterial({ color: "#dfeaf6" }),
      rug: s("#D3C9BC", 0.95),
    };
  }, []);

  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={M.floor}>
        <planeGeometry args={[W + 4, D + 4]} />
      </mesh>

      {/* rug */}
      {room.rug && (
        <mesh rotation-x={-Math.PI / 2} position={[room.rug.position[0], 0.012, room.rug.position[2]]} receiveShadow material={M.rug}>
          <planeGeometry args={room.rug.size} />
        </mesh>
      )}

      {/* back wall (-z) with inset panel + emblem */}
      <group position={[0, 0, -D / 2]}>
        <RoundedBox args={[W, H, 0.24]} radius={0.3} smoothness={4} position={[0, H / 2, 0]} material={M.wall} receiveShadow />
        <RoundedBox args={[W * 0.62, H * 0.6, 0.12]} radius={0.24} smoothness={4} position={[0, H * 0.55, 0.16]} material={M.panel} />
        <ApeEmblem position={[0, H * 0.62, 0.28]} />
        {/* shared wall display */}
        <RoundedBox args={[W * 0.34, 1.3, 0.08]} radius={0.1} smoothness={4} position={[W * 0.24, 2.5, 0.24]} material={M.charcoal} />
      </group>

      {/* left wall (-x) with a large window */}
      <group position={[-W / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBox args={[D, H, 0.24]} radius={0.3} smoothness={4} position={[0, H / 2, 0]} material={M.wall} receiveShadow />
        {/* sky + trim (window reads as an opening) */}
        <mesh position={[0, 2.6, 0.14]} material={M.sky}><planeGeometry args={[4.8, 3.2]} /></mesh>
        <mesh position={[0, 2.6, 0.14]}><planeGeometry args={[4.8, 3.2]} />
          <meshBasicMaterial color="#eaf2fb" transparent opacity={0.5} /></mesh>
        <RoundedBox args={[5.1, 0.16, 0.16]} radius={0.06} smoothness={3} position={[0, 4.24, 0.14]} material={M.orange} />
        <RoundedBox args={[5.1, 0.16, 0.16]} radius={0.06} smoothness={3} position={[0, 0.96, 0.14]} material={M.wallWarm} />
        <RoundedBox args={[0.16, 3.4, 0.16]} radius={0.06} smoothness={3} position={[-2.5, 2.6, 0.14]} material={M.wallWarm} />
        <RoundedBox args={[0.16, 3.4, 0.16]} radius={0.06} smoothness={3} position={[2.5, 2.6, 0.14]} material={M.wallWarm} />
      </group>

      {/* ceiling: recessed luminous panel (soft, framed — no bright strips) */}
      <group position={[0, H, 0]}>
        <mesh rotation-x={Math.PI / 2} material={M.ceil}><planeGeometry args={[W + 4, D + 4]} /></mesh>
        <mesh rotation-x={Math.PI / 2} position={[0, -0.02, 0]}>
          <planeGeometry args={[W * 0.55, D * 0.55]} />
          <meshBasicMaterial color="#fff6ea" />
        </mesh>
      </group>

      {/* plant + side console (single-agent studio accents) */}
      <Plant position={[4.2, 0, -2.7]} leaf={M.leaf} pot={M.pot} />
      <group position={[-3.8, 0, -2.8]}>
        <RoundedBox args={[1.6, 0.9, 0.7]} radius={0.12} smoothness={4} position={[0, 0.45, 0]} material={M.wallWarm} castShadow />
        <RoundedBox args={[1.5, 0.05, 0.6]} radius={0.02} smoothness={2} position={[0, 0.92, 0]} material={M.metal} />
        <mesh position={[0.1, 1.1, 0]} material={M.charcoal}><boxGeometry args={[0.5, 0.32, 0.05]} /></mesh>
      </group>
    </group>
  );
}

function Plant({ position, leaf, pot }: { position: [number, number, number]; leaf: THREE.Material; pot: THREE.Material }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.28, 0]} material={pot} castShadow><cylinderGeometry args={[0.26, 0.2, 0.56, 20]} /></mesh>
      {[[0, 0.75, 0], [0.18, 0.68, 0.05], [-0.16, 0.66, -0.06], [0.06, 0.86, -0.1]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} material={leaf} castShadow>
          <icosahedronGeometry args={[0.26 - i * 0.02, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** Minimal block ape-head emblem — same language as the mascot. */
function ApeEmblem({ position }: { position: [number, number, number] }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.orange, roughness: 0.5, emissive: PALETTE.orange, emissiveIntensity: 0.18 }), []);
  const eye = useMemo(() => new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.3 }), []);
  return (
    <group position={position} scale={0.5}>
      <RoundedBox args={[1.86, 1.68, 0.2]} radius={0.14} smoothness={4} material={mat} />
      <RoundedBox args={[0.43, 0.61, 0.2]} radius={0.09} smoothness={4} position={[-1.05, -0.03, 0]} material={mat} />
      <RoundedBox args={[0.43, 0.61, 0.2]} radius={0.09} smoothness={4} position={[1.05, -0.03, 0]} material={mat} />
      <RoundedBox args={[1.58, 0.27, 0.16]} radius={0.07} smoothness={4} position={[0, 0.37, 0.12]} material={mat} />
      <RoundedBox args={[0.2, 0.39, 0.08]} radius={0.04} smoothness={4} position={[-0.46, 0.05, 0.14]} material={eye} />
      <RoundedBox args={[0.2, 0.39, 0.08]} radius={0.04} smoothness={4} position={[0.46, 0.05, 0.14]} material={eye} />
      <RoundedBox args={[0.94, 0.55, 0.18]} radius={0.08} smoothness={4} position={[0, -0.38, 0.16]} material={mat} />
    </group>
  );
}
