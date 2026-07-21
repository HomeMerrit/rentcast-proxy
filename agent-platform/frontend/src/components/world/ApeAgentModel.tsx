"use client";
import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { patternOf, jerseyNumberOf, vestPatternCanvas } from "./kit";
import type { ApeJersey, ApePattern, ApeAccessory } from "./kit";

// kit identity (numbers, patterns, artwork) lives in ./kit so 2D surfaces can
// share it without loading the GLB pipeline; re-exported here for callers.
export { patternOf, jerseyNumberOf };
export type { ApeJersey, ApePattern, ApeAccessory };

/**
 * Loads the locked master character (Blender → GLB). This is the ONE approved
 * asset — the app never rebuilds the ape procedurally. Only root-level transforms
 * and approved animation clips are allowed here.
 */
export type ApeStatus = "idle" | "working" | "thinking" | "waiting" | "completed" | "error";

/** status → approved clip baked into the GLB */
const STATUS_CLIP: Record<ApeStatus, ApeClip> = {
  idle: "Idle",
  working: "WorkingDesk",
  thinking: "Thinking",
  waiting: "Waiting",
  completed: "CompletedNod",
  error: "ErrorLow",
};

export type ApeClip =
  | "Idle" | "Blink" | "Walk" | "Sit" | "Stand" | "WorkingDesk" | "Thinking"
  | "Waiting" | "CompletedNod" | "ErrorLow" | "TurnLeft" | "TurnRight";

/** clips that play once and hold their final pose instead of looping */
const ONE_SHOT: Set<string> = new Set(["Sit", "Stand", "CompletedNod", "ErrorLow", "TurnLeft", "TurnRight"]);

/** kit pattern artwork (from ./kit) wrapped as a three texture */
function vestPatternTexture(pattern: ApePattern, accent: string): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(vestPatternCanvas(pattern, accent));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Vest-sized overlay planes (front + back) carrying the pattern; they sit
 *  between the torso face and the jersey prints. depthWrite off + explicit
 *  renderOrder: near-coplanar transparent planes otherwise z-fight with the
 *  torso while the model rotates (visible as the print flashing). */
function vestPatternMesh(kind: "chest" | "back", pattern: ApePattern, accent: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.34, 0.8),
    new THREE.MeshStandardMaterial({
      map: vestPatternTexture(pattern, accent),
      transparent: true,
      depthWrite: false,
      roughness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -0.5,
    }),
  );
  mesh.renderOrder = 1;
  if (kind === "back") {
    mesh.rotation.y = Math.PI;
    mesh.position.set(0, -0.72, -0.12);
  } else {
    mesh.position.set(0, -0.62, 0.12);
  }
  return mesh;
}

/** Prints the kit onto a transparent canvas: chest = mini ape crest + squad
 *  label; back = the big number. White with a soft dark edge so it reads on
 *  any accent color. */
function jerseyTexture(kind: "chest" | "back", jersey: ApeJersey): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 512;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 512);
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "rgba(30,27,24,0.35)";
  ctx.lineWidth = 10;
  ctx.textAlign = "center";
  if (kind === "back") {
    ctx.font = "800 300px ui-sans-serif, system-ui, sans-serif";
    const n = String(jersey.number).padStart(2, "0");
    ctx.strokeText(n, 256, 360);
    ctx.fillText(n, 256, 360);
    if (jersey.label) {
      ctx.font = "700 64px ui-sans-serif, system-ui, sans-serif";
      ctx.strokeText(jersey.label, 256, 468);
      ctx.fillText(jersey.label, 256, 468);
    }
  } else {
    // crest: blocky ape head, white on the vest
    const r = (x: number, y: number, w: number, h: number, rad: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, rad);
      ctx.fill();
    };
    r(166, 96, 180, 150, 22);           // head
    r(136, 136, 26, 62, 8);             // ears
    r(350, 136, 26, 62, 8);
    ctx.fillStyle = "rgba(30,27,24,0.8)";
    r(206, 140, 30, 36, 6);             // eyes
    r(276, 140, 30, 36, 6);
    ctx.fillStyle = "#FFFFFF";
    r(206, 196, 100, 34, 10);           // muzzle band
    ctx.font = "800 96px ui-sans-serif, system-ui, sans-serif";
    const n = String(jersey.number).padStart(2, "0");
    ctx.strokeText(n, 256, 370);
    ctx.fillText(n, 256, 370);
    if (jersey.label) {
      ctx.font = "700 52px ui-sans-serif, system-ui, sans-serif";
      ctx.strokeText(jersey.label, 256, 448);
      ctx.fillText(jersey.label, 256, 448);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function jerseyMesh(kind: "chest" | "back", jersey: ApeJersey): THREE.Mesh {
  const size = kind === "back" ? 0.72 : 0.45;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      map: jerseyTexture(kind, jersey),
      transparent: true,
      depthWrite: false,
      roughness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  mesh.renderOrder = 2;
  // sockets sit 0.1 INSIDE the torso block (±0.52 deep) at neck height —
  // offset the print onto the actual torso face, clear of the muzzle overhang
  // and clear of the pattern overlay so neither ever depth-fights it
  if (kind === "back") {
    mesh.rotation.y = Math.PI;
    mesh.position.set(0, -0.7, -0.14);
  } else {
    mesh.position.set(0, -0.58, 0.14);
  }
  return mesh;
}

/** Growth-earned accessories built from primitives, blocky to match the
 *  mascot; no locked geometry is touched. Anchored to the character root at
 *  the head's rest coordinates (head block y 1.18–2.76, ±0.96 × ±0.61; ears
 *  out to ±1.31): the baked head-socket's animated basis is distorted by the
 *  clip bake, and — like StatusFx — a root anchor reads clean on every
 *  approved clip since the head stays near rest. */
function accessoryGroup(kind: ApeAccessory, accent: string | null): THREE.Group {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (kind === "crown") {
    const gold = new THREE.MeshStandardMaterial({ color: "#F2C14E", metalness: 0.65, roughness: 0.3 });
    const gem = new THREE.MeshStandardMaterial({ color: accent ?? "#E0484F", roughness: 0.35 });
    // small square band perched on the big square head (top face at y 2.76)
    box(1.0, 0.22, 0.1, gold, 0, 2.88, 0.45);
    box(1.0, 0.22, 0.1, gold, 0, 2.88, -0.45);
    box(0.1, 0.22, 0.8, gold, 0.45, 2.88, 0);
    box(0.1, 0.22, 0.8, gold, -0.45, 2.88, 0);
    for (const [x, z] of [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]] as const)
      box(0.14, 0.28, 0.14, gold, x, 3.08, z);
    box(0.14, 0.14, 0.06, gem, 0, 2.88, 0.51);
  } else {
    const shell = new THREE.MeshStandardMaterial({ color: "#2A2622", roughness: 0.65 });
    const pad = new THREE.MeshStandardMaterial({ color: accent ?? "#F58220", roughness: 0.5 });
    // band over the head down to cups over the ear blocks (x 0.86–1.31, y 1.63–2.25)
    box(2.9, 0.16, 0.34, shell, 0, 2.88, 0);
    box(0.16, 0.95, 0.34, shell, 1.42, 2.38, 0);
    box(0.16, 0.95, 0.34, shell, -1.42, 2.38, 0);
    box(0.24, 0.6, 0.6, pad, 1.47, 1.94, 0);
    box(0.24, 0.6, 0.6, pad, -1.47, 1.94, 0);
    // mic boom angled from the left cup toward the muzzle
    const boom = box(0.07, 0.07, 0.85, shell, -1.27, 1.72, 0.56);
    boom.lookAt(-1.05, 1.5, 0.95);
    box(0.16, 0.12, 0.12, pad, -1.05, 1.5, 0.95);
  }
  return g;
}

