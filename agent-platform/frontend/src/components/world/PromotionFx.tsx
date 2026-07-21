"use client";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";

/**
 * One-shot level-up celebration played at an agent's workstation: rings rise
 * off the floor, sparks burst up in the kit accent, and a "LVL N" tag pops in
 * above the head. Same rules as StatusFx — procedural geometry only, basic
 * materials with toneMapped={false} so they read through the room grade.
 */

const DURATION = 3.4;
const SPARKS = 14;

function easeOut(k: number) {
  return 1 - Math.pow(1 - Math.min(Math.max(k, 0), 1), 3);
}

export function PromotionFx({ level, accent = "#F58220" }: { level: number; accent?: string }) {
  const root = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const rings = useRef<Array<THREE.Mesh | null>>([null, null, null]);
  const sparks = useRef<Array<THREE.Mesh | null>>(Array.from({ length: SPARKS }, () => null));
  const tag = useRef<THREE.Group>(null);
  const tagMat = useRef<THREE.MeshBasicMaterial>(null);

  const sparkSeeds = useMemo(
    () =>
      Array.from({ length: SPARKS }, (_, i) => ({
        angle: (i / SPARKS) * Math.PI * 2 + (i % 3) * 0.35,
        reach: 0.45 + ((i * 37) % 10) / 16,
        lift: 1.5 + ((i * 53) % 10) / 8,
      })),
    [],
  );

  // "LVL N" pill drawn once — the room already uses CanvasTexture for screens
  const tagTexture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const x = c.getContext("2d")!;
    const w = 232, h = 92, r = 46, ox = (256 - w) / 2, oy = (128 - h) / 2;
    x.beginPath();
    x.moveTo(ox + r, oy);
    x.arcTo(ox + w, oy, ox + w, oy + h, r);
    x.arcTo(ox + w, oy + h, ox, oy + h, r);
    x.arcTo(ox, oy + h, ox, oy, r);
    x.arcTo(ox, oy, ox + w, oy, r);
    x.closePath();
    x.fillStyle = "rgba(20,13,8,0.88)";
    x.fill();
    x.lineWidth = 5;
    x.strokeStyle = accent;
    x.stroke();
    x.fillStyle = "#FFF6E8";
    x.font = "bold 52px system-ui, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(`LVL ${level}`, 128, 66);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [level, accent]);

  useFrame(({ clock }) => {
    if (!root.current) return;
    if (born.current === null) born.current = clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    if (t >= DURATION) {
      root.current.visible = false;
      return;
    }

    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const k = (t - i * 0.35) / 1.4;
      const on = k > 0 && k < 1;
      ring.visible = on;
      if (!on) return;
      const e = easeOut(k);
      ring.scale.setScalar(0.4 + e * 1.9);
      ring.position.y = 0.12 + e * 1.8;
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k);
    });

    sparks.current.forEach((spark, i) => {
      if (!spark) return;
      const { angle, reach, lift } = sparkSeeds[i];
      const k = Math.min(t / 1.15, 1);
      const e = easeOut(k);
      spark.position.set(
        Math.cos(angle) * reach * e,
        1.5 + lift * k - 2.1 * k * k,
        Math.sin(angle) * reach * e,
      );
      (spark.material as THREE.MeshBasicMaterial).opacity = k >= 1 ? 0 : 0.95 * (1 - k * k);
    });

    if (tag.current && tagMat.current) {
      const inK = easeOut(t / 0.5);
      const pop = 1 + Math.sin(Math.min(t / 0.5, 1) * Math.PI) * 0.18;
      tag.current.position.y = 2.55 + inK * 0.55 + Math.sin(t * 1.7) * 0.03;
      tag.current.scale.setScalar(inK * pop);
      const fade = (DURATION - t) / 0.6;
      tagMat.current.opacity = Math.min(inK, Math.max(0, Math.min(fade, 1)));
    }
  });

  return (
    <group ref={root}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { rings.current[i] = m; }} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.5, 0.56, 48]} />
          <meshBasicMaterial
            color={accent} toneMapped={false} transparent opacity={0}
            depthWrite={false} side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {sparkSeeds.map((s, i) => (
        <mesh key={s.angle} ref={(m) => { sparks.current[i] = m; }}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      <Billboard>
        <group ref={tag} scale={0}>
          <mesh>
            <planeGeometry args={[0.9, 0.45]} />
            <meshBasicMaterial
              ref={tagMat} map={tagTexture} toneMapped={false} transparent opacity={0}
              depthWrite={false}
            />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}
