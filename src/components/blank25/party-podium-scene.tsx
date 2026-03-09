"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  OrbitControls,
  Sparkles,
  Text,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { getPartyParticipantMonogram } from "@/components/blank25/party-avatar";
import type { PartyPodiumEntry } from "@/components/blank25/party-podium";

type SceneSlot = 1 | 2 | 3;

const SLOT_LAYOUT: Record<
  SceneSlot,
  {
    x: number;
    width: number;
    height: number;
    color: string;
    accent: string;
  }
> = {
  1: { x: 0, width: 3.3, height: 3.55, color: "#d8b4fe", accent: "#a855f7" },
  2: { x: -4.8, width: 2.8, height: 2.35, color: "#c084fc", accent: "#9333ea" },
  3: { x: 4.8, width: 2.8, height: 1.95, color: "#a855f7", accent: "#7e22ce" },
};

function CrownGlyph({ color }: { color: string }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.92, 0.08, 20, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.8}
          metalness={1}
          roughness={0.12}
        />
      </mesh>
      {[-0.62, -0.2, 0.2, 0.62].map((x, index) => (
        <mesh
          key={x}
          position={[x, 0.42 + (index % 2 === 0 ? 0.04 : 0), 0]}
          rotation={[0, 0, index % 2 === 0 ? 0.12 : -0.12]}
        >
          <coneGeometry args={[0.13, 0.62, 6]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.6}
            metalness={0.95}
            roughness={0.1}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.78, 0]}>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial
          color="#faf5ff"
          emissive="#faf5ff"
          emissiveIntensity={2}
          metalness={1}
          roughness={0.08}
        />
      </mesh>
    </group>
  );
}

function OrbitingMarker({
  color,
  scale = 1,
}: {
  color: string;
  scale?: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.85;
      ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.6) * 0.35;
    }
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.8;
      coreRef.current.rotation.y += delta * 0.95;
    }
  });

  return (
    <group scale={scale}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.055, 20, 72]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          metalness={1}
          roughness={0.08}
        />
      </mesh>
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial
          color="#faf5ff"
          emissive={color}
          emissiveIntensity={1}
          metalness={0.95}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}

