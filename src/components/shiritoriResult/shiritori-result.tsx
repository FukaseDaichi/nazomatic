"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ShiritoriManager } from "@/class/ShiritoriManager";

interface ShiritoriResultProps {
  inputText: string;
  onClose?: () => void;
}

export function ShiritoriResultComponent({
  inputText = "",
  onClose,
}: ShiritoriResultProps) {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [shiritoriWords, setShiritoriWords] = useState<string[]>([]);
  const [unusedWords, setUnusedWords] = useState<string[]>([]);

  useEffect(() => {
    setDisplayedWords([]);
    ShiritoriManager.setWordsByText(inputText);
    setShiritoriWords(ShiritoriManager.getLongestShiritoris());
    setUnusedWords(ShiritoriManager.getUnusedWords());
  }, [inputText]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (displayedWords.length < shiritoriWords.length) {
        setDisplayedWords((prev) => [...prev, shiritoriWords[prev.length]]);
      } else {
        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [shiritoriWords, displayedWords]);

  return (
    <div className="relative w-full px-2 sm:px-4">
      {/* 閉じるボタン */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2"
          aria-label="閉じる"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* しりとりチェーン */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-sm font-semibold text-purple-700">
            しりとりチェーン
          </span>
          <Badge
            variant="secondary"
            className="text-xs px-1.5 py-0 bg-purple-100 text-purple-700 border-none"
          >
            {shiritoriWords.length}語
          </Badge>
        </div>

        {/* チェーン表示：横並びフロー */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {displayedWords.map((word, index) => (
            <motion.div
              key={index}
              className="flex items-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <span className="inline-block bg-purple-600 text-white text-sm sm:text-base font-medium px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-sm">
                {word}
              </span>
              {index < shiritoriWords.length - 1 && (
                <span className="text-purple-400 mx-0.5 sm:mx-1 text-sm">
                  &rarr;
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* 区切り線 */}
      <div className="border-t border-gray-200 my-4" />

      {/* 未使用単語 */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-sm font-semibold text-gray-500">
            未使用の単語
          </span>
          <Badge
            variant="secondary"
            className="text-xs px-1.5 py-0 bg-gray-100 text-gray-500 border-none"
          >
            {unusedWords.length}語
          </Badge>
        </div>

        {unusedWords.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">
            すべての単語が使用されました
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {unusedWords.map((word, index) => (
              <motion.span
                key={index}
                className="inline-block text-sm px-2 py-0.5 rounded-md border border-gray-300 text-gray-500 bg-gray-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                {word}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
