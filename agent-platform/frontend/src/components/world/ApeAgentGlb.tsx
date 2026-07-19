"use client";
import { useState } from "react";
import * as THREE from "three";
import { ApeAgentModel, type ApeClip, type ApeJersey, type ApePattern } from "./ApeAgentModel";
import { StatusFx } from "./StatusFx";
import type { ApeAgentProps } from "./ApeAgent.types";

/**
 * Room instance of the locked GLB master. This is only the interaction shell —
 * click / hover / selection ring around ApeAgentModel. Appearance and motion
 * come exclusively from the baked asset (status drives the approved clips).
 */
export function ApeAgentGlb({
  id, position, rotation, scale = 1, status = "idle", selected = false, onClick, clip = null, color, jersey = null, pattern = null,
}: ApeAgentProps & { clip?: ApeClip | null; jersey?: ApeJersey | null; pattern?: ApePattern | null }) {
  const [hovered, setHovered] = useState(false);
  const accent = color ?? "#FFB36E";

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
            color={accent} transparent opacity={selected ? 0.55 : 0.28}
            depthWrite={false} side={THREE.DoubleSide}
          />
        </mesh>
      )}
      <ApeAgentModel status={status} clip={clip} accent={color ?? null} jersey={jersey} pattern={pattern} />
      {/* floating status glyph (allowed: FX live outside the character mesh) */}
      <StatusFx status={status} accent={accent} height={2.9} />
    </group>
  );
}