function IconPortrait3D({
  src,
  color,
}: {
  src: string;
  color: string;
}) {
  const texture = useTexture(src);
  texture.colorSpace = THREE.SRGBColorSpace;

  return (
    <group>
      <mesh>
        <ringGeometry args={[0.9, 1.12, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.1}
          metalness={1}
          roughness={0.1}
        />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.88, 64]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function MonogramPortrait3D({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <group>
      <mesh>
        <circleGeometry args={[0.9, 64]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive={color}
          emissiveIntensity={0.24}
          metalness={0.86}
          roughness={0.14}
        />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <ringGeometry args={[0.92, 1.14, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.1}
          metalness={1}
          roughness={0.1}
        />
      </mesh>
      <Text
        position={[0, 0, 0.04]}
        fontSize={0.42}
        color="#f5f3ff"
        anchorX="center"
        anchorY="middle"
      >
        {getPartyParticipantMonogram(name)}
      </Text>
    </group>
  );
}

function PodiumColumn({
  slot,
  entry,
}: {
  slot: SceneSlot;
  entry?: PartyPodiumEntry;
}) {
  const layout = SLOT_LAYOUT[slot];
  const columnMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const scoreValue = entry ? String(entry.participant.score) : "--";
  const label = entry ? entry.participant.name : "OPEN SLOT";
  const kindLabel = entry
    ? entry.participant.kind === "group"
      ? "GROUP"
      : "PERSON"
    : "WAITING";

  useFrame((state, delta) => {
    if (columnMaterialRef.current) {
      const pulse =
        slot === 1
          ? 0.52 + Math.sin(state.clock.elapsedTime * 1.5) * 0.12
          : 0.24 + Math.sin(state.clock.elapsedTime * 1.2 + slot) * 0.06;
      columnMaterialRef.current.emissiveIntensity = pulse;
    }

    if (haloRef.current) {
      haloRef.current.rotation.z += delta * (0.32 + slot * 0.08);
    }
  });

  return (
    <group position={[layout.x, 0, 0]}>
      <mesh position={[0, layout.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[layout.width, layout.height, layout.width]} />
        <meshPhysicalMaterial
          ref={columnMaterialRef}
          color="#090b13"
          metalness={0.96}
          roughness={0.14}
          clearcoat={1}
          clearcoatRoughness={0.08}
          emissive={layout.accent}
          emissiveIntensity={slot === 1 ? 0.52 : 0.24}
        />
      </mesh>

      <mesh
        position={[0, layout.height + 0.12, 0]}
        rotation={[0, Math.PI / 4, 0]}
        receiveShadow
      >
        <cylinderGeometry
          args={[layout.width * 0.66, layout.width * 0.78, 0.22, 52]}
        />
        <meshStandardMaterial
          color="#140f25"
          emissive={layout.color}
          emissiveIntensity={0.32}
          metalness={0.85}
          roughness={0.18}
        />
      </mesh>

      <mesh
        ref={haloRef}
        position={[0, layout.height + 0.24, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[layout.width * 0.48, 0.05, 24, 120]} />
        <meshStandardMaterial
          color={layout.color}
          emissive={layout.color}
          emissiveIntensity={1.35}
          metalness={1}
          roughness={0.08}
        />
      </mesh>

      <group position={[0, layout.height * 0.62, layout.width * 0.58]}>
        {entry?.participant.iconDataUrl ? (
          <IconPortrait3D src={entry.participant.iconDataUrl} color={layout.color} />
        ) : (
          <MonogramPortrait3D
            name={entry?.participant.name ?? `#${slot}`}
            color={layout.color}
          />
        )}
      </group>

      <Text
        position={[0, layout.height * 0.12, layout.width * 0.54]}
        fontSize={0.16}
        color="#d8b4fe"
        anchorX="center"
        anchorY="middle"
      >
        #{slot}
      </Text>

      <mesh
        position={[0, layout.height * 0.26, layout.width * 0.58]}
        receiveShadow
      >
        <boxGeometry
          args={[layout.width * 0.92, slot === 1 ? 0.88 : 0.76, 0.18]}
        />
        <meshStandardMaterial
          color="#0d0a15"
          emissive={layout.accent}
          emissiveIntensity={0.42}
          metalness={0.9}
          roughness={0.14}
        />
      </mesh>

      <Text
        position={[0, layout.height * 0.28, layout.width * 0.68]}
        fontSize={slot === 1 ? 0.34 : 0.28}
        maxWidth={layout.width * 1.78}
        color="#f5d0fe"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>

      <Text
        position={[0, layout.height + 0.58, 0]}
        fontSize={slot === 1 ? 0.76 : 0.6}
        color={layout.color}
        anchorX="center"
        anchorY="middle"
      >
        {scoreValue}
      </Text>

      <Text
        position={[0, layout.height + 0.2, 0]}
        fontSize={0.19}
        color="#f5d0fe"
        anchorX="center"
        anchorY="middle"
      >
        {entry ? "POINT" : kindLabel}
      </Text>

      <Float
        speed={slot === 1 ? 2.2 : 1.6}
        rotationIntensity={slot === 1 ? 0.35 : 0.28}
        floatIntensity={slot === 1 ? 0.34 : 0.24}
        position={[0, layout.height + (slot === 1 ? 1.02 : 0.78), 0]}
      >
        {slot === 1 ? (
          <CrownGlyph color={layout.color} />
        ) : (
          <OrbitingMarker color={layout.color} scale={0.92} />
        )}
      </Float>
    </group>
  );
}

function PodiumSceneCore({ entries }: { entries: PartyPodiumEntry[] }) {
  const rootRef = useRef<THREE.Group>(null);
  const entryBySlot = useMemo(
    () => new Map(entries.map((entry) => [entry.slot, entry])),
    [entries],
  );

  useFrame((state) => {
    if (!rootRef.current) return;

    const targetY = state.pointer.x * 0.18;
    const targetX = state.pointer.y * 0.05;
    rootRef.current.rotation.y = THREE.MathUtils.lerp(
      rootRef.current.rotation.y,
      targetY,
      0.05,
    );
    rootRef.current.rotation.x = THREE.MathUtils.lerp(
      rootRef.current.rotation.x,
      targetX,
      0.04,
    );
    rootRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.08;
  });

  return (
    <group ref={rootRef} position={[0, -2.2, 0]}>
      <Sparkles
        count={160}
        scale={[18, 8, 10]}
        size={3.8}
        speed={0.26}
        opacity={0.5}
        color="#e9d5ff"
      />

      <mesh position={[0, -0.72, 0]} receiveShadow>
        <cylinderGeometry args={[12.4, 13.6, 1.35, 80]} />
        <meshStandardMaterial
          color="#07080d"
          emissive="#2a1244"
          emissiveIntensity={0.24}
          metalness={0.92}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[0, 0, 0]} receiveShadow>
        <cylinderGeometry args={[11.8, 12.4, 0.24, 80]} />
        <meshStandardMaterial
          color="#111320"
          emissive="#4c1d95"
          emissiveIntensity={0.16}
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>

      <gridHelper
        args={[28, 24, new THREE.Color("#d8b4fe"), new THREE.Color("#312e81")]}
        position={[0, 0.14, 0]}
      />

      <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8.8, 10.1, 80]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.26} />
      </mesh>

      <PodiumColumn slot={2} entry={entryBySlot.get(2)} />
      <PodiumColumn slot={1} entry={entryBySlot.get(1)} />
      <PodiumColumn slot={3} entry={entryBySlot.get(3)} />
    </group>
  );
}

export default function PartyPodiumScene({
  entries,
}: {
  entries: PartyPodiumEntry[];
}) {
  return (
    <div className="h-[280px] w-full lg:h-[300px]">
      <Canvas
        dpr={[1, 2]}
        shadows
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 5.9, 23.2], fov: 47 }}
      >
        <color attach="background" args={["#020308"]} />
        <fog attach="fog" args={["#020308", 20, 34]} />
        <ambientLight intensity={1.1} />
        <hemisphereLight
          intensity={0.55}
          color={"#ffffff"}
          groundColor={"#0f172a"}
        />
        <directionalLight
          position={[8, 14, 8]}
          intensity={1.9}
          color={"#f5f3ff"}
          castShadow
        />
        <pointLight position={[0, 10, 0]} intensity={32} color={"#c084fc"} />
        <spotLight
          position={[0, 16, 9]}
          angle={0.28}
          penumbra={0.8}
          intensity={52}
          color={"#d8b4fe"}
          castShadow
        />
        <PodiumSceneCore entries={entries} />
        <OrbitControls
          enablePan={false}
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minDistance={14}
          maxDistance={31}
          minPolarAngle={1.02}
          maxPolarAngle={1.48}
          minAzimuthAngle={-0.52}
          maxAzimuthAngle={0.52}
          autoRotate
          autoRotateSpeed={0.4}
        />
      </Canvas>
    </div>
  );
}
