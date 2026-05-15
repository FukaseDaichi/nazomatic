"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, HelpCircle, ListFilter, Plus, Settings2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { DICTIONARIES, SearchManager } from "@/class/SearchManager";
import { Badge } from "@/components/ui/badge";
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
import {
  CHARACTER_PICK_RESULT_MAXCOUNT,
  runCharacterPickSearch,
  type CharacterPickSearchResult,
} from "@/lib/character-pick-search";

const FIRST_DIC = "buta";
const MAX_REGISTERED_WORDS = 10;
const DELETE_REVEAL_WIDTH = 88;

type PickMode = "single" | "range";

type RegisteredWord = {
  id: string;
  value: string;
};

const createWordId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const toNonNegativeInteger = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
};

function RegisteredWordRow({
  entry,
  index,
  isOpen,
  onDelete,
  onOpenChange,
}: {
  entry: RegisteredWord;
  index: number;
  isOpen: boolean;
  onDelete: () => void;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <li className="group relative overflow-hidden rounded-lg border border-gray-700 bg-red-500/95">
      <button
        type="button"
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-red-500 text-sm font-semibold text-white transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
        aria-label={`${entry.value}を削除`}
      >
        削除
      </button>
      <motion.div
        drag="x"
        dragConstraints={{ left: -DELETE_REVEAL_WIDTH, right: 0 }}
        dragElastic={0.03}
        onDragEnd={(_, info) => {
          onOpenChange(info.offset.x < -36);
        }}
        animate={{ x: isOpen ? -DELETE_REVEAL_WIDTH : 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative flex min-h-[48px] touch-pan-y items-center gap-3 bg-gray-700 px-3 py-2 text-white"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-purple-300">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 break-all text-base font-medium">
          {entry.value}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-300 opacity-0 transition hover:bg-gray-600 hover:text-red-200 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label={`${entry.value}を削除`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </motion.div>
    </li>
  );
}

export default function CharacterPickSearch() {
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<RegisteredWord[]>([]);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [mode, setMode] = useState<PickMode>("single");
  const [minPick, setMinPick] = useState(1);
  const [maxPick, setMaxPick] = useState(1);
  const [selectedDictionary, setSelectedDictionary] = useState(FIRST_DIC);
  const [searchManager, setSearchManager] = useState<SearchManager | null>(
    null,
  );
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [results, setResults] = useState<CharacterPickSearchResult[]>([]);
  const [limitReached, setLimitReached] = useState(false);
  const [normalizedSources, setNormalizedSources] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const dictionaryRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);

  const activeMinPick = mode === "single" ? 1 : minPick;
  const activeMaxPick = mode === "single" ? 1 : maxPick;
  const sourceWords = useMemo(
    () => entries.map((entry) => entry.value),
    [entries],
  );

  const loadDictionary = useCallback(
    async (
      dictionaryKey: string,
      options: { updateSelection?: boolean } = {},
    ) => {
      const { updateSelection = true } = options;
      if (updateSelection) {
        setSelectedDictionary(dictionaryKey);
      }

      setDictionaryLoading(true);
      setSearchManager(null);
      setSearchMessage(null);
      setResults([]);
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
          setSearchMessage(message);
          setSearchManager(null);
          setResults([]);
        }
      } finally {
        if (dictionaryRequestIdRef.current === requestId) {
          setDictionaryLoading(false);
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

  useEffect(() => {
    if (!searchManager) {
      return;
    }

    if (entries.length === 0) {
      setResults([]);
      setLimitReached(false);
      setNormalizedSources([]);
      setSearchMessage(null);
      setSearchLoading(false);
      return;
    }

    if (activeMinPick > activeMaxPick) {
      setResults([]);
      setLimitReached(false);
      setSearchMessage("最小は最大以下にしてください。");
      setSearchLoading(false);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    setSearchLoading(true);
    setSearchMessage(null);
    setLimitReached(false);

    runCharacterPickSearch({
      sourceWords,
      dictionaryWords: searchManager.getWords(),
      minPick: activeMinPick,
      maxPick: activeMaxPick,
    })
      .then((outcome) => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }
        setNormalizedSources(outcome.normalizedSources);
        setResults(outcome.results);
        setLimitReached(outcome.limitReached);
      })
      .catch((error) => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : "検索中にエラーが発生しました。";
        setSearchMessage(message);
        setResults([]);
        setLimitReached(false);
      })
      .finally(() => {
        if (searchRequestIdRef.current === requestId) {
          setSearchLoading(false);
        }
      });
  }, [activeMaxPick, activeMinPick, entries.length, searchManager, sourceWords]);

  const handleAddWord = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setInputMessage("単語を入力してください。");
      return;
    }
    if (entries.length >= MAX_REGISTERED_WORDS) {
      setInputMessage("登録できる単語は10個までです。");
      return;
    }

    setEntries((current) => [
      ...current,
      {
        id: createWordId(),
        value: trimmed,
      },
    ]);
    setInput("");
    setInputMessage(null);
  }, [entries.length, input]);

  const handleDeleteWord = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setOpenEntryId(null);
    setInputMessage(null);
  }, []);

  const handleModeChange = (nextMode: PickMode) => {
    setMode(nextMode);
    if (nextMode === "single") {
      setMinPick(1);
      setMaxPick(1);
    }
  };

  const handleChangeDictionary = useCallback(
    (value: string) => {
      loadDictionary(value);
    },
    [loadDictionary],
  );

  const canAddWord =
    input.trim().length > 0 && entries.length < MAX_REGISTERED_WORDS;
  const hasSearchCondition = entries.length > 0;
  const isBusy = dictionaryLoading || searchLoading;

  return (
    <main className="min-h-screen px-4 pb-10 pt-3 sm:px-6 sm:pt-6">
      <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center text-2xl font-bold"
        >
          文字拾い検索
        </motion.h1>

        <Card className="border-gray-700/90 bg-gray-800/95 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <ListFilter className="h-5 w-5 text-purple-300" />
              検索条件
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label
                  htmlFor="character-pick-word"
                  className="text-xs font-semibold uppercase text-gray-300"
                >
                  単語入力
                </Label>
                <Input
                  id="character-pick-word"
                  type="text"
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    setInputMessage(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleAddWord();
                    }
                  }}
                  className="h-10 border-gray-600 bg-gray-700/90 text-base text-white focus-visible:ring-purple-400 focus-visible:ring-offset-gray-900"
                  placeholder={
                    SearchManager.getType(selectedDictionary) === "en"
                      ? "例：stone"
                      : "例：なぞとき"
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={handleAddWord}
                  disabled={!canAddWord}
                  className="h-10 w-full gap-2 rounded-lg bg-purple-400 px-4 text-sm font-semibold text-gray-900 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-400 sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  追加
                </Button>
              </div>
            </div>
            {inputMessage && (
              <p className="text-sm text-red-300" role="alert">
                {inputMessage}
              </p>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-200">
                    登録済み単語
                  </h2>
                  <Badge className="border-gray-600 bg-gray-900 text-gray-100">
                    {entries.length}/{MAX_REGISTERED_WORDS}
                  </Badge>
                </div>
                {entries.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-600 bg-gray-900/45 px-3 py-4 text-sm text-gray-400">
                    単語を追加してください
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {entries.map((entry, index) => (
                      <RegisteredWordRow
                        key={entry.id}
                        entry={entry}
                        index={index}
                        isOpen={openEntryId === entry.id}
                        onDelete={() => handleDeleteWord(entry.id)}
                        onOpenChange={(nextOpen) =>
                          setOpenEntryId(nextOpen ? entry.id : null)
                        }
                      />
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3 rounded-lg border border-gray-700 bg-gray-900/45 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <Settings2 className="h-4 w-4 text-purple-300" />
                    文字の拾い方
                  </h2>
                  <div
                    className="relative"
                    onMouseEnter={() => setShowHelp(true)}
                    onMouseLeave={() => setShowHelp(false)}
                  >
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition hover:text-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                      aria-label="文字の拾い方の説明"
                      aria-expanded={showHelp}
                      onFocus={() => setShowHelp(true)}
                      onBlur={() => setShowHelp(false)}
                      onClick={() => setShowHelp((current) => !current)}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                    {showHelp && (
                      <div className="absolute right-0 z-20 mt-2 w-[min(82vw,22rem)] rounded-lg border border-gray-600 bg-gray-950 p-3 text-sm leading-relaxed text-gray-100 shadow-xl">
                        <p>
                          最小と最大は、各登録語から拾う文字数です。0を含めると、その単語を使わない候補も探します。
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-800 p-1">
                  <button
                    type="button"
                    onClick={() => handleModeChange("single")}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      mode === "single"
                        ? "bg-purple-400 text-gray-950"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    1文字ずつ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange("range")}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      mode === "range"
                        ? "bg-purple-400 text-gray-950"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    幅指定
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="min-pick"
                      className="text-xs font-semibold uppercase text-gray-300"
                    >
                      最小
                    </Label>
                    <Input
                      id="min-pick"
                      type="number"
                      min={0}
                      value={activeMinPick}
                      disabled={mode === "single"}
                      onChange={(event) => {
                        setMode("range");
                        setMinPick(toNonNegativeInteger(event.target.value));
                      }}
                      className="h-10 border-gray-600 bg-gray-700/90 text-base text-white focus-visible:ring-purple-400 disabled:opacity-70"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="max-pick"
                      className="text-xs font-semibold uppercase text-gray-300"
                    >
                      最大
                    </Label>
                    <Input
                      id="max-pick"
                      type="number"
                      min={0}
                      value={activeMaxPick}
                      disabled={mode === "single"}
                      onChange={(event) => {
                        setMode("range");
                        setMaxPick(toNonNegativeInteger(event.target.value));
                      }}
                      className="h-10 border-gray-600 bg-gray-700/90 text-base text-white focus-visible:ring-purple-400 disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-gray-300">
                    辞書
                  </Label>
                  <Select
                    value={selectedDictionary}
                    onValueChange={handleChangeDictionary}
                  >
                    <SelectTrigger className="h-10 border-gray-600 bg-gray-700/90 text-white focus:ring-purple-400">
                      <SelectValue placeholder="辞書を選択" />
                    </SelectTrigger>
                    <SelectContent className="border-gray-600 bg-gray-700 text-white">
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
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700/90 bg-gray-800/95 shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-xl text-white">検索結果</CardTitle>
              <Badge className="border-gray-600 bg-gray-900 text-gray-100">
                {results.length}件
              </Badge>
            </div>
            {normalizedSources.length > 0 && (
              <p className="text-xs text-gray-400">
                正規化: {normalizedSources.join(" / ")}
              </p>
            )}
            {limitReached && (
              <p className="text-sm text-purple-300">
                結果上限に達したため先頭{CHARACTER_PICK_RESULT_MAXCOUNT}
                件を表示しています。
              </p>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            {isBusy ? (
              <p className="text-gray-400">検索中...</p>
            ) : searchMessage ? (
              <p className="text-red-300" role="alert">
                {searchMessage}
              </p>
            ) : !hasSearchCondition ? (
              <p className="text-gray-400">単語を追加してください</p>
            ) : results.length === 0 ? (
              <p className="text-gray-400">該当する単語がありません</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {results.map((result) => (
                  <li
                    key={result.word}
                    className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-700/70 px-3 py-2 text-white"
                  >
                    <span className="min-w-0 break-all text-base font-semibold">
                      {result.word}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {result.length}
                    </span>
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
