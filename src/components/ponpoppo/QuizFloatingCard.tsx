"use client";

import React, { useState } from "react";
import { X, Trophy, Star, Sparkles } from "lucide-react";
import Image from "next/image";

type Quiz = {
  image: string;
  correctAnswer: number;
  product: {
    name: string;
    image: string;
    rarity: string;
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
  const [showPremiumEffect, setShowPremiumEffect] = useState(false);

  const handleButtonClick = (buttonIndex: number) => {
    if (isAnimating) return;
    setIsAnimating(true);

    const result = buttonIndex === quiz.correctAnswer ? "correct" : "incorrect";

    setTimeout(() => {
      setIsFlipped(true);
      setTimeout(() => {
        setGameState(result);
        setIsAnimating(false);

        // 正解時に特別演出を開始
        if (result === "correct") {
          setShowPremiumEffect(true);
        }
      }, 1200);
    }, 500);
  };

  // z-indexを動的に
  const frontZ = isAnimating || gameState === "quiz" ? "z-20" : "z-10";
  const backZ = !isAnimating && gameState !== "quiz" ? "z-20" : "z-10";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 flex items-center justify-center p-8 relative overflow-hidden">
      {/* 背景パーティクル演出 */}
      {showPremiumEffect && (
        <>
          {/* レインボー背景フラッシュ */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 via-pink-500/30 to-yellow-400/30 animate-pulse-rainbow" />

          {/* パーティクル群 */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            >
              <Star className="w-4 h-4 text-yellow-300 animate-spin" />
            </div>
          ))}

          {/* 大きなスパークル */}
          {[...Array(8)].map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className="absolute animate-sparkle"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
                animationDelay: `${Math.random() * 1.5}s`,
              }}
            >
              <Sparkles className="w-8 h-8 text-white animate-pulse" />
            </div>
          ))}

          {/* レインボーリング */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-96 h-96 border-4 border-transparent bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 rounded-full animate-rainbow-ring bg-clip-border opacity-70"
              style={{
                background:
                  "conic-gradient(from 0deg, #ff0000, #ff8800, #ffff00, #88ff00, #00ff00, #00ff88, #00ffff, #0088ff, #0000ff, #8800ff, #ff00ff, #ff0088, #ff0000)",
                WebkitMask:
                  "radial-gradient(circle, transparent 180px, black 184px)",
                mask: "radial-gradient(circle, transparent 180px, black 184px)",
              }}
            />
          </div>
        </>
      )}

      <div
        className="relative w-80 h-56 z-30"
        style={{ perspective: "1000px", WebkitPerspective: "1000px" }}
      >
        {/* プレミアム演出時は正解コンテンツのみ表示 */}
        {showPremiumEffect ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 relative">
            {/* SSRプレミアム演出 */}
            <div className="absolute top-2 right-2 text-yellow-300 text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent animate-pulse">
              {quiz.product.rarity}
            </div>

            {/* カード内パーティクル */}
            {[...Array(6)].map((_, i) => (
              <div
                key={`card-particle-${i}`}
                className="absolute animate-card-particle"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${20 + Math.random() * 60}%`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              >
                <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse" />
              </div>
            ))}

            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm border-yellow-300/50 animate-pulse">
                <Trophy className="w-8 h-8 text-yellow-300 animate-bounce" />
              </div>
              <h1 className="text-2xl font-bold backdrop-blur bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
                {quiz.product.name}をゲット！
              </h1>
            </div>
            <div className="animate-premium-item">
              <Image
                className="backdrop-blur-sm animate-bounce"
                src={quiz.product.image}
                alt={quiz.product.name}
                width={100}
                height={100}
              />
            </div>
          </div>
        ) : (
          /* 通常のカードフリップ */
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
                className={`absolute inset-0 w-full h-full rounded-2xl shadow-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 border border-white/10 ${frontZ}`}
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
                    ? "bg-gradient-to-br from-indigo-600/80 via-purple-700/80 to-blue-800/80"
                    : "bg-gradient-to-br from-gray-900 via-gray-800 to-black"
                } border border-white/10 ${backZ} gpu-layer`}
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                {/* 正解時の通常表示（プレミアム演出前） */}
                {!isAnimating &&
                  gameState === "correct" &&
                  !showPremiumEffect && (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 -webkit-backdrop-filter">
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

                {/* 不正解時 */}
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
        )}
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

        @keyframes premium-float {
          0%,
          100% {
            transform: translateY(0px) rotateX(5deg) scale(1);
          }
          25% {
            transform: translateY(-15px) rotateX(8deg) scale(1.05);
          }
          50% {
            transform: translateY(-30px) rotateX(5deg) scale(1.1);
          }
          75% {
            transform: translateY(-15px) rotateX(2deg) scale(1.05);
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

        @keyframes premium-glow {
          0%,
          100% {
            filter: brightness(1.2) drop-shadow(0 0 30px rgba(255, 215, 0, 0.6))
              drop-shadow(0 0 60px rgba(255, 105, 180, 0.4));
          }
          50% {
            filter: brightness(1.5) drop-shadow(0 0 40px rgba(255, 215, 0, 0.8))
              drop-shadow(0 0 80px rgba(255, 105, 180, 0.6));
          }
        }

        @keyframes pulse-rainbow {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }

        @keyframes particle {
          0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes sparkle {
          0%,
          100% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.5) rotate(180deg);
            opacity: 1;
          }
        }

        @keyframes rainbow-ring {
          0% {
            transform: rotate(0deg) scale(0.8);
            opacity: 0.5;
          }
          50% {
            transform: rotate(180deg) scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: rotate(360deg) scale(0.8);
            opacity: 0.5;
          }
        }

        @keyframes card-premium {
          0%,
          100% {
            box-shadow: 0 0 30px rgba(255, 215, 0, 0.3),
              0 0 60px rgba(255, 105, 180, 0.2);
          }
          50% {
            box-shadow: 0 0 50px rgba(255, 215, 0, 0.5),
              0 0 100px rgba(255, 105, 180, 0.4);
          }
        }

        @keyframes card-particle {
          0% {
            transform: translateY(0) scale(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: translateY(-50px) scale(1);
            opacity: 0;
          }
        }

        @keyframes premium-item {
          0%,
          100% {
            transform: scale(1) rotate(0deg);
          }
          25% {
            transform: scale(1.1) rotate(2deg);
          }
          75% {
            transform: scale(1.1) rotate(-2deg);
          }
        }

        .flipper {
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
          width: 100%;
          height: 100%;
          position: relative;
        }

        .floater {
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
          width: 100%;
          height: 100%;
          position: relative;
        }

        .animate-spin-glow {
          animation: spinGlow 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .animate-premium-glow {
          animation: premium-glow 2s ease-in-out infinite;
        }

        .animate-pulse-rainbow {
          animation: pulse-rainbow 2s ease-in-out infinite;
        }

        .animate-particle {
          animation: particle linear infinite;
        }

        .animate-sparkle {
          animation: sparkle 1.5s ease-in-out infinite;
        }

        .animate-rainbow-ring {
          animation: rainbow-ring 3s linear infinite;
        }

        .animate-card-premium {
          animation: card-premium 2s ease-in-out infinite;
        }

        .animate-card-particle {
          animation: card-particle 3s ease-out infinite;
        }

        .animate-premium-item {
          animation: premium-item 2s ease-in-out infinite;
        }

        .will-change-transform {
          will-change: transform;
        }

        .gpu-layer {
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }

        .front,
        .back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
};

export default QuizFloatingCard;
