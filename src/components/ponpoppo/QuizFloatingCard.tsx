"use client";

import React, { useState } from "react";
import { X, Trophy } from "lucide-react";
import Image from "next/image";

type Quiz = {
  image: string;
  correctAnswer: number;
  product: {
    name: string;
    image: string;
  };
};

type QuizFloatingCardProps = {
  quiz: Quiz;
};

const icons = [
  {
    id: 1,
    url: "/img/secret/ponpoppo/nijisuke.jpg",
    text: "にじすけ",
  },
  {
    id: 2,
    url: "/img/secret/ponpoppo/franc.jpg",
    text: "フラン",
  },
  {
    id: 3,
    url: "/img/secret/ponpoppo/apli.jpg",
    text: "アプリシアン",
  },
];

const QuizFloatingCard = ({ quiz }: QuizFloatingCardProps) => {
  const [gameState, setGameState] = useState<"quiz" | "correct" | "incorrect">(
    "quiz"
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleButtonClick = (buttonIndex: number) => {
    if (isAnimating) return;
    setIsAnimating(true);

    const result = buttonIndex === quiz.correctAnswer ? "correct" : "incorrect";

    setTimeout(() => {
      setIsFlipped(true);
      setTimeout(() => {
        setGameState(result);
        setIsAnimating(false);
      }, 1200);
    }, 500);
  };

  // z-indexを動的に
  const frontZ = isAnimating || gameState === "quiz" ? "z-20" : "z-10";
  const backZ = !isAnimating && gameState !== "quiz" ? "z-20" : "z-10";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 flex items-center justify-center p-8">
      <div className="relative w-80 h-56" style={{ perspective: "1000px" }}>
        {/* flipper: 回転担当 */}
        <div
          className={`relative w-full h-full flipper ${
            isAnimating ? "animate-spin-glow" : ""
          }`}
          style={{
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: !isAnimating
              ? "transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
              : "none",
          }}
        >
          {/* floater: 浮遊アニメーション担当 */}
          <div
            className={`w-full h-full floater`}
            style={{
              animation:
                !isAnimating && gameState === "quiz"
                  ? "float 6s ease-in-out infinite"
                  : "none",
            }}
          >
            {/* ——— 表面 ——— */}
            <div
              className={`absolute inset-0 w-full h-full rounded-2xl shadow-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 border border-white/10 overflow-hidden ${frontZ}`}
              style={{ backfaceVisibility: "hidden" }}
            >
              {isAnimating ? (
                // 回転中は「判定中」だけ
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-white text-lg font-semibold">判定中</p>
                </div>
              ) : gameState === "quiz" ? (
                // 通常クイズ画面
                <div
                  className="w-full h-full flex flex-col items-center justify-between p-4 bg-blend-overlay"
                  style={{
                    backgroundImage: `url(${quiz.image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="flex-1" />
                  <div className="flex space-x-4 z-10 mb-2">
                    {icons.map((icon, i) => (
                      <div
                        key={icon.id}
                        className="w-14 h-14 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 hover:border-white/50 transition-all duration-300 hover:scale-110 cursor-pointer select-none"
                      >
                        <Image
                          src={icon.url}
                          onClick={() => handleButtonClick(i)}
                          alt={icon.text}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-contain rounded-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* ——— 裏面 ——— */}
            <div
              className={`absolute inset-0 w-full h-full rounded-2xl shadow-2xl ${
                gameState === "correct"
                  ? "bg-gradient-to-br from-gray-700 via-gray-900 to-black"
                  : "bg-gradient-to-br from-gray-900 via-gray-800 to-black"
              } border border-white/10 overflow-hidden ${backZ}`}
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              {/* 回転が終わって結果がセットされたあとだけ表示 */}
              {!isAnimating && gameState === "correct" && (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
                      <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-white text-2xl font-bold backdrop-blur">
                      {quiz.product.name}をゲット！
                    </h1>
                  </div>
                  <Image
                    className="backdrop-blur-sm"
                    src={quiz.product.image}
                    alt={quiz.product.name}
                    width={100}
                    height={100}
                  />
                </div>
              )}
              {!isAnimating && gameState === "incorrect" && (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-20 h-20 mx-auto mb-4 bg-red-500/30 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-red-400/50">
                    <X className="w-10 h-10 text-red-300" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotateX(5deg);
          }
          50% {
            transform: translateY(-20px) rotateX(5deg);
          }
        }

        @keyframes spinGlow {
          0% {
            transform: rotateY(0deg) rotateX(5deg) scale(1);
            filter: brightness(1) drop-shadow(0 0 20px rgba(255, 255, 255, 0.3));
          }
          25% {
            transform: rotateY(180deg) rotateX(15deg) scale(1.1);
            filter: brightness(1.5)
              drop-shadow(0 0 40px rgba(200, 200, 200, 0.5));
          }
          50% {
            transform: rotateY(360deg) rotateX(5deg) scale(1.15);
            filter: brightness(2) drop-shadow(0 0 60px rgba(255, 255, 255, 0.7));
          }
          75% {
            transform: rotateY(540deg) rotateX(-10deg) scale(1.1);
            filter: brightness(1.8)
              drop-shadow(0 0 50px rgba(180, 180, 180, 0.6));
          }
          100% {
            transform: rotateY(720deg) rotateX(5deg) scale(1);
            filter: brightness(1.2)
              drop-shadow(0 0 30px rgba(255, 255, 255, 0.4));
          }
        }

        .flipper {
          transform-style: preserve-3d;
          width: 100%;
          height: 100%;
          position: relative;
        }
        .floater {
          width: 100%;
          height: 100%;
          position: relative;
        }
        .animate-spin-glow {
          animation: spinGlow 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>
    </div>
  );
};

export default QuizFloatingCard;
