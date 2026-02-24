"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center">シフト検索</h1>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-xl text-white">検索条件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="shift-input" className="text-gray-200">
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
                className="bg-gray-700 border-gray-600 text-white text-base"
                placeholder={getShiftPlaceholder(selectedDictionary)}
              />
              <p className="text-xs text-gray-400">
                {SearchManager.getName(selectedDictionary)}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-200">辞書</Label>
              <Select
                value={selectedDictionary}
                onValueChange={handleChangeDictionary}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
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
              <p className="text-sm text-gray-400">
                {SearchManager.getDescription(selectedDictionary)}
              </p>
            </div>

            <label className="flex items-center gap-2 text-gray-200">
              <input
                type="checkbox"
                checked={includeAnagram}
                onChange={(event) => setIncludeAnagram(event.target.checked)}
                className="h-4 w-4"
              />
              ずらした後でアナグラム検索を有効にする
            </label>

            <Button
              onClick={() => void handleSearch()}
              disabled={!searchManager || loading}
              className="w-full bg-purple-400 hover:bg-purple-500 text-gray-900"
            >
              {loading ? "検索中..." : "検索"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-xl text-white">
              検索結果 ({results.length})
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
              <ul className="space-y-2">
                {results.map((result, index) => (
                  <li
                    key={`${result.resultWord}-${result.shift}-${result.matchType}-${index}`}
                    className="bg-gray-700 rounded-md p-3 text-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{result.resultWord}</span>
                      <div className="flex items-center gap-1">
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
