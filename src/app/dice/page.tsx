"use client";

import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import { FaceData } from "@/components/diceComponent/dice-nets";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";

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

const BREAK_POINT = 600;
export default function Dice() {
  const [isMobile, setIsMobile] = useState(false);

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

  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < BREAK_POINT);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  return (
    <>
      <ArticleHeaderComponent />
      <Article index={1} />
      <main className="flex min-h-screen flex-col md:flex-row items-center justify-center">
        <div className="flex-1 flex items-center justify-center w-full sm:max-w-[600px]">
          <DiceNets
            faceData={faceData}
            onFaceDataChange={handleFaceDataChange}
            isMobile={isMobile}
          />
        </div>
        <div className="flex-1 flex items-center justify-center w-90 sm:max-w-[300px]">
          <DiceComponent faceData={faceData} />
        </div>
      </main>
    </>
  );
}
