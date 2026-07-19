"use client";
import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

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

export interface ApeJersey {
  number: number;
  label?: string;
}

/** stable 2-digit squad number per agent id */
export function jerseyNumberOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 99) + 1;
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
      roughness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  // sockets sit 0.1 INSIDE the torso block (±0.52 deep) at neck height —
  // offset the print onto the actual torso face, clear of the muzzle overhang
  if (kind === "back") {
    mesh.rotation.y = Math.PI;
    mesh.position.set(0, -0.7, -0.11);
  } else {
    mesh.position.set(0, -0.58, 0.11);
  }
  return mesh;
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
};

export function ApeAgentModel({ status = "idle", clip = null, accent = null, jersey = null, ...props }: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/models/ape-agent-master.glb");
  // depend on the kit's VALUES, not object identity — callers pass literals
  const jerseyNumber = jersey?.number ?? null;
  const jerseyLabel = jersey?.label ?? null;
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
    if (jerseyNumber !== null) {
      const kit = { number: jerseyNumber, label: jerseyLabel ?? undefined };
      c.getObjectByName("SOCKET_CHEST")?.add(jerseyMesh("chest", kit));
      c.getObjectByName("SOCKET_BACK")?.add(jerseyMesh("back", kit));
    }
    return c;
  }, [scene, accent, jerseyNumber, jerseyLabel]);
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
