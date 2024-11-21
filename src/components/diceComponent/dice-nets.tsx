"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DiceNetIcon } from "./dice-net-icon";
import { Card } from "../ui/card";

export const DICE_COLORS = [
  "#A0C4FF",
  "#A0C4FF",
  "#FFABAB",
  "#B9FBC0",
  "#B9FBC0",
  "#FFABAB",
];

// サイコロの展開図のデータ
const diceNets = [
  {
    id: 1,
    name: "T字型",
    faces: [
      { id: 3, x: 0, y: 0 },
      { id: 5, x: 0, y: 100 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 6, x: 300, y: 100 },
      { id: 4, x: 0, y: 200 },
    ],
  },
  {
    id: 2,
    name: "T字型A",
    faces: [
      { id: 3, x: 0, y: 0 },
      { id: 5, x: 0, y: 100 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 6, x: 300, y: 100 },
      { id: 4, x: 100, y: 200 },
    ],
  },
  {
    id: 3,
    name: "T字型B",
    faces: [
      { id: 3, x: 0, y: 0 },
      { id: 5, x: 0, y: 100 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 6, x: 300, y: 100 },
      { id: 4, x: 200, y: 200 },
    ],
  },
  {
    id: 4,
    name: "T字型C",
    faces: [
      { id: 3, x: 0, y: 0 },
      { id: 5, x: 0, y: 100 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 6, x: 300, y: 100 },
      { id: 4, x: 300, y: 200 },
    ],
  },
  {
    id: 5,
    name: "十字型",
    faces: [
      { id: 3, x: 100, y: 0 },
      { id: 5, x: 0, y: 100 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 6, x: 300, y: 100 },
      { id: 4, x: 100, y: 200 },
    ],
  },
  {
    id: 6,
    name: "階段型A",
    faces: [
      { id: 3, x: 100, y: 0 },
      { id: 5, x: 0, y: 100 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 6, x: 300, y: 100 },
      { id: 4, x: 200, y: 200 },
    ],
  },
  {
    id: 7,
    name: "Z字型",
    faces: [
      { id: 5, x: 0, y: 0 },
      { id: 3, x: 100, y: 0 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 6, x: 300, y: 100 },
      { id: 4, x: 200, y: 200 },
    ],
  },
  {
    id: 8,
    name: "階段型B",
    faces: [
      { id: 5, x: 0, y: 0 },
      { id: 3, x: 100, y: 0 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 6, x: 300, y: 100 },
      { id: 4, x: 100, y: 200 },
    ],
  },
  {
    id: 9,
    name: "階段型",
    faces: [
      { id: 5, x: 0, y: 0 },
      { id: 3, x: 100, y: 0 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 4, x: 200, y: 200 },
      { id: 6, x: 300, y: 200 },
    ],
  },
  {
    id: 10,
    name: "階段型A",
    faces: [
      { id: 5, x: 0, y: 0 },
      { id: 3, x: 100, y: 0 },
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 200, y: 100 },
      { id: 6, x: 300, y: 100 },
      { id: 4, x: 300, y: 200 },
    ],
  },
  {
    id: 11,
    name: "L字型",
    faces: [
      { id: 6, x: 0, y: 0 },
      { id: 2, x: 100, y: 0 },
      { id: 1, x: 200, y: 0 },
      { id: 3, x: 200, y: 100 },
      { id: 5, x: 300, y: 100 },
      { id: 4, x: 400, y: 100 },
    ],
  },
];

// サイコロの背景色を決定する関数
const getBackgroundColor = (id: number) => {
  return DICE_COLORS[id % DICE_COLORS.length];
};

export interface FaceData {
  text: string;
  rotation: number;
}

const DiceNet = ({
  net,
  faceData,
  onFaceDataChange,
}: {
  net: (typeof diceNets)[0];
  faceData: Record<number, FaceData>;
  onFaceDataChange: (faceId: number, data: Partial<FaceData>) => void;
}) => {
  return (
    <svg width="600" height="300" viewBox="0 0 600 300">
      {net.faces.map((face) => (
        <g key={face.id}>
          <rect
            x={face.x}
            y={face.y}
            width="100"
            height="100"
            fill={getBackgroundColor(face.id)}
            fill-opacity="0.5"
            stroke="black"
          />
          <foreignObject x={face.x} y={face.y} width="100" height="100">
            <div className="h-full flex items-center justify-center relative">
              <Input
                value={faceData[face.id]?.text || ""}
                onChange={(e) =>
                  onFaceDataChange(face.id, { text: e.target.value })
                }
                className="w-16 h-16 text-center text-2xl [touch-action:manipulation]"
                style={{
                  transform: `rotate(${faceData[face.id]?.rotation || 0}deg)`,
                  transition: "transform 0.3s ease",
                }}
              />
              <button
                tabIndex={-1}
                onClick={() =>
                  onFaceDataChange(face.id, {
                    rotation: ((faceData[face.id]?.rotation || 0) + 90) % 360,
                  })
                }
                className="absolute top-0 right-0 p-1 hover:bg-gray-100 rounded-full transition-all duration-100 ease-in-out active:scale-90 hover:shadow-sm"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>
          </foreignObject>
        </g>
      ))}
    </svg>
  );
};

export function DiceNets({
  faceData,
  onFaceDataChange,
}: {
  faceData: Record<number, FaceData>;
  onFaceDataChange: (faceId: number, data: Partial<FaceData>) => void;
}) {
  const [selectedNet, setSelectedNet] = useState(diceNets[0]);
  return (
    <Card className="container mx-auto p-4 flex flex-col items-center bg-gray-800 border-gray-700">
      <h1 className="text-2xl font-bold mb-4 text-white">
        サイコロの展開図選択
      </h1>
      <div className="grid grid-rows-2 grid-flow-col gap-2 mb-4 overflow-x-auto pb-2 max-h-[200px] max-w-[600px] justify-center">
        {diceNets.map((net) => (
          <Button
            key={net.id}
            onClick={() => setSelectedNet(net)}
            variant={selectedNet.id !== net.id ? "default" : "outline"}
            tabIndex={-1}
            className={`${
              selectedNet.id !== net.id
                ? "bg-gray-300 hover:bg-purple-500"
                : "bg-purple-500 hover:bg-purple-500"
            }`}
          >
            <DiceNetIcon
              className={`w-full h-full ${
                selectedNet.id === net.id ? "stroke-white" : "stroke-black"
              }`}
              faces={net.faces}
            />
          </Button>
        ))}
      </div>
      <Card className="border p-4 rounded-lg w-full max-w-[600px] bg-gray-700 border-gray-500">
        <h2 className="text-xl font-semibold mb-2 text-white">
          {selectedNet.name}
        </h2>
        <DiceNet
          net={selectedNet}
          faceData={faceData}
          onFaceDataChange={onFaceDataChange}
        />
      </Card>
    </Card>
  );
}
