"use client";

import DiceComponent from "@/components/diceComponent/dice-components";
import { DiceNets } from "@/components/diceComponent/dice-nets";

export default function Dice() {
  return (
    <main className="flex min-h-screen flex-col items-center">
      <DiceNets />
      <DiceComponent
        faceColors={[
          "#ff0000",
          "#00ff00",
          "#0000ff",
          "#ffff00",
          "#ff00ff",
          "#00ffff",
        ]}
        faceTexts={["1", "2", "3", "4", "5", "6"]}
      />
    </main>
  );
}
