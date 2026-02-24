"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, List, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { generateJsonLdArticle } from "@/components/common/generateJsonLdArticle";
import Blank25ClearDialog from "@/components/blank25/clear-dialog";
import {
  fireBlank25Confetti,
  type ConfettiCleanup,
} from "@/components/blank25/confetti";
import { fetchBlank25Manifest } from "@/components/blank25/manifest";
import type {
  Blank25PersistedStateV1,
  Blank25Problem,
} from "@/components/blank25/types";
import { normalizeBlank25Answer } from "@/components/blank25/answer-normalize";

const PANEL_COUNT = 25;

const createInitialPanels = (): boolean[] =>
  Array.from({ length: PANEL_COUNT }, () => false);

const storageKey = (manifestVersion: number, problemId: string) =>
  `blank25:v1:${manifestVersion}:${problemId}`;

const safeParsePersisted = (
  value: string | null,
): Blank25PersistedStateV1 | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1) return null;
    if (!Array.isArray(record.openedPanels)) return null;
    if (!Array.isArray(record.openedHistory)) return null;
    if (typeof record.startedAt !== "number") return null;
    if (typeof record.solvedAt !== "number" && record.solvedAt !== null)
      return null;
    if (typeof record.isCorrect !== "boolean") return null;
    if (typeof record.score !== "number" && record.score !== null) return null;

    const openedPanels = record.openedPanels;
    if (openedPanels.length !== PANEL_COUNT) return null;
    if (!openedPanels.every((v) => typeof v === "boolean")) return null;
    const openedHistory = record.openedHistory;
    if (!openedHistory.every((v) => typeof v === "number")) return null;

    return {
      version: 1,
      openedPanels: openedPanels as boolean[],
      openedHistory: openedHistory as number[],
      startedAt: record.startedAt as number,
      solvedAt: record.solvedAt as number | null,
      isCorrect: record.isCorrect as boolean,
      score: record.score as number | null,
    };
  } catch {
    return null;
  }
};

type JudgeStatus =
  | { type: "idle" }
  | { type: "correct"; score: number }
  | { type: "wrong" }
  | { type: "empty" };

