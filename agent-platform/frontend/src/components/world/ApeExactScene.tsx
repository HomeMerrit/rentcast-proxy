"use client";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ApeExact } from "./ApeExact";

export type ApeView = "three-quarter" | "front" | "side";

const CAM: Record<ApeView, [number, number, number]> = {
  "three-quarter": [4.6, 2.7, 8.4],
  front: [0, 2.3, 9.4],
  side: [9.4, 2.5, 0.4],
};

/** Bounding box of the locked target volume (floor y=0). */
function BBox() {
  const size: [number, number, number] = [2.45, 3.85, 1.45];
  const geo = new THREE.BoxGeometry(...size);
  const edges = new THREE.EdgesGeometry(geo);
  return (
    <lineSegments position={[0, size[1] / 2, 0.2]} geometry={edges}>
      <lineBasicMaterial color="#2196f3" />
    </lineSegments>
  );
}

export function ApeExactScene({
  view = "three-quarter", wireframe = false, showBBox = false,
}: {
  view?: ApeView; wireframe?: boolean; showBBox?: boolean;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.background = new THREE.Color("#ffffff");
      }}
    >
      {/* fixed ortho three-quarter product camera (keyed so view buttons snap) */}
      <OrthographicCamera key={view} makeDefault position={CAM[view]} zoom={132} near={0.1} far={100} />

      {/* lower ambient + softened key = the reference's deep candy-orange with real form */}
      <ambientLight intensity={0.48} />
      <directionalLight
        position={[-3.4, 7.2, 6.0]} intensity={3.0} color="#fff7ee" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.03} shadow-radius={6}
      >
        <orthographicCamera attach="shadow-camera" args={[-4, 4, 5, -1, 0.5, 24]} />
      </directionalLight>
      <directionalLight position={[4.5, 3.5, 4.5]} intensity={1.05} />
      <directionalLight position={[1.5, 5.5, -4.5]} intensity={1.35} />

      <ApeExact wireframe={wireframe} />
      {showBBox && <BBox />}

      {/* seamless white studio: an invisible shadow-catcher shows ONLY the soft cast
          shadow (shadowMaterial is transparent everywhere else), so the background stays
          pure white with no gray plane. Softness comes from PCFSoft + the key's shadow-radius. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial transparent opacity={0.26} />
      </mesh>

      <OrbitControls target={[0, 1.95, 0.1]} enablePan={false} enableZoom makeDefault />
    </Canvas>
  );
}
