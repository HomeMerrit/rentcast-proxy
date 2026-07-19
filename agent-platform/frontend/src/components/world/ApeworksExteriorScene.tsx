"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { EffectComposer, N8AO, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { ApeAgentGlb } from "./ApeAgentGlb";

const EXTERIOR_GLB = "/models/apeworks-exterior.glb";

/** Static exterior shell (Blender owns the look; R3F only places it). */
function ExteriorShell() {
  const { scene } = useGLTF(EXTERIOR_GLB);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      // skyline backdrop shouldn't cast long dusk shadows across the plaza,
      // and the floating drone/crate would smear soft blobs on the facade
      mesh.castShadow =
        !o.name.startsWith("SKY_") && !o.name.startsWith("DRONE_") && !o.name.startsWith("CRATE");
      mesh.receiveShadow = true;
    }
  });
  return <primitive object={scene} />;
}

/** Dusk light rig tuned to the approved comp: low warm sun, cool sky fill. */
function ExteriorLighting() {
  return (
    <>
      <ambientLight intensity={0.32} color="#9fa8c4" />
      {/* low sunset key from the left */}
      <directionalLight
        position={[-24, 10, 22]}
        intensity={2.1}
        color="#ffb27a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
      {/* cool sky fill + back rim */}
      <directionalLight position={[8, 26, 22]} intensity={0.55} color="#aebbdd" />
      <directionalLight position={[24, 14, -10]} intensity={0.45} color="#c3cde4" />
      {/* warm practicals: entrance portal, HQ sign, status board */}
      <pointLight position={[0.8, 3.2, 8.2]} intensity={1.4} color="#FF9A3C" distance={12} />
      <pointLight position={[7.6, 2.2, 11.5]} intensity={0.8} color="#FFB45C" distance={8} />
      <pointLight position={[-11.2, 3.0, 9.6]} intensity={0.6} color="#FFB45C" distance={8} />
    </>
  );
}

/** Clickable entrance portal hotspot — invisible hit box over the muzzle
 *  doorway; hovering lifts the glow, clicking enters the HQ. */
function EntrancePortal({ onEnter }: { onEnter: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={[0.8, 2.65, 6.35]}>
      <mesh
        visible={false}
        onClick={(e) => { e.stopPropagation(); onEnter(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <boxGeometry args={[3.5, 4.2, 0.6]} />
      </mesh>
      {hovered && (
        <mesh position={[0, 0, 0.14]}>
          <planeGeometry args={[3.1, 3.5]} />
          <meshBasicMaterial color="#FF9A3C" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** duration of the door fly-through; pages time their cover fade against it */
export const ENTER_FLIGHT_MS = 1600;
const FLIGHT_END_POS = new THREE.Vector3(0.8, 2.7, 7.6); // just outside the muzzle door
const FLIGHT_END_TGT = new THREE.Vector3(0.8, 2.5, 5.6); // looking through it

/** Walks the camera up to the front door: eases from wherever the user left
 *  the orbit down to the doorway, then hands off (the page fades and switches
 *  to the interior). Purely a camera move — the world itself is untouched. */
function EntranceFlight({ active, onDone }: { active: boolean; onDone: () => void }) {
  const { camera, controls } = useThree();
  const flight = useRef<{ t: number; pos: THREE.Vector3; tgt: THREE.Vector3; done: boolean } | null>(null);

  useEffect(() => {
    if (!active) flight.current = null;
  }, [active]);

  useFrame((_, dt) => {
    if (!active) return;
    const orbit = controls as unknown as { target: THREE.Vector3; enabled: boolean } | null;
    if (!flight.current) {
      flight.current = {
        t: 0,
        pos: camera.position.clone(),
        tgt: (orbit?.target ?? new THREE.Vector3(1.5, 6.5, 0)).clone(),
        done: false,
      };
    }
    const f = flight.current;
    if (f.done) return;
    f.t = Math.min(1, f.t + (dt * 1000) / ENTER_FLIGHT_MS);
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - Math.pow(-2 * f.t + 2, 3) / 2; // easeInOutCubic
    camera.position.lerpVectors(f.pos, FLIGHT_END_POS, e);
    const tgt = new THREE.Vector3().lerpVectors(f.tgt, FLIGHT_END_TGT, e);
    if (orbit) orbit.target.copy(tgt);
    camera.lookAt(tgt);
    if (f.t >= 1) {
      f.done = true;
      onDone();
    }
  });
  return null;
}

/** The APE AGENTS HQ exterior — the building is the mascot. A greeter ape
 *  waits at the entrance (AGENT_SLOT_DOOR in the GLB). */
export function ApeworksExteriorScene({
  onEnterHq,
  hero = false,
  entering = false,
  onEntered,
}: {
  onEnterHq?: () => void;
  hero?: boolean;
  /** when true, the camera flies to the front door, then onEntered fires */
  entering?: boolean;
  onEntered?: () => void;
} = {}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ position: [-14, 8.5, 36], fov: 38, near: 0.5, far: 220 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.92;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.background = new THREE.Color("#2C3550");
        scene.fog = new THREE.Fog("#2C3550", 60, 130);
      }}
    >
      <ExteriorLighting />
      {onEntered && <EntranceFlight active={entering} onDone={onEntered} />}
      <Suspense fallback={null}>
        <ExteriorShell />
        {onEnterHq && <EntrancePortal onEnter={onEnterHq} />}
        {/* greeter at the door, matching AGENT_SLOT_DOOR in the GLB */}
        <ApeAgentGlb
          id="greeter"
          status="waiting"
          position={[3.2, 0.75, 6.7]}
          rotation={[0, -0.3, 0]}
          scale={0.85}
        />
      </Suspense>

      <EffectComposer enableNormalPass={false}>
        <N8AO aoRadius={0.8} intensity={1.6} distanceFalloff={1.2} quality="medium" />
        <Bloom intensity={0.55} luminanceThreshold={1.0} luminanceSmoothing={0.3} mipmapBlur />
        <Vignette offset={0.26} darkness={0.55} eskil={false} />
      </EffectComposer>

      {/* hero mode (embedded in a scrolling page): no zoom/pan so the wheel
          keeps scrolling the page; a gentle nudgeable orbit stays available */}
      <OrbitControls
        target={[1.5, 6.5, 0]}
        maxPolarAngle={Math.PI / 2 - 0.03}
        minPolarAngle={hero ? Math.PI / 2 - 0.6 : 0}
        minAzimuthAngle={hero ? -0.9 : -Infinity}
        maxAzimuthAngle={hero ? 0.6 : Infinity}
        enableZoom={!hero && !entering}
        enablePan={!hero && !entering}
        enableRotate={!entering}
        minDistance={entering ? 0.1 : 10}
        enabled={!entering}
        maxDistance={70}
        enableDamping
        makeDefault
      />
    </Canvas>
  );
}

useGLTF.preload(EXTERIOR_GLB);
