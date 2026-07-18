"use client";
import { useEffect, useRef } from "react";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import * as THREE from "three";
import type { RoomConfig, WorkspaceQuality } from "./WorkspaceRoom.types";

/** Premium soft-light rig: broad warm ceiling area light + window light + one
 *  shadow-casting key + gentle fill and orange accents. */
export function WorkspaceLighting({ room, quality = "high" }: { room: RoomConfig; quality?: WorkspaceQuality }) {
  const ceil = useRef<THREE.RectAreaLight>(null);
  const H = room.size.height;
  const mapSize = quality === "low" ? 512 : quality === "medium" ? 1024 : 2048;

  useEffect(() => {
    RectAreaLightUniformsLib.init();
    ceil.current?.lookAt(0, 0, 0);
  }, []);

  return (
    <>
      <ambientLight intensity={0.65} />

      {/* broad warm ceiling area light */}
      <rectAreaLight ref={ceil} position={[0, H - 0.4, 0]} intensity={3.4} width={9} height={6} color="#fff1df" />

      {/* one shadow-casting key from above-front */}
      <directionalLight
        position={[5, H + 3, 6]}
        intensity={1.4}
        color="#ffe9cf"
        castShadow
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />

      {/* warm daylight from the window side */}
      <directionalLight position={[-8, 4, 2]} intensity={2.0} color="#fff2e0" />
      {/* soft fill */}
      <directionalLight position={[4, 2.5, 4]} intensity={1.1} color="#ffffff" />
      {/* orange accent */}
      <pointLight position={[0, 3.2, -room.size.depth / 2 + 0.6]} intensity={0.4} color="#FF9A3C" distance={9} />
    </>
  );
}
