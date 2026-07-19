"use client";
import { useState } from "react";
import * as THREE from "three";
import { ApeAgentModel } from "./ApeAgentModel";
import type { ApeAgentProps } from "./ApeAgent.types";

/**
 * Room instance of the locked GLB master. This is only the interaction shell —
 * click / hover / selection ring around ApeAgentModel. Appearance and motion
 * come exclusively from the baked asset (status drives the approved clips).
 */
export function ApeAgentGlb({
  id, position, rotation, scale = 1, status = "idle", selected = false, onClick,
}: ApeAgentProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={(e) => { e.stopPropagation(); onClick?.(id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      {(selected || hovered) && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.018, 0]}>
          <ringGeometry args={[1.05, 1.16, 64]} />
          <meshBasicMaterial
            color="#FFB36E" transparent opacity={selected ? 0.55 : 0.28}
            depthWrite={false} side={THREE.DoubleSide}
          />
        </mesh>
      )}
      <ApeAgentModel status={status} />
    </group>
  );
}