export default function Blank25Game({ problemId }: { problemId: string }) {
  const [problem, setProblem] = useState<Blank25Problem | null>(null);
  const [manifestVersion, setManifestVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [openedPanels, setOpenedPanels] =
    useState<boolean[]>(createInitialPanels);
  const [openedHistory, setOpenedHistory] = useState<number[]>([]);
  const [answerInput, setAnswerInput] = useState("");
  const [judgeStatus, setJudgeStatus] = useState<JudgeStatus>({ type: "idle" });
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [solvedAt, setSolvedAt] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const confettiCleanupRef = useRef<ConfettiCleanup | null>(null);

  const openedCount = useMemo(
    () => openedPanels.reduce((acc, isOpened) => acc + (isOpened ? 1 : 0), 0),
    [openedPanels],
  );
  const remainingCount = PANEL_COUNT - openedCount;

  const acceptedAnswers = useMemo(() => {
    if (!problem) return new Set<string>();
    return new Set(problem.answers.map((a) => normalizeBlank25Answer(a)));
  }, [problem]);

  const reset = useCallback(() => {
    setOpenedPanels(createInitialPanels());
    setOpenedHistory([]);
    setAnswerInput("");
    setJudgeStatus({ type: "idle" });
    setStartedAt(Date.now());
    setSolvedAt(null);
    setScore(null);
    setIsCorrect(false);
    setIsClearDialogOpen(false);
  }, []);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const result = await fetchBlank25Manifest();
      if (canceled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setManifestVersion(result.manifest.version);
      const found =
        result.manifest.categories
          .flatMap((c) => c.problems)
          .find((p) => p.id === problemId) ?? null;
      if (!found) {
        setError(`指定された問題が見つかりません: ${problemId}`);
        return;
      }
      setProblem(found);
    })();

    return () => {
      canceled = true;
    };
  }, [problemId]);

  useEffect(() => {
    if (manifestVersion === null) return;
    const key = storageKey(manifestVersion, problemId);
    const persisted = safeParsePersisted(localStorage.getItem(key));
    if (!persisted) return;
    setOpenedPanels(persisted.openedPanels);
    setOpenedHistory(persisted.openedHistory);
    setStartedAt(persisted.startedAt);
    setSolvedAt(persisted.solvedAt);
    setScore(persisted.score);
    setIsCorrect(persisted.isCorrect);
    setJudgeStatus(
      persisted.isCorrect && typeof persisted.score === "number"
        ? { type: "correct", score: persisted.score }
        : { type: "idle" },
    );
  }, [manifestVersion, problemId]);

  useEffect(() => {
    return () => {
      confettiCleanupRef.current?.();
      confettiCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isClearDialogOpen) {
      return;
    }

    confettiCleanupRef.current?.();
    confettiCleanupRef.current = fireBlank25Confetti();

    return () => {
      confettiCleanupRef.current?.();
      confettiCleanupRef.current = null;
    };
  }, [isClearDialogOpen]);

  useEffect(() => {
    if (manifestVersion === null) return;
    const key = storageKey(manifestVersion, problemId);
    const value: Blank25PersistedStateV1 = {
      version: 1,
      openedPanels,
      openedHistory,
      startedAt,
      solvedAt,
      isCorrect,
      score,
    };
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore persistence errors
    }
  }, [
    manifestVersion,
    problemId,
    openedPanels,
    openedHistory,
    startedAt,
    solvedAt,
    isCorrect,
    score,
  ]);

  const openPanel = useCallback(
    (panelIndex: number) => {
      if (isCorrect) return;
      setOpenedPanels((prev) => {
        if (prev[panelIndex]) return prev;
        const next = [...prev];
        next[panelIndex] = true;
        return next;
      });
      setOpenedHistory((prev) => {
        const number = panelIndex + 1;
        if (prev.includes(number)) return prev;
        return [...prev, number];
      });
    },
    [isCorrect],
  );

  const judge = useCallback(() => {
    if (!problem) return;
    const normalized = normalizeBlank25Answer(answerInput);
    if (!normalized) {
      setJudgeStatus({ type: "empty" });
      return;
    }
    if (acceptedAnswers.has(normalized)) {
      const finalScore = remainingCount;
      setIsCorrect(true);
      setScore(finalScore);
      setSolvedAt(Date.now());
      setJudgeStatus({ type: "correct", score: finalScore });
      setIsClearDialogOpen(true);
      return;
    }
    setJudgeStatus({ type: "wrong" });
  }, [acceptedAnswers, answerInput, problem, remainingCount]);

  const imageUrl = problem ? `/img/blank25/${problem.imageFile}` : null;
  const jsonLd = useMemo(() => {
    if (!problem) return null;
    return generateJsonLdArticle({
      title: `BLANK25 - ${problem.linkName}`,
      description:
        "問題画像の上にある25パネルを開いて推理し、回答を入力して正誤判定するゲームです。",
      path: `/blank25/${encodeURIComponent(problem.id)}`,
    });
  }, [problem]);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {isCorrect && typeof score === "number" && (
        <Blank25ClearDialog
          open={isClearDialogOpen}
          onOpenChange={setIsClearDialogOpen}
          score={score}
          openedCount={openedCount}
        />
      )}
      {jsonLd && (
        <script
          key="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h2 className="text-3xl font-bold tracking-tight text-gray-100 truncate">
            {problem?.linkName ?? "BLANK25"}
          </h2>
          <div className="text-sm text-gray-400 truncate">ID: {problemId}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={reset}
            variant="outline"
            className="bg-white text-gray-900"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            リセット
          </Button>
          <Button asChild variant="outline" className="bg-white text-gray-900">
            <Link href="/blank25">
              <List className="w-4 h-4 mr-2" />
              一覧へ
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">エラー</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">{error}</CardContent>
        </Card>
      )}

      {!error && !problem && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">読み込み中</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">
            問題を取得しています。
          </CardContent>
        </Card>
      )}

      {problem && (
        <div className="grid gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-4">
              {imageUrl && (
                <div className="relative w-full max-w-xl mx-auto aspect-square overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt={problem.linkName}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 600px"
                    priority
                  />
                  <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 gap-0">
                    {openedPanels.map((isOpened, index) => {
                      const number = index + 1;
                      const hidden = isOpened;
                      const dimmed = isCorrect && !isOpened;
                      return (
                        <button
                          key={number}
                          type="button"
                          onClick={() => openPanel(index)}
                          disabled={hidden || isCorrect}
                          aria-label={`パネル ${number}`}
                          className={[
                            "border border-gray-300",
                            "select-none",
                            "transition-all duration-150",
                            hidden
                              ? "opacity-0 pointer-events-none"
                              : dimmed
                                ? "bg-black/50 text-white/70"
                                : "bg-black text-gray-100 hover:bg-gray-950",
                            "flex items-center justify-center",
                            "text-sm sm:text-base font-semibold",
                            "focus-visible:outline-none focus-visible:bg-purple-700 focus-visible:ring-2 focus-visible:ring-purple-400",
                          ].join(" ")}
                        >
                          {number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="text-gray-200">
                  <span className="font-semibold text-purple-300">
                    残り {remainingCount} / 25
                  </span>
                  <span className="text-gray-400 ml-3">開封 {openedCount}</span>
                </div>
              </div>

              <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-2">
                <Input
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder="回答を入力"
                  disabled={isCorrect}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      judge();
                    }
                  }}
                />
                <Button
                  onClick={judge}
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={isCorrect}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  判定
                </Button>
              </div>

              <div className="mt-2 min-h-6 text-sm">
                {judgeStatus.type === "empty" && (
                  <span className="text-gray-300">
                    回答を入力してください。
                  </span>
                )}
                {judgeStatus.type === "wrong" && (
                  <span className="text-red-300">不正解</span>
                )}
                {judgeStatus.type === "correct" && (
                  <span className="text-green-300">
                    正解！ スコア: {judgeStatus.score}
                  </span>
                )}
              </div>

              {isCorrect && (
                <div className="mt-2 text-xs text-gray-400">
                  解答時刻:{" "}
                  {solvedAt ? new Date(solvedAt).toLocaleString("ja-JP") : "-"}
                  {" / "}
                  開始: {new Date(startedAt).toLocaleString("ja-JP")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100">開封履歴</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              {openedHistory.length === 0 ? (
                <div className="text-gray-400">まだ開けていません。</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {openedHistory.map((n) => (
                    <span
                      key={n}
                      className="text-xs px-2 py-1 rounded-md bg-gray-700 text-gray-100"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
