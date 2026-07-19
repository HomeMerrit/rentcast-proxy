"use client";
import { useEffect, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";

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

type Props = ThreeElements["group"] & {
  status?: ApeStatus;
  /** explicit clip override (dev/preview); takes precedence over status */
  clip?: ApeClip | null;
};

export function ApeAgentModel({ status = "idle", clip = null, ...props }: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/models/ape-agent-master.glb");
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
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/ape-agent-master.glb");
