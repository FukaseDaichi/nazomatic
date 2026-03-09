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

// Gold / Silver / Bronze color scheme
const SLOT_LAYOUT: Record<
  SceneSlot,
  {
    x: number;
    width: number;
    height: number;
    color: string;   // bright/light color for text & rings
    accent: string;  // mid-tone for materials
    emissive: string; // emissive color for the column body
    rimColor: string; // rim highlight color
  }
> = {
  1: {
    x: 0,
    width: 3.0,
    height: 3.35,
    color: "#FDE68A",
    accent: "#F59E0B",
    emissive: "#B45309",
    rimColor: "#FCD34D",
  },
  2: {
    x: -4.6,
    width: 2.65,
    height: 2.15,
    color: "#E2E8F0",
    accent: "#94A3B8",
    emissive: "#334155",
    rimColor: "#CBD5E1",
  },
  3: {
    x: 4.6,
    width: 2.65,
    height: 1.75,
    color: "#FED7AA",
    accent: "#F97316",
    emissive: "#C2410C",
    rimColor: "#FDBA74",
  },
};

// --- Crown for 1st place ---
function CrownGlyph({ color }: { color: string }) {
  const gemRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (gemRef.current) {
      gemRef.current.rotation.y = state.clock.elapsedTime * 0.9;
      const mat = gemRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 2.8 + Math.sin(state.clock.elapsedTime * 2.5) * 0.8;
    }
  });
  return (
    <group>
      {/* Base ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.86, 0.07, 20, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.6}
          metalness={1}
          roughness={0.05}
        />
      </mesh>
      {/* Spikes */}
      {[-0.56, -0.17, 0.17, 0.56].map((x, i) => (
        <mesh
          key={x}
          position={[x, 0.43 + (i % 2 === 0 ? 0.09 : 0), 0]}
          rotation={[0, 0, i % 2 === 0 ? 0.14 : -0.14]}
        >
          <coneGeometry args={[0.1, 0.56, 6]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2.4}
            metalness={0.95}
            roughness={0.05}
          />
        </mesh>
      ))}
      {/* Center gem */}
      <mesh ref={gemRef} position={[0, 0.72, 0]}>
        <icosahedronGeometry args={[0.18, 1]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive={color}
          emissiveIntensity={3.0}
          metalness={1}
          roughness={0.02}
        />
      </mesh>
      {/* Side gems */}
      {[-0.56, 0.56].map((x) => (
        <mesh key={x} position={[x, 0.6, 0]}>
          <icosahedronGeometry args={[0.1, 1]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive={color}
            emissiveIntensity={2.8}
            metalness={1}
            roughness={0.02}
          />
        </mesh>
      ))}
    </group>
  );
}

// --- Diamond marker for 2nd / 3rd place ---
function DiamondMarker({ color, scale = 1 }: { color: string; scale?: number }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.7;
      coreRef.current.rotation.y += delta * 1.05;
    }
    if (ring1Ref.current) ring1Ref.current.rotation.z += delta * 0.65;
    if (ring2Ref.current) ring2Ref.current.rotation.z -= delta * 0.4;
  });

  return (
    <group scale={scale}>
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.66, 0.044, 20, 72]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.9}
          metalness={1}
          roughness={0.05}
        />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[0.5, 0.028, 16, 60]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          metalness={1}
          roughness={0.08}
          transparent
          opacity={0.65}
        />
      </mesh>
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.26, 0]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive={color}
          emissiveIntensity={1.5}
          metalness={0.95}
          roughness={0.05}
        />
      </mesh>
    </group>
  );
}

