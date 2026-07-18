"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { ApeStatus } from "./ApeAgent.types";
import { STATUS_LOOK } from "./WorkspaceRoom.config";

/** The desk-edge underlight + status dot that broadcasts an agent's state
 *  without opening a panel. Gently pulses for working / thinking / waiting. */
export function WorkstationStatusFX({ status, deskWidth = 2.1 }: { status: ApeStatus; deskWidth?: number }) {
  const look = STATUS_LOOK[status] ?? STATUS_LOOK.idle;
  const edge = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: look.edge, emissive: look.edge, emissiveIntensity: look.emissive, roughness: 0.4 }),
    [look.edge, look.emissive],
  );
  const dotMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: look.dot, emissive: look.dot, emissiveIntensity: 1.4, roughness: 0.3 }),
    [look.dot],
  );

  useFrame((s) => {
    if (!edge.current) return;
    const pulse = status === "working" || status === "thinking" || status === "waiting";
    const k = pulse ? 0.7 + Math.sin(s.clock.elapsedTime * 3) * 0.3 : 1;
    (edge.current.material as THREE.MeshStandardMaterial).emissiveIntensity = look.emissive * k;
  });

  return (
    <group>
      {/* thin underlight line beneath the desk front edge */}
      <RoundedBox ref={edge} args={[deskWidth * 0.94, 0.04, 0.05]} radius={0.02} smoothness={3} position={[0, 0.64, 0.53]} material={mat} />
      {/* small status dot on the desk corner */}
      <mesh position={[deskWidth / 2 - 0.16, 0.8, 0.42]} material={dotMat}>
        <sphereGeometry args={[0.045, 16, 16]} />
      </mesh>
    </group>
  );
}

/** A tiny CanvasTexture used as the monitor content for each status. */
export function makeScreenTexture(status: ApeStatus, progress = 0.6): THREE.CanvasTexture {
  const look = STATUS_LOOK[status] ?? STATUS_LOOK.idle;
  const c = document.createElement("canvas"); c.width = 384; c.height = 240;
  const x = c.getContext("2d")!;
  x.fillStyle = look.screen; x.fillRect(0, 0, 384, 240);
  const accent = look.dot;
  if (status === "working") {
    x.fillStyle = "#5b5346"; x.fillRect(28, 34, 150, 10);
    x.fillStyle = accent; x.fillRect(28, 60, Math.max(20, progress * 300), 14);
    for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? accent : "#e6c58a"; const h = 30 + ((i * 37) % 90); x.fillRect(30 + i * 66, 200 - h, 40, h); }
  } else if (status === "thinking") {
    x.fillStyle = accent; for (let i = 0; i < 4; i++) x.beginPath(), x.arc(70 + i * 80, 120, 12, 0, 7), x.fill();
  } else if (status === "waiting") {
    x.fillStyle = "#E6AE3C"; x.fillRect(90, 80, 200, 80); x.fillStyle = look.screen; x.font = "bold 26px sans-serif"; x.fillText("APPROVE?", 130, 130);
  } else if (status === "completed") {
    x.strokeStyle = "#4E9E63"; x.lineWidth = 14; x.beginPath(); x.moveTo(150, 120); x.lineTo(180, 155); x.lineTo(235, 90); x.stroke();
  } else if (status === "error") {
    x.fillStyle = "#E06A50"; x.fillRect(120, 90, 144, 60);
  } else {
    x.fillStyle = accent; x.beginPath(); x.arc(40, 40, 8, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
