// Restrained, premium motion for the ape mascot. Damped easing, no cartoon bounce.
import * as THREE from "three";
import type { MutableRefObject } from "react";
import type { ApeStatus } from "./ApeAgent.types";

type G = MutableRefObject<THREE.Group | null>;
type M = MutableRefObject<THREE.Mesh | null>;

export interface ApeRefs {
  bob: G; head: G; leftArm: G; rightArm: G; leftEye: M; rightEye: M; ring: M;
}

export interface ApeAnimState {
  prev: ApeStatus;
  enterT: number;   // when the current status began
  nextBlink: number;
  blinkUntil: number;
}

export function createApeAnim(t = 0): ApeAnimState {
  return { prev: "idle", enterT: t, nextBlink: t + 3, blinkUntil: 0 };
}

const damp = THREE.MathUtils.damp;
const DEG = Math.PI / 180;

export function updateApe(
  r: ApeRefs, a: ApeAnimState, status: ApeStatus,
  dt: number, t: number, hovered: boolean, selected: boolean,
) {
  const bob = r.bob.current, head = r.head.current, la = r.leftArm.current, ra = r.rightArm.current;
  if (!bob || !head || !la || !ra) return;
  dt = Math.min(dt, 0.05);

  if (status !== a.prev) { a.prev = status; a.enterT = t; }
  const since = t - a.enterT;

  // hover scale (1.00 → 1.025)
  bob.scale.setScalar(damp(bob.scale.x, hovered ? 1.025 : 1.0, 14, dt));

  // ── targets per status ──
  let bobY = Math.sin(t * 1.5) * 0.012;   // breathing
  let hX = 0, hY = 0, hZ = 0;             // head rotation
  let laX = 0, raX = 0;                   // arm rotation (typing/raise)
  let eyeY = 1;                           // eye scale-y (blink / dim)

  if (status === "thinking") {
    hX = -4 * DEG; hZ = Math.sin(t * 1.6) * 0.03; laX = -0.5; eyeY = 1;
  } else if (status === "working") {
    const osc = Math.sin(t * 10) * 0.14;
    laX = -1.12 + osc; raX = -1.12 - osc;
    hX = 8 * DEG + Math.sin(t * 3) * 0.03;
    bobY = Math.sin(t * 2.2) * 0.008;
  } else if (status === "completed") {
    const nod = Math.max(0, 1 - since / 0.7);
    hX = Math.sin(since * 10) * 0.10 * nod;   // one confident nod, decaying
    eyeY = 1.06;                              // eyes brighten (subtle widen)
  } else if (status === "error") {
    hX = 3 * DEG; eyeY = 0.82;                // head lowers, eyes dim
  } else if (status === "waiting") {
    hY = Math.sin(t * 0.6) * 0.06;            // looks toward the user
  } else {
    hY = Math.sin(t * 0.32) * 0.05;           // idle: tiny slow head adjustment
  }

  // blink (idle/waiting/thinking) — quick eye squash
  if (status === "idle" || status === "waiting" || status === "thinking") {
    if (t >= a.nextBlink) { a.blinkUntil = t + 0.12; a.nextBlink = t + 4 + Math.random() * 4; }
    if (t < a.blinkUntil) eyeY = 0.12;
  }

  // ── apply (damped) ──
  bob.position.y = damp(bob.position.y, bobY, 8, dt);
  head.rotation.x = damp(head.rotation.x, hX, 9, dt);
  head.rotation.y = damp(head.rotation.y, hY, 6, dt);
  head.rotation.z = damp(head.rotation.z, hZ, 9, dt);
  la.rotation.x = damp(la.rotation.x, laX, 12, dt);
  ra.rotation.x = damp(ra.rotation.x, raX, 12, dt);

  const le = r.leftEye.current, re = r.rightEye.current;
  const ey = t < a.blinkUntil ? 0.12 : eyeY; // blink snaps, others damp
  if (le) le.scale.y = damp(le.scale.y, ey, 30, dt);
  if (re) re.scale.y = damp(re.scale.y, ey, 30, dt);

  // selection / error floor ring
  const ring = r.ring.current;
  if (ring) {
    const show = selected || status === "error";
    ring.visible = show;
    if (show) {
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (status === "error") {
        mat.color.set("#E8705C");
        mat.opacity = 0.35 + Math.sin(t * 6) * 0.2;
      } else {
        mat.color.set("#F9B27A");
        mat.opacity = 0.5;
      }
    }
  }
}
