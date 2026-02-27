"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  Blank25SakumonPersistedStateV1,
  Blank25SakumonPhase,
} from "@/components/blank25/types";
import { normalizeBlank25Answer } from "@/components/blank25/answer-normalize";

const PANEL_COUNT = 25;

const createInitialPanels = (): boolean[] =>
  Array.from({ length: PANEL_COUNT }, () => false);

type Blank25Mode = "normal" | "sakumon";

const normalStorageKey = (manifestVersion: number, problemId: string) =>
  `blank25:v1:${manifestVersion}:${problemId}`;

const sakumonStorageKey = (manifestVersion: number, problemId: string) =>
  `blank25:sakumon:v1:${manifestVersion}:${problemId}`;

const safeParseNormalPersisted = (
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

const safeParseSakumonPersisted = (
  value: string | null,
): Blank25SakumonPersistedStateV1 | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;

    const record = parsed as Record<string, unknown>;
    if (record.version !== 1) return null;
    if (
      record.phase !== "draft" &&
      record.phase !== "locked" &&
      record.phase !== "solved"
    ) {
      return null;
    }
    if (!Array.isArray(record.hiddenPanels)) return null;
    if (typeof record.lockedAt !== "number" && record.lockedAt !== null)
      return null;
    if (typeof record.startedAt !== "number") return null;
    if (typeof record.solvedAt !== "number" && record.solvedAt !== null)
      return null;
    if (typeof record.isCorrect !== "boolean") return null;
    if (typeof record.score !== "number" && record.score !== null) return null;

    const hiddenPanels = record.hiddenPanels;
    if (hiddenPanels.length !== PANEL_COUNT) return null;
    if (!hiddenPanels.every((v) => typeof v === "boolean")) return null;

    return {
      version: 1,
      phase: record.phase as Blank25SakumonPhase,
      hiddenPanels: hiddenPanels as boolean[],
      lockedAt: record.lockedAt as number | null,
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
  | { type: "empty" }
  | { type: "needLock" };

export default function Blank25Game({ problemId }: { problemId: string }) {
  const searchParams = useSearchParams();
  const currentMode: Blank25Mode =
    searchParams.get("mode") === "sakumon" ? "sakumon" : "normal";
  const isSakumonMode = currentMode === "sakumon";

  const [problem, setProblem] = useState<Blank25Problem | null>(null);
  const [manifestVersion, setManifestVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [openedPanels, setOpenedPanels] =
    useState<boolean[]>(createInitialPanels);
  const [openedHistory, setOpenedHistory] = useState<number[]>([]);

  const [hiddenPanels, setHiddenPanels] =
    useState<boolean[]>(createInitialPanels);
  const [sakumonPhase, setSakumonPhase] =
    useState<Blank25SakumonPhase>("draft");
  const [lockedAt, setLockedAt] = useState<number | null>(null);

  const [answerInput, setAnswerInput] = useState("");
  const [judgeStatus, setJudgeStatus] = useState<JudgeStatus>({ type: "idle" });
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [solvedAt, setSolvedAt] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);
  const confettiCleanupRef = useRef<ConfettiCleanup | null>(null);

  const openedCount = useMemo(
    () => openedPanels.reduce((acc, isOpened) => acc + (isOpened ? 1 : 0), 0),
    [openedPanels],
  );
  const remainingCount = PANEL_COUNT - openedCount;

  const hiddenCount = useMemo(
    () => hiddenPanels.reduce((acc, isHidden) => acc + (isHidden ? 1 : 0), 0),
    [hiddenPanels],
  );
  const visibleCount = PANEL_COUNT - hiddenCount;

  const hiddenNumbers = useMemo(
    () =>
      hiddenPanels
        .map((isHidden, index) => (isHidden ? index + 1 : null))
        .filter((n): n is number => n !== null),
    [hiddenPanels],
  );

  const acceptedAnswers = useMemo(() => {
    if (!problem) return new Set<string>();
    return new Set(problem.answers.map((a) => normalizeBlank25Answer(a)));
  }, [problem]);

  const persistenceScope = useMemo(() => {
    if (manifestVersion === null) return null;
    return `${currentMode}:${manifestVersion}:${problemId}`;
  }, [currentMode, manifestVersion, problemId]);

  const normalReset = useCallback(() => {
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

  const sakumonReset = useCallback(() => {
    setHiddenPanels(createInitialPanels());
    setSakumonPhase("draft");
    setLockedAt(null);
    setAnswerInput("");
    setJudgeStatus({ type: "idle" });
    setStartedAt(Date.now());
    setSolvedAt(null);
    setScore(null);
    setIsCorrect(false);
    setIsClearDialogOpen(false);
  }, []);

  const reset = useCallback(() => {
    if (isSakumonMode) {
      sakumonReset();
      return;
    }
    normalReset();
  }, [isSakumonMode, normalReset, sakumonReset]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setError(null);
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
    if (manifestVersion === null || persistenceScope === null) return;

    setHydratedScope(null);
    const now = Date.now();

    if (currentMode === "sakumon") {
      const key = sakumonStorageKey(manifestVersion, problemId);
      const persisted = safeParseSakumonPersisted(localStorage.getItem(key));

      if (persisted) {
        const normalizedPhase: Blank25SakumonPhase = persisted.isCorrect
          ? "solved"
          : persisted.phase;
        setHiddenPanels(persisted.hiddenPanels);
        setSakumonPhase(normalizedPhase);
        setLockedAt(persisted.lockedAt);
        setStartedAt(persisted.startedAt);
        setSolvedAt(persisted.solvedAt);
        setScore(persisted.score);
        setIsCorrect(persisted.isCorrect);
        setJudgeStatus(
          persisted.isCorrect && typeof persisted.score === "number"
            ? { type: "correct", score: persisted.score }
            : { type: "idle" },
        );
      } else {
        setHiddenPanels(createInitialPanels());
        setSakumonPhase("draft");
        setLockedAt(null);
        setStartedAt(now);
        setSolvedAt(null);
        setScore(null);
        setIsCorrect(false);
        setJudgeStatus({ type: "idle" });
      }

      setOpenedPanels(createInitialPanels());
      setOpenedHistory([]);
    } else {
      const key = normalStorageKey(manifestVersion, problemId);
      const persisted = safeParseNormalPersisted(localStorage.getItem(key));

      if (persisted) {
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
      } else {
        setOpenedPanels(createInitialPanels());
        setOpenedHistory([]);
        setStartedAt(now);
        setSolvedAt(null);
        setScore(null);
        setIsCorrect(false);
        setJudgeStatus({ type: "idle" });
      }

      setHiddenPanels(createInitialPanels());
      setSakumonPhase("draft");
      setLockedAt(null);
    }

    setAnswerInput("");
    setIsClearDialogOpen(false);
    setHydratedScope(persistenceScope);
  }, [currentMode, manifestVersion, persistenceScope, problemId]);

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
    if (
      manifestVersion === null ||
      persistenceScope === null ||
      hydratedScope !== persistenceScope
    ) {
      return;
    }

    try {
      if (currentMode === "sakumon") {
        const key = sakumonStorageKey(manifestVersion, problemId);
        const value: Blank25SakumonPersistedStateV1 = {
          version: 1,
          phase: sakumonPhase,
          hiddenPanels,
          lockedAt,
          startedAt,
          solvedAt,
          isCorrect,
          score,
        };
        localStorage.setItem(key, JSON.stringify(value));
      } else {
        const key = normalStorageKey(manifestVersion, problemId);
        const value: Blank25PersistedStateV1 = {
          version: 1,
          openedPanels,
          openedHistory,
          startedAt,
          solvedAt,
          isCorrect,
          score,
        };
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // ignore persistence errors
    }
  }, [
    currentMode,
    hydratedScope,
    hiddenPanels,
    isCorrect,
    lockedAt,
    manifestVersion,
    openedHistory,
    openedPanels,
    persistenceScope,
    problemId,
    sakumonPhase,
    score,
    solvedAt,
    startedAt,
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

  const toggleHiddenPanel = useCallback(
    (panelIndex: number) => {
      if (sakumonPhase !== "draft") return;
      setHiddenPanels((prev) => {
        const next = [...prev];
        next[panelIndex] = !next[panelIndex];
        return next;
      });
    },
    [sakumonPhase],
  );

  const lockSakumon = useCallback(() => {
    if (sakumonPhase !== "draft") return;

    const confirmed = window.confirm(
      "隠し配置をロックします。ロック後は作問やり直しまで編集できません。よろしいですか？",
    );
    if (!confirmed) return;

    setSakumonPhase("locked");
    setLockedAt(Date.now());
    setJudgeStatus({ type: "idle" });
  }, [sakumonPhase]);

  const judge = useCallback(() => {
    if (!problem) return;

    if (isSakumonMode && sakumonPhase === "draft") {
      setJudgeStatus({ type: "needLock" });
      return;
    }

    const normalized = normalizeBlank25Answer(answerInput);
    if (!normalized) {
      setJudgeStatus({ type: "empty" });
      return;
    }

    if (acceptedAnswers.has(normalized)) {
      const finalScore = isSakumonMode ? visibleCount : remainingCount;
      setIsCorrect(true);
      setScore(finalScore);
      setSolvedAt(Date.now());
      setJudgeStatus({ type: "correct", score: finalScore });
      setIsClearDialogOpen(true);
      if (isSakumonMode) {
        setSakumonPhase("solved");
      }
      return;
    }

    setJudgeStatus({ type: "wrong" });
  }, [
    acceptedAnswers,
    answerInput,
    isSakumonMode,
    problem,
    remainingCount,
    sakumonPhase,
    visibleCount,
  ]);

  const canSubmitAnswer =
    !isCorrect && (!isSakumonMode || sakumonPhase !== "draft");

  const sakumonPhaseLabel = useMemo(() => {
    if (sakumonPhase === "draft") return "作問中";
    if (sakumonPhase === "locked") return "ロック済み";
    return "正解済み";
  }, [sakumonPhase]);

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

  const problemPath = `/blank25/${encodeURIComponent(problemId)}`;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {isCorrect && typeof score === "number" && (
        <Blank25ClearDialog
          open={isClearDialogOpen}
          onOpenChange={setIsClearDialogOpen}
          score={score}
          openedCount={isSakumonMode ? hiddenCount : openedCount}
          countLabel={isSakumonMode ? "隠し" : "開封"}
        />
      )}
      {jsonLd && (
        <script
          key="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-3xl font-bold tracking-tight text-gray-100">
            {problem?.linkName ?? "BLANK25"}
          </h2>
          <div className="truncate text-sm text-gray-400">ID: {problemId}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className={
                isSakumonMode
                  ? "bg-white text-gray-900"
                  : "border-purple-500 bg-purple-600 text-white hover:bg-purple-700"
              }
            >
              <Link href={problemPath}>通常モード</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className={
                isSakumonMode
                  ? "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-white text-gray-900"
              }
            >
              <Link href={`${problemPath}?mode=sakumon`}>作問モード</Link>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {!isSakumonMode && (
              <Button
                onClick={reset}
                variant="outline"
                className="bg-white text-gray-900"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                リセット
              </Button>
            )}
            <Button asChild variant="outline" className="bg-white text-gray-900">
              <Link href="/blank25">
                <List className="mr-2 h-4 w-4" />
                一覧へ
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-100">エラー</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">{error}</CardContent>
        </Card>
      )}

      {!error && !problem && (
        <Card className="border-gray-700 bg-gray-800">
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
          <Card className="border-gray-700 bg-gray-800">
            <CardContent className="py-4">
              {imageUrl && (
                <div className="relative mx-auto aspect-square w-full max-w-xl overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt={problem.linkName}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 600px"
                    priority
                  />
                  <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 gap-0">
                    {(isSakumonMode ? hiddenPanels : openedPanels).map((_, index) => {
                      const number = index + 1;

                      if (!isSakumonMode) {
                        const isOpened = openedPanels[index];
                        const dimmed = isCorrect && !isOpened;
                        return (
                          <button
                            key={number}
                            type="button"
                            onClick={() => openPanel(index)}
                            disabled={isOpened || isCorrect}
                            aria-label={`パネル ${number}`}
                            className={[
                              "flex select-none items-center justify-center",
                              "border border-gray-300 text-sm font-semibold sm:text-base",
                              "transition-all duration-150",
                              isOpened
                                ? "pointer-events-none opacity-0"
                                : dimmed
                                  ? "bg-black/50 text-white/70"
                                  : "bg-black text-gray-100 hover:bg-gray-950",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:bg-purple-700",
                            ].join(" ")}
                          >
                            {number}
                          </button>
                        );
                      }

                      const isHidden = hiddenPanels[index];
                      const isEditable = sakumonPhase === "draft";

                      return (
                        <button
                          key={number}
                          type="button"
                          onClick={() => toggleHiddenPanel(index)}
                          disabled={!isEditable}
                          aria-label={`マス ${number}`}
                          className={[
                            "flex select-none items-center justify-center",
                            "border text-sm font-semibold sm:text-base",
                            "transition-all duration-150",
                            isHidden
                              ? "border-gray-300 bg-black text-gray-100"
                              : isEditable
                                ? "border-white/30 bg-transparent text-transparent hover:bg-black/45 hover:text-gray-100"
                                : "cursor-default border-transparent bg-transparent text-transparent",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:bg-black/60",
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

          <Card className="border-gray-700 bg-gray-800">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {!isSakumonMode && (
                  <div className="text-gray-200">
                    <span className="font-semibold text-purple-300">
                      残り {remainingCount} / 25
                    </span>
                    <span className="ml-3 text-gray-400">開封 {openedCount}</span>
                  </div>
                )}

                {isSakumonMode && (
                  <div className="flex flex-wrap items-center gap-3 text-gray-200">
                    <span className="font-semibold text-emerald-300">
                      隠し {hiddenCount} / 25
                    </span>
                    <span className="text-gray-400">表示 {visibleCount}</span>
                    <span className="rounded-full bg-emerald-900/70 px-2 py-1 text-xs text-emerald-100">
                      {sakumonPhaseLabel}
                    </span>
                  </div>
                )}
              </div>

              {isSakumonMode && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={lockSakumon}
                    disabled={sakumonPhase !== "draft"}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    ロック
                  </Button>
                  <Button
                    onClick={sakumonReset}
                    variant="outline"
                    className="bg-white text-gray-900"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    作問やり直し
                  </Button>
                </div>
              )}

              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder="回答を入力"
                  disabled={!canSubmitAnswer}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (canSubmitAnswer) {
                        judge();
                      }
                    }
                  }}
                />
                <Button
                  onClick={judge}
                  disabled={!canSubmitAnswer}
                  className={
                    isSakumonMode
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-purple-600 hover:bg-purple-700"
                  }
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  判定
                </Button>
              </div>

              <div className="mt-2 min-h-6 text-sm">
                {judgeStatus.type === "needLock" && (
                  <span className="text-amber-200">
                    先に盤面をロックしてから判定してください。
                  </span>
                )}
                {judgeStatus.type === "empty" && (
                  <span className="text-gray-300">回答を入力してください。</span>
                )}
                {judgeStatus.type === "wrong" && (
                  <span className="text-red-300">不正解</span>
                )}
                {judgeStatus.type === "correct" && (
                  <span className="text-green-300">
                    正解！ スコア: {judgeStatus.score}
                  </span>
                )}
                {isSakumonMode &&
                  sakumonPhase === "draft" &&
                  judgeStatus.type === "idle" && (
                    <span className="text-amber-200">
                      ロック後に回答入力と判定が有効になります。
                    </span>
                  )}
              </div>

              {isSakumonMode && lockedAt && (
                <div className="mt-2 text-xs text-gray-400">
                  ロック時刻: {new Date(lockedAt).toLocaleString("ja-JP")}
                </div>
              )}

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

          <Card className="border-gray-700 bg-gray-800">
            <CardHeader>
              <CardTitle className="text-gray-100">
                {isSakumonMode ? "隠しマス" : "開封履歴"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              {!isSakumonMode && openedHistory.length === 0 && (
                <div className="text-gray-400">まだ開けていません。</div>
              )}
              {isSakumonMode && hiddenNumbers.length === 0 && (
                <div className="text-gray-400">まだ隠していません。</div>
              )}
              {!isSakumonMode && openedHistory.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {openedHistory.map((n) => (
                    <span
                      key={n}
                      className="rounded-md bg-gray-700 px-2 py-1 text-xs text-gray-100"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              )}
              {isSakumonMode && hiddenNumbers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hiddenNumbers.map((n) => (
                    <span
                      key={n}
                      className="rounded-md bg-gray-700 px-2 py-1 text-xs text-gray-100"
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
