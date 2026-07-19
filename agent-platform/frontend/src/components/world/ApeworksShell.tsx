"use client";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * The APEWORKS HQ room environment — Blender-built GLB modeled on the approved
 * headquarters reference. Static architecture + decor only; the app parents
 * interactive workstations and agents at the AGENT_SLOT_* anchors (mirrored in
 * WorkspaceRoom.config).
 */
export function ApeworksShell() {
  const { scene } = useGLTF("/models/apeworks-room.glb");
  const room = useMemo(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return scene;
  }, [scene]);
  return <primitive object={room} />;
}

useGLTF.preload("/models/apeworks-room.glb");
