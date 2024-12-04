"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import {
  ANAGRAM_RESULT_MAXCOUNT,
  AnagramManager,
  DICTIONARIES,
} from "@/class/AnagramManager";

const FIRST_DIC = "buta";

export default function AnagramSearch() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [selectedDictionary, setSelectedDictionary] = useState(FIRST_DIC);
  const [anagramManager, setAnagramManager] = useState<AnagramManager | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initializeAnagramManager = async () => {
      // 'buta'キーの辞書でAnagramManagerを作成
      const manager = await AnagramManager.create(FIRST_DIC);
      setAnagramManager(manager);
    };
    initializeAnagramManager();
  }, []);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    if (anagramManager) {
      const result = await anagramManager.findAnagramsAsync(input);
      setResults(result);
    }
    setLoading(false);
  }, [anagramManager, input]);

  const handleChangeDictionary = useCallback(async (val: string) => {
    setSelectedDictionary(val);
    const manager = await AnagramManager.create(val);
    setAnagramManager(manager);
  }, []);

  const nextDictionary = useCallback(() => {
    const nextIndex =
      DICTIONARIES.findIndex(
        (dictionary) => dictionary.key === selectedDictionary
      ) + 1;
    const nextKey = DICTIONARIES[nextIndex % DICTIONARIES.length].key;
    handleChangeDictionary(nextKey);
  }, [handleChangeDictionary, selectedDictionary]);

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">アナグラム検索</h1>
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="mb-4 relative">
              <Input
                type="text"
                id="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch(); // エンターキーが押されたときに検索を実行
                    return;
                  }
                  if (e.key === "/" && e.ctrlKey) {
                    e.preventDefault(); // ブラウザのデフォルト動作を防ぐ
                    nextDictionary();
                  }
                }}
                className="bg-gray-700 border-gray-600 text-white text-base"
                placeholder={AnagramManager.getPlaceholder(selectedDictionary)}
              />
              <p className="absolute text-gray-500 bottom-1 right-1 text-xs">
                {AnagramManager.getName(selectedDictionary)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                ？で任意の文字検索
                <span className="hidden md:inline">
                  　　「Ctrl + /」で辞書切り替え
                </span>
              </p>
            </div>
            <Accordion type="single" collapsible className="mb-4">
              <AccordionItem value="advanced-settings p-4">
                <AccordionTrigger className="text-sm text-gray-400 hover:text-gray-300 py-2">
                  詳細設定
                </AccordionTrigger>
                <AccordionContent>
                  <div className="mt-2 space-y-4 px-1">
                    <Select
                      value={selectedDictionary}
                      onValueChange={handleChangeDictionary}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="辞書を選択" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600 text-white">
                        {Object.entries(DICTIONARIES).map(([key, value]) => (
                          <SelectItem
                            key={value.key}
                            value={value.key}
                            className="focus:bg-gray-600"
                          >
                            {value.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-sm text-gray-400">
                      {AnagramManager.getDescription(selectedDictionary)}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <Button
              onClick={handleSearch}
              className="w-full bg-purple-400 hover:bg-purple-500 text-white"
            >
              検索
            </Button>
          </CardContent>
        </Card>
        <Card className="mt-6 bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-white">
              検索結果
              {results.length >= ANAGRAM_RESULT_MAXCOUNT && (
                <span className="text-purple-400 mb-4 inline text-sm ml-2 font-normal">
                  ※検索件数の上限を超え、先頭
                  <span className="font-semibold text-base">
                    {ANAGRAM_RESULT_MAXCOUNT}
                  </span>
                  件を表示しています。
                </span>
              )}
            </h2>
            {loading ? (
              <p className="text-gray-400">ローディング中...</p>
            ) : results.length > 0 ? (
              <ul className="space-y-2">
                {results.map((result, index) => (
                  <li
                    key={index}
                    className="bg-gray-700 p-2 rounded-md text-white"
                  >
                    {result}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">結果がありません</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
