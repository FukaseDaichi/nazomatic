"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { ShiritoriManager } from "@/class/ShiritoriManager";

interface ShiritoriResultProps {
  inputText: string;
}

export function ShiritoriResultComponent({
  inputText,
}: ShiritoriResultProps) {
  const { words, unusedWords, isOptimal } = useMemo(() => {
    ShiritoriManager.setWordsByText(inputText);
    const words = ShiritoriManager.getLongestShiritoris();
    return {
      words,
      unusedWords: ShiritoriManager.getUnusedWords(),
      isOptimal: ShiritoriManager.isOptimal(),
    };
  }, [inputText]);

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm text-gray-300">最長のしりとり</p>
        <p className="mt-1 text-gray-300">
          <span className="text-4xl font-bold tabular-nums text-purple-400">{words.length}</span>
          <span className="ml-2 text-sm">語つながりました</span>
        </p>
        {!isOptimal && (
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            単語が多いため、時間内に最長と確定できませんでした。見つかった中で最長のしりとりを表示しています。
          </p>
        )}
      </div>

      <ol aria-label="しりとりの並び順" className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {words.map((word, index) => (
          <li key={index} className="flex min-w-0 max-w-full items-center gap-2">
            <div className="flex min-w-0 items-baseline gap-2 rounded-xl border border-purple-400/30 bg-purple-400/10 px-3 py-2.5">
              <span aria-hidden="true" className="shrink-0 text-xs tabular-nums text-purple-400">{index + 1}</span>
              <span className="min-w-0 break-all text-base font-medium leading-relaxed text-white">{word}</span>
            </div>
            {index < words.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-purple-400" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <div className="border-t border-gray-700 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-300">
          使わなかった単語
          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs tabular-nums">{unusedWords.length}語</span>
        </h3>
        {unusedWords.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">すべての単語がつながりました。</p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">今回の並び順には入らなかった単語です。</p>
            <ul aria-label="使わなかった単語" className="mt-3 flex flex-wrap gap-2">
              {unusedWords.map((word, index) => (
                <li key={index} className="max-w-full break-all rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm leading-relaxed text-gray-300">{word}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