type Props = ThreeElements["group"] & {
  status?: ApeStatus;
  /** explicit clip override (dev/preview); takes precedence over status */
  clip?: ApeClip | null;
  /** approved material variant: tints ONLY the torso block (agent "vest").
   *  Fur stays brand orange; geometry untouched. */
  accent?: string | null;
  /** kit printed on the vest via SOCKET_CHEST / SOCKET_BACK accessories */
  jersey?: ApeJersey | null;
  /** kit pattern trait drawn in shades of the accent (requires accent) */
  pattern?: ApePattern | null;
  /** growth-earned gear attached to baked head sockets */
  accessories?: ApeAccessory[] | null;
};

export function ApeAgentModel({
  status = "idle", clip = null, accent = null, jersey = null, pattern = null, accessories = null, ...props
}: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/models/ape-agent-master.glb");
  // depend on the kit's VALUES, not object identity — callers pass literals
  const jerseyNumber = jersey?.number ?? null;
  const jerseyLabel = jersey?.label ?? null;
  const accessoryKey = accessories?.join(",") ?? "";
  // per-instance skeleton clone so many agents can animate independently
  const instance = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false; // skinned bounds don't track bones
        // kit mode: the torso's "body" slot takes the agent accent (vest) and
        // its "legs" slot goes brand dark-brown so the legs read as fur, not
        // kit. The plain mascot (no accent) stays locked all-orange. The torso
        // is multi-primitive, so match by material + owning node, not mesh name.
        if (accent) {
          const src = mesh.material as THREE.MeshStandardMaterial;
          const onTorso = o.name.startsWith("TORSO") || o.parent?.name === "TORSO";
          if (src.name === "legs") {
            const m = src.clone();
            m.color = new THREE.Color("#B85712");
            mesh.material = m;
          } else if (src.name === "body" && onTorso) {
            const m = src.clone();
            m.color = new THREE.Color(accent);
            mesh.material = m;
          }
        }
      }
    });
    if (accent && pattern) {
      c.getObjectByName("SOCKET_CHEST")?.add(vestPatternMesh("chest", pattern, accent));
      c.getObjectByName("SOCKET_BACK")?.add(vestPatternMesh("back", pattern, accent));
    }
    if (jerseyNumber !== null) {
      const kit = { number: jerseyNumber, label: jerseyLabel ?? undefined };
      c.getObjectByName("SOCKET_CHEST")?.add(jerseyMesh("chest", kit));
      c.getObjectByName("SOCKET_BACK")?.add(jerseyMesh("back", kit));
    }
    if (accessoryKey) {
      for (const kind of accessoryKey.split(",") as ApeAccessory[])
        c.add(accessoryGroup(kind, accent));
    }
    return c;
  }, [scene, accent, jerseyNumber, jerseyLabel, pattern, accessoryKey]);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const name = clip ?? STATUS_CLIP[status];
    const action = actions[name];
    if (!action) return;
    if (ONE_SHOT.has(name)) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    action.reset().fadeIn(0.25).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [status, clip, actions]);

  return (
    <group ref={group} {...props}>
      <primitive object={instance} />
    </group>
  );
}

useGLTF.preload("/models/ape-agent-master.glb");
