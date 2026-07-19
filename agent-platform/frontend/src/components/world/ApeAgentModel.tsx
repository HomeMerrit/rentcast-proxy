"use client";
import { useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";

/**
 * Loads the locked master character (Blender → GLB). This is the ONE approved
 * asset — the app never rebuilds the ape procedurally. Only root-level transforms
 * are allowed here (position / rotation / uniform scale / visibility).
 */
export function ApeAgentModel(props: ThreeElements["group"]) {
  const { scene } = useGLTF("/models/ape-agent-master.glb");
  return (
    <group {...props}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/ape-agent-master.glb");
