"use client";
import { RoundedBox } from "@react-three/drei";

/**
 * Exact rebuild of the reference ape to the V2 locked master spec (floor y = 0).
 * Root is rotated for the three-quarter angle by the preview scene.
 *
 * Deviations from V2's literal numbers, both anticipated by the spec:
 *  - Torso/arms raised so the big head sits on the body (V2 notes the neck gap is
 *    resolved in "one overlay-tuning pass"; this is that pass).
 *  - Nostrils are near-black squares sitting flush-proud of the muzzle front rather
 *    than a boolean cut — drei's RoundedBox can't carve, and at render scale a dark
 *    recessed square reads as a punched hole. (Same for the ear recess, darkened.)
 *
 * drei's RoundedBox collapses if radius >= min(dim)/2, so radius is clamped per-box.
 */

const COL = {
  body: "#F58220",
  face: "#F98B2C",
  innerEar: "#743509", // darker than the spec's #C85A10 so the recess reads as a hole
  nostril: "#241204",  // near-black so the flush square reads as a punched nostril
  eye: "#11100E",
} as const;

type Vec3 = [number, number, number];

function Box({
  args, position, radius, color, roughness = 0.48, wireframe = false,
}: {
  args: Vec3; position: Vec3; radius: number; color: string;
  roughness?: number; wireframe?: boolean;
}) {
  const r = Math.min(radius, Math.min(...args) / 2 - 0.002);
  return (
    <RoundedBox args={args} position={position} radius={r} smoothness={6} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} wireframe={wireframe} />
    </RoundedBox>
  );
}

export function ApeExact({ wireframe = false }: { wireframe?: boolean }) {
  const HI: Vec3 = [-0.038, 0.084, 0.038]; // white highlight, upper-left of each eye

  return (
    <group rotation={[0, -0.279, 0]}> {/* -16° */}
      {/* ── TORSO — broad & short (raised from V2 y=1.00 to close the neck gap) ── */}
      <Box args={[1.28, 1.18, 0.80]} position={[0, 1.26, 0]} radius={0.10} color={COL.body} wireframe={wireframe} />

      {/* legs — very short, wide, ~0.18 gap */}
      <Box args={[0.50, 0.68, 0.66]} position={[-0.34, 0.34, 0.06]} radius={0.078} color={COL.body} wireframe={wireframe} />
      <Box args={[0.50, 0.68, 0.66]} position={[0.34, 0.34, 0.06]} radius={0.078} color={COL.body} wireframe={wireframe} />

      {/* arms — long, low, close to the body (upper arm + hand, raised with the torso) */}
      <Box args={[0.43, 0.91, 0.53]} position={[-0.86, 1.40, 0]} radius={0.09} color={COL.body} wireframe={wireframe} />
      <Box args={[0.43, 0.91, 0.53]} position={[0.86, 1.40, 0]} radius={0.09} color={COL.body} wireframe={wireframe} />
      <Box args={[0.30, 0.42, 0.39]} position={[-0.86, 0.78, 0.02]} radius={0.065} color={COL.body} wireframe={wireframe} />
      <Box args={[0.30, 0.42, 0.39]} position={[0.86, 0.78, 0.02]} radius={0.065} color={COL.body} wireframe={wireframe} />

      {/* ── HEAD — giant near-cube ─────────────────────────────────────────── */}
      <Box args={[1.92, 1.62, 1.06]} position={[0, 2.70, 0]} radius={0.13} color={COL.body} wireframe={wireframe} />

      {/* broad shallow face panel */}
      <Box args={[1.54, 0.82, 0.10]} position={[0, 2.58, 0.575]} radius={0.075} color={COL.face} wireframe={wireframe} />

      {/* one uninterrupted brow bar */}
      <Box args={[1.60, 0.27, 0.19]} position={[0, 3.11, 0.645]} radius={0.07} color={COL.body} wireframe={wireframe} />

      {/* eyes — tall glossy-black rounded rectangles, white dot upper-left */}
      <group position={[-0.43, 2.82, 0.632]}>
        <Box args={[0.19, 0.36, 0.06]} position={[0, 0, 0]} radius={0.042} color={COL.eye} roughness={0.11} wireframe={wireframe} />
        <mesh position={HI}><sphereGeometry args={[0.038, 16, 16]} /><meshBasicMaterial color="#FFFFFF" wireframe={wireframe} /></mesh>
      </group>
      <group position={[0.43, 2.82, 0.632]}>
        <Box args={[0.19, 0.36, 0.06]} position={[0, 0, 0]} radius={0.042} color={COL.eye} roughness={0.11} wireframe={wireframe} />
        <mesh position={HI}><sphereGeometry args={[0.038, 16, 16]} /><meshBasicMaterial color="#FFFFFF" wireframe={wireframe} /></mesh>
      </group>

      {/* ── MUZZLE — compact projecting pad + lower lip block ───────────────── */}
      <Box args={[0.94, 0.53, 0.38]} position={[0, 2.35, 0.785]} radius={0.085} color={COL.face} wireframe={wireframe} />
      <Box args={[0.80, 0.16, 0.29]} position={[0, 2.02, 0.725]} radius={0.052} color={COL.face} wireframe={wireframe} />

      {/* nostrils — small near-black square recesses on the muzzle front (z≈0.975) */}
      <Box args={[0.14, 0.155, 0.07]} position={[-0.21, 2.36, 0.95]} radius={0.02} color={COL.nostril} wireframe={wireframe} />
      <Box args={[0.14, 0.155, 0.07]} position={[0.21, 2.36, 0.95]} radius={0.02} color={COL.nostril} wireframe={wireframe} />

      {/* ── EARS — rounded cubes with a deep square recess ─────────────────── */}
      <Box args={[0.45, 0.62, 0.31]} position={[-1.085, 2.67, 0.015]} radius={0.095} color={COL.body} wireframe={wireframe} />
      <Box args={[0.45, 0.62, 0.31]} position={[1.085, 2.67, 0.015]} radius={0.095} color={COL.body} wireframe={wireframe} />
      <Box args={[0.17, 0.22, 0.10]} position={[-1.085, 2.67, 0.16]} radius={0.02} color={COL.innerEar} wireframe={wireframe} />
      <Box args={[0.17, 0.22, 0.10]} position={[1.085, 2.67, 0.16]} radius={0.02} color={COL.innerEar} wireframe={wireframe} />
    </group>
  );
}
