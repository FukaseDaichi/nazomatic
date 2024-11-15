"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Canvas,
  useFrame,
  ThreeElements,
  ThreeEvent,
} from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Play, Pause } from "lucide-react";
import { DICE_COLORS, FaceData } from "./dice-nets";

type DiceProps = ThreeElements["mesh"] & {
  isActive: boolean;
  faceData: Record<number, FaceData>;
};
//角度から回転情報を取得する
const getRotationFromAngle = (angle: number) => {
  return (angle / 90) * (Math.PI / 2);
};

function Dice(props: DiceProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);

  useFrame((state, delta) => {
    if (props.isActive && !dragging) {
      meshRef.current.rotation.x += delta / 2;
      meshRef.current.rotation.y += delta / 2;
    }
  });

  const faceColors = useMemo(
    () => [
      DICE_COLORS[1], // red
      DICE_COLORS[0], // teal
      DICE_COLORS[3], // blue
      DICE_COLORS[4], // light salmon
      DICE_COLORS[5], // light green
      DICE_COLORS[2], // yellow
    ],
    []
  );
  const faceConfig = useMemo(() => {
    const basePositions = {
      1: [1.01, 0, 0],
      2: [0, 0, -1.01],
      3: [0, 1.01, 0],
      4: [0, -1.01, 0],
      5: [0, 0, 1.01],
      6: [-1.01, 0, 0],
    } as const;

    const baseRotations: Record<number, [number, number, number]> = {
      1: [0, Math.PI / 2, 0],
      2: [0, Math.PI, 0],
      3: [-Math.PI / 2, 0, 0],
      4: [Math.PI / 2, 0, 0],
      5: [0, 0, 0],
      6: [0, -Math.PI / 2, 0],
    };

    return Object.fromEntries(
      Object.entries(basePositions).map(([face, position]) => {
        const faceNum = Number(face);
        const rotation = [...baseRotations[faceNum]] as [
          number,
          number,
          number
        ];

        // すべての面に回転角度を適用
        rotation[2] = -getRotationFromAngle(props.faceData[faceNum].rotation);

        return [face, { position, rotation }];
      })
    );
  }, [props.faceData]);
  return (
    <mesh
      {...props}
      ref={meshRef}
      onPointerOver={(event) => {
        setHover(true);
        if (!dragging) {
          document.body.style.cursor = "grab";
        }
      }}
      onPointerOut={(event) => {
        setHover(false);
        if (!dragging) {
          document.body.style.cursor = "default";
        }
      }}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        setDragging(true);
        document.body.style.cursor = "grabbing";
        console.log("pointer down");
      }}
      onPointerUp={(event: ThreeEvent<PointerEvent>) => {
        setDragging(false);
        document.body.style.cursor = "grab";
        console.log("pointer up");
      }}
    >
      <boxGeometry args={[2, 2, 2]} />
      {faceColors.map((color, index) => (
        <meshPhysicalMaterial
          key={index}
          attach={`material-${index}`}
          color={color}
          transparent
          opacity={0.7}
          clearcoat={1}
          clearcoatRoughness={0}
          metalness={0.1}
          roughness={0}
        />
      ))}
      {Object.entries(props.faceData).map(([faceId, faceData]) => (
        <Text
          key={faceId}
          position={faceConfig[Number(faceId)].position}
          rotation={faceConfig[Number(faceId)].rotation}
          fontSize={1}
          color="black"
        >
          {faceData.text}
        </Text>
      ))}
    </mesh>
  );
}

export default function DiceComponent({
  faceData,
}: {
  faceData: Record<number, FaceData>;
}) {
  const [isActive, setIsActive] = useState(false);
  const controlsRef = useRef(null!);
  return (
    <div className="relative w-full h-screen bg-gray-100 shadow-lg">
      <Canvas>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <Dice position={[0, 0, 0]} isActive={isActive} faceData={faceData} />
        <OrbitControls ref={controlsRef} enablePan={false} />
      </Canvas>
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
        <button
          onClick={() => setIsActive(!isActive)}
          className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 active:scale-95 transition-transform duration-150 ease-in-out"
        >
          {isActive ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6" />
          )}
        </button>
      </div>
    </div>
  );
}
