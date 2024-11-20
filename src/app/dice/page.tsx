"use client";

import { FaceData } from "@/components/diceComponent/dice-nets";
import dynamic from "next/dynamic";
import { useState, useCallback } from "react";

const DiceComponent = dynamic(
  () => import("@/components/diceComponent/dice-components"),
  {
    ssr: false,
  }
);
const DiceNets = dynamic(
  () =>
    import("@/components/diceComponent/dice-nets").then((mod) => mod.DiceNets),
  {
    ssr: false,
  }
);

export default function Dice() {
  const [faceData, setFaceData] = useState<Record<number, FaceData>>({
    1: { text: "1", rotation: 0 },
    2: { text: "2", rotation: 0 },
    3: { text: "3", rotation: 0 },
    4: { text: "4", rotation: 0 },
    5: { text: "5", rotation: 0 },
    6: { text: "6", rotation: 0 },
  });

  const handleFaceDataChange = useCallback(
    (faceId: number, data: Partial<FaceData>) => {
      setFaceData((prev) => ({
        ...prev,
        [faceId]: {
          ...prev[faceId],
          text: prev[faceId]?.text || "",
          rotation: prev[faceId]?.rotation || 0,
          ...data,
        },
      }));
    },
    []
  );

  return (
    <main className="flex min-h-screen flex-col md:flex-row items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="flex-1 flex items-center justify-center max-w-[600px]">
        <DiceNets faceData={faceData} onFaceDataChange={handleFaceDataChange} />
      </div>
      <div className="flex-1 flex items-center justify-center max-w-[300px]">
        <DiceComponent faceData={faceData} />
      </div>
    </main>
  );
}