// --- Avatar with photo ---
function IconPortrait3D({ src, color }: { src: string; color: string }) {
  const texture = useTexture(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (
    <group>
      {/* Outer glow ring */}
      <mesh>
        <ringGeometry args={[1.0, 1.22, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.8}
          metalness={1}
          roughness={0.04}
        />
      </mesh>
      {/* Photo */}
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.98, 64]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

// --- Avatar with monogram ---
function MonogramPortrait3D({ name, color }: { name: string; color: string }) {
  return (
    <group>
      {/* Disc background */}
      <mesh>
        <circleGeometry args={[0.94, 64]} />
        <meshStandardMaterial
          color="#06080F"
          emissive={color}
          emissiveIntensity={0.32}
          metalness={0.92}
          roughness={0.1}
        />
      </mesh>
      {/* Ring */}
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[0.96, 1.2, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.9}
          metalness={1}
          roughness={0.04}
        />
      </mesh>
      <Text
        position={[0, 0, 0.06]}
        fontSize={0.46}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {getPartyParticipantMonogram(name)}
      </Text>
    </group>
  );
}

// --- Upward light beam for 1st place ---
function GlowBeam({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.065 + Math.sin(state.clock.elapsedTime * 1.3) * 0.03;
  });
  // Tip placed near column top, cone opens upward
  return (
    <mesh ref={ref} position={[0, 7.8, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[2.2, 9.5, 32, 1, true]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.7}
        transparent
        opacity={0.08}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// --- Single podium column ---
function PodiumColumn({
  slot,
  entry,
}: {
  slot: SceneSlot;
  entry?: PartyPodiumEntry;
}) {
  const layout = SLOT_LAYOUT[slot];
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const halo1Ref = useRef<THREE.Mesh>(null);
  const halo2Ref = useRef<THREE.Mesh>(null);

  const score = entry ? String(entry.participant.score) : "--";
  const name = entry ? entry.participant.name : "OPEN SLOT";
  const kind = entry
    ? entry.participant.kind === "group"
      ? "GROUP"
      : "PERSON"
    : "WAITING";

  useFrame((state, delta) => {
    if (matRef.current) {
      matRef.current.emissiveIntensity =
        slot === 1
          ? 0.44 + Math.sin(state.clock.elapsedTime * 1.45) * 0.11
          : 0.18 + Math.sin(state.clock.elapsedTime * 1.1 + slot) * 0.055;
    }
    if (halo1Ref.current)
      halo1Ref.current.rotation.z += delta * (0.32 + slot * 0.07);
    if (halo2Ref.current)
      halo2Ref.current.rotation.z -= delta * (0.2 + slot * 0.05);
  });

  const faceZ = layout.width / 2 + 0.06;
  const avatarY = layout.height + (slot === 1 ? 1.38 : 1.12);
  const ornamentY = layout.height + (slot === 1 ? 2.78 : 2.38);
  const avatarScale = slot === 1 ? 1.0 : 0.84;

  return (
    <group position={[layout.x, 0, 0]}>
      {/* ── Column body ── */}
      <mesh position={[0, layout.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[layout.width, layout.height, layout.width]} />
        <meshPhysicalMaterial
          ref={matRef}
          color="#06080E"
          metalness={0.97}
          roughness={0.11}
          clearcoat={1}
          clearcoatRoughness={0.05}
          emissive={layout.emissive}
          emissiveIntensity={slot === 1 ? 0.44 : 0.18}
        />
      </mesh>

      {/* ── Glowing vertical edge lines (left / right) ── */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * (layout.width / 2 + 0.014), layout.height / 2, 0]}
        >
          <boxGeometry
            args={[0.028, layout.height * 0.9, layout.width * 0.88]}
          />
          <meshStandardMaterial
            color={layout.color}
            emissive={layout.color}
            emissiveIntensity={1.3}
            metalness={1}
            roughness={0.04}
          />
        </mesh>
      ))}
      {/* Top edge glow */}
      <mesh position={[0, layout.height + 0.014, 0]}>
        <boxGeometry
          args={[layout.width * 0.88, 0.028, layout.width * 0.88]}
        />
        <meshStandardMaterial
          color={layout.color}
          emissive={layout.color}
          emissiveIntensity={1.5}
          metalness={1}
          roughness={0.04}
        />
      </mesh>

      {/* ── Front face panels ── */}
      {/* Rank badge */}
      <group position={[0, layout.height * 0.91, faceZ]}>
        <mesh>
          <planeGeometry args={[1.1, 0.38]} />
          <meshStandardMaterial
            color={layout.accent}
            emissive={layout.accent}
            emissiveIntensity={0.52}
            transparent
            opacity={0.55}
          />
        </mesh>
        <Text
          position={[0, 0, 0.02]}
          fontSize={0.18}
          color={layout.color}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.14}
        >
          {`RANK  ${slot}`}
        </Text>
      </group>

      {/* Name panel */}
      <group position={[0, layout.height * 0.65, faceZ]}>
        <mesh>
          <planeGeometry args={[layout.width * 0.88, slot === 1 ? 0.74 : 0.62]} />
          <meshStandardMaterial
            color="#050710"
            emissive={layout.emissive}
            emissiveIntensity={0.2}
            transparent
            opacity={0.78}
          />
        </mesh>
        <Text
          position={[0, 0, 0.02]}
          fontSize={slot === 1 ? 0.27 : 0.22}
          maxWidth={layout.width * 0.82}
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
          overflowWrap="break-word"
        >
          {name}
        </Text>
      </group>

      {/* Score panel */}
      <group position={[0, layout.height * 0.38, faceZ]}>
        <mesh>
          <planeGeometry
            args={[layout.width * 0.86, slot === 1 ? 1.18 : 0.98]}
          />
          <meshStandardMaterial
            color="#040608"
            emissive={layout.accent}
            emissiveIntensity={0.3}
            transparent
            opacity={0.84}
          />
        </mesh>
        <Text
          position={[0, slot === 1 ? 0.2 : 0.15, 0.02]}
          fontSize={slot === 1 ? 0.68 : 0.54}
          color={layout.color}
          anchorX="center"
          anchorY="middle"
        >
          {score}
        </Text>
        <Text
          position={[0, slot === 1 ? -0.3 : -0.23, 0.02]}
          fontSize={0.13}
          color={layout.rimColor}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.22}
        >
          POINT
        </Text>
      </group>

      {/* Kind label */}
      <Text
        position={[0, layout.height * 0.1, faceZ + 0.02]}
        fontSize={0.13}
        color="#4B5563"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.14}
      >
        {kind}
      </Text>

      {/* ── Cap platform ── */}
      <mesh position={[0, layout.height + 0.09, 0]} castShadow>
        <cylinderGeometry
          args={[layout.width * 0.6, layout.width * 0.72, 0.18, 56]}
        />
        <meshStandardMaterial
          color="#0C0F1C"
          emissive={layout.color}
          emissiveIntensity={0.22}
          metalness={0.9}
          roughness={0.14}
        />
      </mesh>

      {/* ── Halo ring 1 (co-rotating) ── */}
      <mesh
        ref={halo1Ref}
        position={[0, layout.height + 0.22, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[layout.width * 0.46, 0.046, 24, 120]} />
        <meshStandardMaterial
          color={layout.color}
          emissive={layout.color}
          emissiveIntensity={1.9}
          metalness={1}
          roughness={0.04}
        />
      </mesh>

      {/* ── Halo ring 2 (counter-rotating, larger) ── */}
      <mesh
        ref={halo2Ref}
        position={[0, layout.height + 0.22, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[layout.width * 0.6, 0.026, 16, 100]} />
        <meshStandardMaterial
          color={layout.color}
          emissive={layout.color}
          emissiveIntensity={0.95}
          metalness={1}
          roughness={0.07}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* ── Floating avatar above column ── */}
      <Float
        speed={slot === 1 ? 2.2 : 1.7}
        rotationIntensity={0.1}
        floatIntensity={slot === 1 ? 0.42 : 0.3}
        position={[0, avatarY, 0]}
      >
        <group scale={avatarScale}>
          {entry?.participant.iconDataUrl ? (
            <IconPortrait3D
              src={entry.participant.iconDataUrl}
              color={layout.color}
            />
          ) : (
            <MonogramPortrait3D
              name={entry?.participant.name ?? `#${slot}`}
              color={layout.color}
            />
          )}
        </group>
      </Float>

      {/* ── Per-column sparkles ── */}
      <Sparkles
        position={[0, avatarY + 0.4, 0]}
        count={slot === 1 ? 44 : 26}
        scale={[layout.width * 1.5, 2.4, layout.width * 1.5]}
        size={slot === 1 ? 3.8 : 2.6}
        speed={0.22}
        opacity={slot === 1 ? 0.68 : 0.44}
        color={layout.color}
      />

      {/* ── Gold beam for 1st place ── */}
      {slot === 1 && <GlowBeam color={layout.color} />}

      {/* ── Crown / Diamond above avatar ── */}
      <Float
        speed={slot === 1 ? 2.6 : 2.0}
        rotationIntensity={slot === 1 ? 0.28 : 0.22}
        floatIntensity={slot === 1 ? 0.48 : 0.32}
        position={[0, ornamentY, 0]}
      >
        {slot === 1 ? (
          <CrownGlyph color={layout.color} />
        ) : (
          <DiamondMarker color={layout.color} scale={0.84} />
        )}
      </Float>
    </group>
  );
}

