"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Puzzle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderComponent } from "@/components/common/header-component";
import { FooterComponent } from "@/components/common/footer-component";

export default function Home() {
  const [hintRevealed, setHintRevealed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <HeaderComponent />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-extrabold mb-4">謎を解き明かそう</h2>
          <p className="text-xl text-gray-300 mb-8">
            NAZOMATICで、あなたの謎解き力を極限まで高めよう
          </p>
        </motion.section>

        <section className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            {
              icon: Lightbulb,
              title: "しりとりシステム",
              description: "あいうえお表と自動でしりとりをするシステム！",
              path: "/shiritori",
            },
            {
              icon: Puzzle,
              title: "サイコロシステム",
              description: "展開図が苦手なあなたも安心！",
              path: "/dice",
            },
            {
              icon: Users,
              title: "コミュニティ",
              description: "謎解き仲間と交流し、スキルを高め合おう",
              path: "/",
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.1,
              }}
              // ホバー時のアニメーション
              whileHover={{
                scale: 1.05,
              }}
              // クリック時のアニメーション
              whileTap={{
                scale: 1.0,
              }}
              onClick={() => {
                window.location.href = feature.path;
              }}
              className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-4">
                <feature.icon className="h-12 w-12 text-purple-400" />
                <h3 className="text-xl font-semibold">{feature.title}</h3>
              </div>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </section>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="bg-gray-800 p-8 rounded-lg shadow-lg text-center"
        >
          <h3 className="text-2xl font-bold mb-4">謎解きに挑戦</h3>
          <p className="text-gray-300 mb-6">
            以下の暗号を解読できますか？ヒントが必要な場合は、ボタンをクリックしてください。
          </p>
          <div className="bg-gray-700 p-4 rounded-md mb-6 font-mono text-lg">
            23-5-12-3-15-13-5 20-15 14-1-26-15-13-1-20-9-3
          </div>
          <Button
            onClick={() => setHintRevealed(!hintRevealed)}
            className="bg-purple-600 hover:bg-purple-700 text-white mb-4"
          >
            {hintRevealed ? "ヒントを隠す" : "ヒントを表示"}
          </Button>
          {hintRevealed && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-purple-400"
            >
              ヒント: 各数字はアルファベットの順番を表しています。
            </motion.p>
          )}
        </motion.section>
      </main>
      <FooterComponent />
    </div>
  );
}
