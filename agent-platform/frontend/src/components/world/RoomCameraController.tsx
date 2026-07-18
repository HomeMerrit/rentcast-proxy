"use client";
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface CamShot { position: [number, number, number]; target: [number, number, number] }

/** Controlled, damped camera transitions — no orbit in the product experience.
 *  Eases between the room overview and a focused agent/workstation. */
export function RoomCameraController({ overview, focus, fov = 33 }: { overview: CamShot; focus?: CamShot | null; fov?: number }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...overview.target));

  useEffect(() => {
    camera.position.set(...overview.position);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      camera.updateProjectionMatrix();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const dst = focus ?? overview;
    const l = 3.5;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, dst.position[0], l, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, dst.position[1], l, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, dst.position[2], l, dt);
    target.current.x = THREE.MathUtils.damp(target.current.x, dst.target[0], l, dt);
    target.current.y = THREE.MathUtils.damp(target.current.y, dst.target[1], l, dt);
    target.current.z = THREE.MathUtils.damp(target.current.z, dst.target[2], l, dt);
    camera.lookAt(target.current);
  });

  return null;
}