// --- Scene root ---
function PodiumSceneCore({ entries }: { entries: PartyPodiumEntry[] }) {
  const rootRef = useRef<THREE.Group>(null);
  const entryBySlot = useMemo(
    () => new Map(entries.map((e) => [e.slot, e])),
    [entries],
  );

  useFrame((state) => {
    if (!rootRef.current) return;
    rootRef.current.rotation.y = THREE.MathUtils.lerp(
      rootRef.current.rotation.y,
      state.pointer.x * 0.16,
      0.05,
    );
    rootRef.current.rotation.x = THREE.MathUtils.lerp(
      rootRef.current.rotation.x,
      state.pointer.y * 0.045,
      0.04,
    );
    // -3.0 はベースオフセット。useFrame が position.y を毎フレーム上書きするため
    // JSX の position prop ではなくここで設定する。
    rootRef.current.position.y =
      -3.0 + Math.sin(state.clock.elapsedTime * 0.45) * 0.07;
  });

  return (
    <group ref={rootRef}>
      {/* Background sparkles */}
      <Sparkles
        count={160}
        scale={[22, 10, 12]}
        size={3.4}
        speed={0.24}
        opacity={0.4}
        color="#E9D5FF"
      />

      {/* Floor glow rings */}
      {[9.4, 7.5, 5.8].map((r, i) => (
        <mesh key={r} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r, r + 0.16, 80]} />
          <meshBasicMaterial
            color={
              i === 0 ? "#4C1D95" : i === 1 ? "#5B21B6" : "#7C3AED"
            }
            transparent
            opacity={0.24 - i * 0.05}
          />
        </mesh>
      ))}

      {/* Base platform */}
      <mesh position={[0, -0.7, 0]} receiveShadow>
        <cylinderGeometry args={[12.2, 13.4, 1.32, 80]} />
        <meshStandardMaterial
          color="#060810"
          emissive="#180B2E"
          emissiveIntensity={0.22}
          metalness={0.94}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <cylinderGeometry args={[11.6, 12.2, 0.22, 80]} />
        <meshStandardMaterial
          color="#0E1020"
          emissive="#3B1C78"
          emissiveIntensity={0.18}
          metalness={0.92}
          roughness={0.18}
        />
      </mesh>

      {/* Grid */}
      <gridHelper
        args={[28, 24, new THREE.Color("#c084fc"), new THREE.Color("#1a0f35")]}
        position={[0, 0.13, 0]}
      />

      {/* Columns — render 2 & 3 first so 1 is drawn on top */}
      <PodiumColumn slot={2} entry={entryBySlot.get(2)} />
      <PodiumColumn slot={3} entry={entryBySlot.get(3)} />
      <PodiumColumn slot={1} entry={entryBySlot.get(1)} />
    </group>
  );
}

