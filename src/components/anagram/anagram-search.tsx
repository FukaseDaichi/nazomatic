"use client";

import { useCallback, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
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
  SearchManager,
  DICTIONARIES,
} from "@/class/SearchManager";
import { motion, AnimatePresence } from "framer-motion";

const FIRST_DIC = "buta";

const tabs = [
  {
    id: "tab1",
    label: "アナグラム",
    title: "アナグラム検索",
    tooltip: "入力を並び替えてできる文字を検索します。",
  },
  {
    id: "tab2",
    label: "クロスワード",
    title: "クロスワード検索",
    tooltip: "入力の？の部分に文字を入れて検索します。",
  },
];

export default function AnagramSearch() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [showTooltips, setShowTooltips] = useState<Array<Boolean>>(
    new Array(tabs.length).fill(false)
  );

  const [input, setInput] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [selectedDictionary, setSelectedDictionary] = useState(FIRST_DIC);
  const [searchManager, setSearchManager] = useState<SearchManager | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // ページトップへスクロール
    window.scrollTo(0, 0);
    const initializeAnagramManager = async () => {
      // 'buta'キーの辞書でAnagramManagerを作成
      const manager = await SearchManager.create(FIRST_DIC);
      setSearchManager(manager);
    };
    initializeAnagramManager();
  }, []);

  const handleSearch = useCallback(async () => {
    setLoading(true);

    switch (activeTab) {
      case "tab1":
        if (searchManager) {
          const result = await searchManager.findAnagramsAsync(input);
          setResults(result);
        }
        break;
      case "tab2":
        if (searchManager) {
          const result = await searchManager.findCrosswordAsync(input);
          setResults(result);
        }
        break;
      default:
    }
    setLoading(false);
  }, [searchManager, input, activeTab]);

  const handleChangeDictionary = useCallback(async (val: string) => {
    setSelectedDictionary(val);
    const manager = await SearchManager.create(val);
    setSearchManager(manager);
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
        {/* タブの部分 */}
        <div className="w-full">
          <motion.h1
            key={activeTab}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-2xl font-bold mb-6 text-center"
          >
            {tabs.find((tab) => tab.id === activeTab)?.title}
          </motion.h1>

          <div className="relative max-w-md">
            <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex justify-center items-center w-full py-1.5 text-sm font-medium rounded-md relative z-10 transition-colors duration-300 ${
                    activeTab === tab.id
                      ? "text-gray-900"
                      : "text-gray-300 hover:text-white"
                  }`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                >
                  {tab.label}
                  <div className="ml-4 flex items-center">
                    <span
                      onMouseEnter={() => {
                        setShowTooltips(
                          new Array(tabs.length)
                            .fill(false)
                            .map((_, i) => i === index)
                        );
                      }}
                      onMouseLeave={() =>
                        setShowTooltips(new Array(tabs.length).fill(false))
                      }
                      className="hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50 rounded-full"
                      aria-label="詳細情報"
                    >
                      <HelpCircle size={20} />
                    </span>
                    <AnimatePresence>
                      {showTooltips[index] && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-8 left-10 transform -translate-x-1/2 mt-3 px-4 py-2 bg-purple-200 text-gray-900 text-sm rounded-lg shadow-xl z-10 w-48 "
                        >
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-purple-200"></div>
                          {tabs.find((tab) => tab.id === activeTab)?.tooltip}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              ))}
            </div>
            <motion.div
              className="absolute left-0 top-0 bottom-0 bg-purple-400 rounded-md transition-all duration-300"
              style={{ width: `${100 / tabs.length}%` }}
              animate={{
                x: `${tabs.findIndex((tab) => tab.id === activeTab) * 100}%`,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>
        </div>
        {/* タブの部分終わり */}
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
                    handleSearch(); // エンターキーが押されたとき検索を実行
                    return;
                  }
                  if (e.key === "/" && e.ctrlKey) {
                    e.preventDefault(); // ブラウザのデフォルト動作を防ぐ
                    nextDictionary();
                  }
                }}
                className="bg-gray-700 border-gray-600 text-white text-base"
                placeholder={SearchManager.getPlaceholder(selectedDictionary)}
              />
              <p className="absolute text-gray-500 bottom-1 right-1 text-xs">
                {SearchManager.getName(selectedDictionary)}
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
                      {SearchManager.getDescription(selectedDictionary)}
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
              <p className="text-gray-400">ロ��ディング中...</p>
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
