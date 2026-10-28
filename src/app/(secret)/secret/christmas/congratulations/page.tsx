"use client";

import React from "react";
import { motion } from "framer-motion";

const ChristmasWinnerPage = () => {
  return (
    <div className="min-h-screen bg-linear-to-b/srgb from-red-600 to-green-700 flex flex-col items-center justify-center overflow-hidden select-none cursor-default">
      <div className="text-center z-10 select-none cursor-default">
        <h1 className="text-4xl font-bold text-white mb-4 font-serif select-none cursor-default">
          Congratulations
        </h1>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="text-9xl font-bold text-yellow-300 mb-8 font-mono"
          tabIndex={-1}
        >
          {679}
        </motion.div>
      </div>
      <Snowflakes />
    </div>
  );
};

// 描画ごとに配置が変わらず SSR とも一致するよう、固定シードの擬似乱数で雪を並べる
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const SNOWFLAKE_LAYOUTS = Array.from({ length: 50 }, (_, i) => ({
  top: seededRandom(i * 5 + 1) * 20 + 10,
  left: seededRandom(i * 5 + 2) * 100,
  scale: seededRandom(i * 5 + 3) * 0.5 + 0.5,
  endLeft: seededRandom(i * 5 + 4) * 100,
  duration: seededRandom(i * 5 + 5) * 5 + 5,
}));

const Snowflakes = () => {
  const snowflakes = SNOWFLAKE_LAYOUTS.map((flake, i) => (
    <motion.div
      key={i}
      className="absolute text-white/80"
      initial={{
        top: `-${flake.top}%`,
        left: `${flake.left}%`,
        scale: flake.scale,
      }}
      animate={{
        top: "100%",
        left: `${flake.endLeft}%`,
        transition: {
          duration: flake.duration,
          repeat: Infinity,
          ease: "linear",
        },
      }}
    >
      ❄
    </motion.div>
  ));

  return <>{snowflakes}</>;
};

export default ChristmasWinnerPage;
