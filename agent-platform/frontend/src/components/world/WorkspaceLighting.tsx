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
      <ambientLight intensity={0.34} color="#fff3e2" />

      {/* broad warm ceiling area light */}
      <rectAreaLight ref={ceil} position={[0, H - 0.4, 0]} intensity={2.6} width={10} height={7} color="#ffedd6" />

      {/* one shadow-casting key from above-front — soft, sun-warm */}
      <directionalLight
        position={[5, H + 3, 6]}
        intensity={1.7}
        color="#ffe3c0"
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
        shadow-radius={7}
      />

      {/* warm daylight streaming from the window side */}
      <directionalLight position={[-8, 4, 2]} intensity={1.6} color="#ffeecf" />
      {/* soft neutral fill */}
      <directionalLight position={[4, 2.5, 4]} intensity={0.75} color="#fff8ef" />
      {/* orange bounce accents: logo wall + right cove panel + mezzanine lamp */}
      <pointLight position={[-2.2, 3.0, -room.size.depth / 2 + 0.9]} intensity={0.7} color="#FF9A3C" distance={8} />
      <pointLight position={[room.size.width / 2 - 0.8, 2.9, 1.4]} intensity={0.6} color="#FFB45C" distance={7} />
      <pointLight position={[4.6, 3.6, -3.0]} intensity={0.8} color="#FF9A3C" distance={5} />
    </>
  );
}
