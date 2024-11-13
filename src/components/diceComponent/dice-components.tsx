"use client";

import { useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useDrag } from "@use-gesture/react";
import * as THREE from "three";

type DiceProps = {
  faceColors?: string[];
  faceTexts?: string[];
};

const DiceData = ({
  faceColors = Array(6).fill("#ffffff"),
  faceTexts = ["1", "2", "3", "4", "5", "6"],
}: DiceProps) => {
  const mesh = useRef<THREE.Mesh>(null!);
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);

  const bind = useDrag(
    ({ delta: [dx, dy] }) => {
      setRotation([rotation[0] + dy / 100, rotation[1] + dx / 100, 0]);
    },
    {
      preventDefault: false,
      pointer: { touch: true },
    }
  );

  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.x = rotation[0];
      mesh.current.rotation.y = rotation[1];
    }
  });

  return (
    <mesh ref={mesh} {...(bind() as any)} castShadow>
      <boxGeometry args={[2, 2, 2]} />
      {[...Array(6)].map((_, index) => (
        <meshPhysicalMaterial
          key={index}
          attach={`material-${index}`}
          color={faceColors[index]}
          transparent
          metalness={0.1}
          roughness={0.2}
          opacity={0.2}
        >
          <canvasTexture
            attach="map"
            image={(() => {
              const canvas = document.createElement("canvas");
              canvas.width = 128;
              canvas.height = 128;
              canvas.style.opacity = "0.2";
              const ctx = canvas.getContext("2d")!;

              // 背景を黒で塗りつぶし
              ctx.fillStyle = "black";
              // 中央に白い四角を描画
              ctx.fillStyle = "white";
              ctx.fillRect(4, 4, 120, 120);

              // テキストを描画
              ctx.fillStyle = "black";
              ctx.font = "bold 80px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(faceTexts[index], 64, 64);
              return canvas;
            })()}
          />
        </meshPhysicalMaterial>
      ))}
    </mesh>
  );
};

export default function DiceComponent({
  faceColors,
  faceTexts,
}: DiceProps = {}) {
  return (
    <div className="w-full h-screen bg-gray-100">
      <Canvas shadows camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <DiceData faceColors={faceColors} faceTexts={faceTexts} />
      </Canvas>
    </div>
  );
}