export default function PartyPodiumScene({
  entries,
}: {
  entries: PartyPodiumEntry[];
}) {
  return (
    <div className="h-[240px] w-full lg:h-[265px]">
      <Canvas
        dpr={[1, 2]}
        shadows
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 5.5, 24.5], fov: 50 }}
      >
        <color attach="background" args={["#020308"]} />
        <fog attach="fog" args={["#020308", 22, 36]} />

        <ambientLight intensity={0.9} />
        <hemisphereLight
          intensity={0.5}
          color={"#ffffff"}
          groundColor={"#0f172a"}
        />
        {/* Main directional */}
        <directionalLight
          position={[8, 14, 8]}
          intensity={2.0}
          color={"#F5F3FF"}
          castShadow
        />
        {/* Per-rank colored point lights */}
        <pointLight position={[0, 7, 5]} intensity={30} color={"#FCD34D"} />
        <pointLight
          position={[-4.6, 5.5, 4]}
          intensity={18}
          color={"#CBD5E1"}
        />
        <pointLight
          position={[4.6, 5.5, 4]}
          intensity={18}
          color={"#FED7AA"}
        />
        {/* Top spotlight */}
        <spotLight
          position={[0, 18, 10]}
          angle={0.3}
          penumbra={0.8}
          intensity={55}
          color={"#E9D5FF"}
          castShadow
        />

        <PodiumSceneCore entries={entries} />

        <OrbitControls
          enablePan={false}
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minDistance={14}
          maxDistance={32}
          minPolarAngle={1.0}
          maxPolarAngle={1.5}
          minAzimuthAngle={-0.55}
          maxAzimuthAngle={0.55}
          autoRotate
          autoRotateSpeed={0.38}
        />
      </Canvas>
    </div>
  );
}
