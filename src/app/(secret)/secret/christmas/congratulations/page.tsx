"use client";

import React from "react";
import { motion } from "framer-motion";

const ChristmasWinnerPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-600 to-green-700 flex flex-col items-center justify-center overflow-hidden select-none cursor-default">
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

const Snowflakes = () => {
  const snowflakes = Array.from({ length: 50 }).map((_, i) => (
    <motion.div
      key={i}
      className="absolute text-white text-opacity-80"
      initial={{
        top: `-${Math.random() * 20 + 10}%`,
        left: `${Math.random() * 100}%`,
        scale: Math.random() * 0.5 + 0.5,
      }}
      animate={{
        top: "100%",
        left: `${Math.random() * 100}%`,
        transition: {
          duration: Math.random() * 5 + 5,
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
