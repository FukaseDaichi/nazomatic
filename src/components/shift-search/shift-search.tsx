"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, HelpCircle, Sparkles } from "lucide-react";
import { DICTIONARIES, SearchManager } from "@/class/SearchManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  runShiftSearch,
  SHIFT_ANAGRAM_RESULT_MAXCOUNT,
  SHIFT_EXACT_RESULT_MAXCOUNT,
  SHIFT_TOTAL_RESULT_MAXCOUNT,
  type ShiftSearchResult,
} from "@/lib/shift-search";
import { motion } from "framer-motion";

const FIRST_DIC = "buta";

const getShiftPlaceholder = (dictionaryKey: string): string => {
  const dictionaryType = SearchManager.getType(dictionaryKey);
  if (dictionaryType === "jp") {
    return "例：あいさつ";
  }
  if (dictionaryType === "en") {
    return "例：hello";
  }
  return "";
};

const getMatchLabel = (matchType: ShiftSearchResult["matchType"]): string => {
  if (matchType === "exact") {
    return "完全一致";
  }
  return "アナグラム";
};

export default function ShiftSearch() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ShiftSearchResult[]>([]);
  const [selectedDictionary, setSelectedDictionary] = useState(FIRST_DIC);
  const [searchManager, setSearchManager] = useState<SearchManager | null>(
    null,
  );
  const [includeAnagram, setIncludeAnagram] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [normalizedInput, setNormalizedInput] = useState("");
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const dictionaryRequestIdRef = useRef(0);

  const loadDictionary = useCallback(
    async (
      dictionaryKey: string,
      options: { updateSelection?: boolean } = {},
    ) => {
      const { updateSelection = true } = options;
      if (updateSelection) {
        setSelectedDictionary(dictionaryKey);
      }

      setSearchManager(null);
      setResults([]);
      setErrorMessage(null);
      setLimitReached(false);

      const requestId = dictionaryRequestIdRef.current + 1;
      dictionaryRequestIdRef.current = requestId;

      try {
        const manager = await SearchManager.create(dictionaryKey);
        if (dictionaryRequestIdRef.current !== requestId) {
          return;
        }
        setSearchManager(manager);
      } catch (error) {
        if (dictionaryRequestIdRef.current === requestId) {
          const message =
            error instanceof Error
              ? error.message
              : "辞書の読み込み中にエラーが発生しました。";
          setErrorMessage(message);
          setSearchManager(null);
          setResults([]);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadDictionary(FIRST_DIC, { updateSelection: false });
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [loadDictionary]);

  const handleSearch = useCallback(async () => {
    if (!searchManager) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setLimitReached(false);
    setResults([]);

    try {
      const dictionaryType = SearchManager.getType(selectedDictionary);
      if (dictionaryType !== "jp" && dictionaryType !== "en") {
        throw new Error("この辞書ではシフト検索に対応していません。");
      }

      const outcome = await runShiftSearch({
        searchManager,
        dictionaryType,
        input,
        includeAnagram,
      });

      setNormalizedInput(outcome.normalizedInput);
      setResults(outcome.results);
      setLimitReached(outcome.limitReached);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "検索中にエラーが発生しました。";
      setErrorMessage(message);
      setResults([]);
      setLimitReached(false);
    } finally {
      setLoading(false);
    }
  }, [includeAnagram, input, searchManager, selectedDictionary]);

  const handleChangeDictionary = useCallback(
    (value: string) => {
      loadDictionary(value);
    },
    [loadDictionary],
  );
  const canSearch =
    Boolean(searchManager) && !loading && input.trim().length > 0;

  return (
    <main className="min-h-screen px-4 pb-10 pt-3 sm:px-6 sm:pt-6">
      <div className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-6">
        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-2xl font-bold mb-6 text-center"
          >
            シフト検索
          </motion.h1>
          <div className="absolute top-0 right-0">
            <Button
              asChild
              variant="outline"
              className="border-purple-300 bg-transparent text-purple-100 hover:bg-purple-600/20 hover:text-purple-50"
            >
              <Link href="/shift-search/reports">全探索結果</Link>
            </Button>
          </div>
        </div>
        <Card className="border-gray-700/90 bg-gray-800/95 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl text-white">検索条件</CardTitle>
              <div
                className="relative"
                onMouseEnter={() => setShowHelpTooltip(true)}
                onMouseLeave={() => setShowHelpTooltip(false)}
              >
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-300 transition-colors outline-none hover:text-purple-200"
                  aria-label="シフト検索の説明"
                  aria-expanded={showHelpTooltip}
                  onFocus={() => setShowHelpTooltip(true)}
                  onBlur={() => setShowHelpTooltip(false)}
                  onClick={() => setShowHelpTooltip(true)}
                >
                  <HelpCircle size={20} />
                </button>
                {showHelpTooltip && (
                  <div className="z-10 fixed left-1/2 -translate-x-1/2 mt-2 w-[min(90vw,26rem)]  rounded-lg border border-gray-600 bg-gray-900 p-3 text-sm leading-relaxed text-gray-100 shadow-xl sm:absolute sm:left-auto sm:-translate-x-1/2">
                    <div className="absolute left-1/4 -top-2 h-0 w-0 -translate-x-1/2 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-900 sm:left-1/2" />
                    <h2 className="font-semibold text-purple-400">
                      この検索でできること
                    </h2>
                    <p className="mt-2">
                      シフト検索は、文字を一定数ずらして、辞書にある別の単語になるかを調べる検索です。
                    </p>
                    <p className="mt-2">
                      アナグラムは、同じ文字を並べ替えて別の単語を作ることです。「アナグラム検索」を有効にすると、ずらした後に並べ替えた候補も探します。
                    </p>
                    <p className="mt-2">
                      全パターンの探索結果は
                      <Link
                        href="/shift-search/reports"
                        className="ml-1 text-purple-200 underline decoration-purple-300/70 hover:text-purple-100"
                      >
                        全探索結果
                      </Link>
                      で確認できます。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:space-y-3.5 sm:p-5 sm:pt-0">
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="shift-input"
                  className="text-xs font-semibold uppercase tracking-wide text-gray-300"
                >
                  単語入力
                </Label>
                <Input
                  id="shift-input"
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSearch();
                    }
                  }}
                  className="h-10 border-gray-600 bg-gray-700/90 text-base text-white focus-visible:ring-purple-400 focus-visible:ring-offset-gray-900"
                  placeholder={getShiftPlaceholder(selectedDictionary)}
                />
                <p className="text-[11px] text-gray-400">
                  {SearchManager.getName(selectedDictionary)}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                  辞書
                </Label>
                <Select
                  value={selectedDictionary}
                  onValueChange={handleChangeDictionary}
                >
                  <SelectTrigger className="h-10 border-gray-600 bg-gray-700/90 text-white focus:ring-purple-400">
                    <SelectValue placeholder="辞書を選択" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    {DICTIONARIES.map((dictionary) => (
                      <SelectItem
                        key={dictionary.key}
                        value={dictionary.key}
                        className="focus:bg-gray-600"
                      >
                        {dictionary.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-gray-400">
                  {SearchManager.getDescription(selectedDictionary)}
                </p>
              </div>
            </div>

            <label
              htmlFor="include-anagram"
              className={`group relative flex cursor-pointer items-center justify-between gap-2.5 rounded-lg border px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-purple-400/70 ${
                includeAnagram
                  ? "border-purple-400/80 bg-gradient-to-r from-purple-500/20 via-purple-500/10 to-gray-900/80 shadow-[0_0_20px_rgba(168,85,247,0.18)]"
                  : "border-gray-700 bg-gray-900/70 hover:border-purple-400/50"
              }`}
            >
              <input
                id="include-anagram"
                type="checkbox"
                checked={includeAnagram}
                onChange={(event) => setIncludeAnagram(event.target.checked)}
                className="sr-only"
              />
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Sparkles
                  className={`h-4 w-4 shrink-0 ${
                    includeAnagram ? "text-purple-300" : "text-gray-400"
                  }`}
                />
                <span className="truncate text-sm font-semibold text-gray-100">
                  アナグラム検索を含める
                </span>
              </span>
              <span
                className={`relative h-5 w-9 shrink-0 rounded-full border transition ${
                  includeAnagram
                    ? "border-purple-300/80 bg-purple-500/70"
                    : "border-gray-600 bg-gray-700"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-purple-600 shadow-md transition-transform duration-200 ease-out ${
                    includeAnagram ? "translate-x-4" : "translate-x-0"
                  }`}
                >
                  {includeAnagram && <Check className="h-2.5 w-2.5" />}
                </span>
              </span>
            </label>

            <Button
              onClick={() => void handleSearch()}
              disabled={!canSearch}
              className="h-10 w-full rounded-lg bg-purple-400 text-sm font-semibold text-gray-900 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-400"
            >
              {loading ? "検索中..." : "検索"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-gray-700/90 bg-gray-800/95 shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-white">
              検索結果 {results?.length > 0 && "(" + results.length + ")"}
            </CardTitle>
            {normalizedInput && !errorMessage && (
              <p className="text-sm text-gray-400">
                正規化入力:{" "}
                <span className="text-gray-200">{normalizedInput}</span>
              </p>
            )}
            {limitReached && (
              <p className="text-sm text-purple-300">
                結果上限に達したため一部のみ表示しています（exact:
                {SHIFT_EXACT_RESULT_MAXCOUNT} / anagram:
                {SHIFT_ANAGRAM_RESULT_MAXCOUNT} / total:
                {SHIFT_TOTAL_RESULT_MAXCOUNT}）。
              </p>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-400">検索中...</p>
            ) : errorMessage ? (
              <p className="text-red-400">{errorMessage}</p>
            ) : results.length === 0 ? (
              <p className="text-gray-400">結果がありません。</p>
            ) : (
              <ul className="space-y-2.5">
                {results.map((result, index) => (
                  <li
                    key={`${result.resultWord}-${result.shift}-${result.matchType}-${index}`}
                    className="rounded-xl border border-gray-600/80 bg-gray-700/60 p-3 text-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{result.resultWord}</span>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge className="bg-gray-600 text-gray-100 border-gray-500">
                          shift +{result.shift}
                        </Badge>
                        <Badge className="bg-purple-600 text-white border-purple-500">
                          {getMatchLabel(result.matchType)}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">
                      生成語: {result.sourceWord}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
