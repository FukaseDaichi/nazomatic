"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DiceNetIcon } from "./dice-net-icon";

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
  const colors = ["blue", "blue", "red", "green", "green", "red"];
  return colors[id % colors.length];
};

const DiceNet = ({
  net,
  faceTexts,
  onFaceTextChange,
}: {
  net: (typeof diceNets)[0];
  faceTexts: Record<number, string>;
  onFaceTextChange: (faceId: number, text: string) => void;
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
            fill-opacity="0.1"
            stroke="black"
          />
          <foreignObject x={face.x} y={face.y} width="100" height="100">
            <div className="h-full flex items-center justify-center">
              <Input
                value={faceTexts[face.id] || ""}
                onChange={(e) => onFaceTextChange(face.id, e.target.value)}
                className="w-16 h-16 text-center text-2xl"
              />
            </div>
          </foreignObject>
        </g>
      ))}
    </svg>
  );
};

export function DiceNets() {
  const [selectedNet, setSelectedNet] = useState(diceNets[0]);
  const [faceTexts, setFaceTexts] = useState({});

  const handleFaceTextChange = (faceId: number, text: string) => {
    setFaceTexts((prev) => ({ ...prev, [faceId]: text }));
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">サイコロの展開図選択</h1>
      <div className="grid grid-rows-2 grid-flow-col gap-2 mb-4 overflow-x-auto pb-2 max-h-[200px] max-w-[600px] justify-center">
        {diceNets.map((net) => (
          <Button
            key={net.id}
            onClick={() => setSelectedNet(net)}
            variant={selectedNet.id === net.id ? "default" : "outline"}
          >
            <DiceNetIcon
              className={`w-full h-full stroke-current ${
                selectedNet.id === net.id ? "stroke-white" : "stroke-black"
              }`}
              faces={net.faces}
            />
          </Button>
        ))}
      </div>
      <div className="border p-4 rounded-lg w-full max-w-[600px]">
        <h2 className="text-xl font-semibold mb-2">{selectedNet.name}</h2>
        <DiceNet
          net={selectedNet}
          faceTexts={faceTexts}
          onFaceTextChange={handleFaceTextChange}
        />
      </div>
    </div>
  );
}
