"use client";

import { useState, useEffect, useRef } from "react";
import { HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HelpTooltipProps {
  content: React.ReactNode;
  className?: string;
  tooltipWidth?: string;
  arrowLeft?: string;
}

export function HelpTooltip({
  content,
  className = "",
  tooltipWidth,
  arrowLeft,
}: HelpTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipLeft, setTooltipLeft] = useState<string>("50%");
  const [tooltipTop, setTooltipTop] = useState<string>("2rem");
  const [calculatedArrowLeft, setCalculatedArrowLeft] = useState<string>("50%");
  const helpCircleRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTooltip || !helpCircleRef.current || !tooltipRef.current) return;

    const updatePosition = () => {
      const windowWidth = window.innerWidth;
      const helpCircleRect = helpCircleRef.current!.getBoundingClientRect();
      const tooltipRect = tooltipRef.current!.getBoundingClientRect();

      // HelpCircleの中心位置を取得（画面全体に対する位置）
      const helpCircleCenterX = helpCircleRect.left + helpCircleRect.width / 2;
      const helpCircleBottom = helpCircleRect.bottom;

      // ツールチップの幅を取得
      const actualTooltipWidth =
        tooltipRect.width || (tooltipWidth ? parseFloat(tooltipWidth) : 384); // max-w-sm = 384px

      // ツールチップを画面中央に配置（画面全体に対する位置）
      const centerX = windowWidth / 2;
      const tooltipLeftValue = centerX - actualTooltipWidth / 2;

      setTooltipLeft(`${tooltipLeftValue}px`);

      // ツールチップのtop位置をHelpCircleの下に配置
      const tooltipTopValue = helpCircleBottom + 8; // 8pxの余白
      setTooltipTop(`${tooltipTopValue}px`);

      // arrowをHelpCircleの真下に配置（ツールチップ内での相対位置）
      // ツールチップの左端からの距離を計算
      const arrowLeftInTooltip = helpCircleCenterX - tooltipLeftValue;
      setCalculatedArrowLeft(`${arrowLeftInTooltip}px`);
    };

    // 初回計算（少し遅延させてレンダリング後に実行）
    const timeoutId = setTimeout(updatePosition, 0);

    // リサイズ時に再計算
    window.addEventListener("resize", updatePosition);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updatePosition);
    };
  }, [showTooltip, tooltipWidth]);

  const tooltipStyle: React.CSSProperties = {
    ...(tooltipWidth && { width: tooltipWidth }),
    left: tooltipLeft,
    top: tooltipTop,
    transform: "translateX(0)",
  };

  const arrowStyle: React.CSSProperties = {
    left: arrowLeft || calculatedArrowLeft,
    transform: arrowLeft ? "none" : "translateX(-50%)",
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <span
        ref={helpCircleRef}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50 rounded-full cursor-help"
        aria-label="詳細情報"
      >
        <HelpCircle size={20} />
      </span>
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className={`fixed bg-gray-800 text-white px-6 pt-4 pb-6 rounded-lg shadow-lg border border-gray-700 z-50 ${
              !tooltipWidth ? "max-w-sm" : ""
            }`}
            style={tooltipStyle}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div
              className="absolute -top-2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-700"
              style={arrowStyle}
            ></div>
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
