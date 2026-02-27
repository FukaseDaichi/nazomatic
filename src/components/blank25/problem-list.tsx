"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3X3, RotateCcw, Search, X } from "lucide-react";
import { fetchBlank25Manifest } from "@/components/blank25/manifest";
import type { Blank25Category } from "@/components/blank25/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Blank25ProblemList() {
  const router = useRouter();
  const [categories, setCategories] = useState<Blank25Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const resetAllProblems = useCallback(() => {
    const confirmed = window.confirm(
      "BLANK25の保存データをすべてリセットします。よろしいですか？",
    );
    if (!confirmed) return;

    try {
      const keys: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith("blank25:v")) {
          keys.push(key);
        }
      }
      keys.forEach((key) => localStorage.removeItem(key));
      setResetMessage(`${keys.length}件の保存データをリセットしました。`);
    } catch {
      setResetMessage(
        "保存データのリセットに失敗しました。時間をおいて再試行してください。",
      );
    }
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
      setCategories(result.manifest.categories);
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const totalProblems = useMemo(
    () =>
      categories?.reduce((count, category) => count + category.problems.length, 0) ??
      0,
    [categories],
  );

  const categorySections = useMemo(() => {
    if (!categories) return [];

    const normalizedQuery = searchQuery.trim().toLowerCase();
    return categories
      .map((category) => {
        const filteredProblems = normalizedQuery
          ? category.problems.filter((problem) => {
              const searchableText =
                `${category.name} ${category.description} ${problem.linkName} ${problem.id}`.toLowerCase();
              return searchableText.includes(normalizedQuery);
            })
          : category.problems;

        return {
          category,
          problems: filteredProblems,
          totalCount: category.problems.length,
        };
      })
      .filter((section) => section.problems.length > 0);
  }, [categories, searchQuery]);

  const filteredProblemCount = useMemo(
    () =>
      categorySections.reduce(
        (count, section) => count + section.problems.length,
        0,
      ),
    [categorySections],
  );

  const handleCardClick = useCallback(
    (
      problemId: string,
      color: string,
      e: React.MouseEvent<HTMLButtonElement>,
    ) => {
      if (navigatingId) return;
      setNavigatingId(problemId);

      const card = e.currentTarget;
      const rect = card.getBoundingClientRect();
      const x = e.clientX === 0 ? rect.width / 2 : e.clientX - rect.left;
      const y = e.clientY === 0 ? rect.height / 2 : e.clientY - rect.top;

      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height) * 2.5;
      Object.assign(ripple.style, {
        position: "absolute",
        left: `${x - size / 2}px`,
        top: `${y - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: color,
        opacity: "0.4",
        transform: "scale(0)",
        pointerEvents: "none",
        zIndex: "10",
      });
      card.style.position = "relative";
      card.style.overflow = "hidden";
      card.appendChild(ripple);

      requestAnimationFrame(() => {
        Object.assign(ripple.style, {
          transition: "transform 0.5s ease-out, opacity 0.5s ease-out",
          transform: "scale(1)",
          opacity: "0",
        });
      });

      setTimeout(() => {
        router.push(`/blank25/${encodeURIComponent(problemId)}`);
      }, 350);
    },
    [navigatingId, router],
  );

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <h2 className="text-3xl font-bold tracking-tight text-gray-100">
          BLANK25
        </h2>
        <Button
          type="button"
          variant="outline"
          className="bg-white text-gray-900"
          onClick={resetAllProblems}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          全問題をリセット
        </Button>
      </div>
      <p className="text-gray-300 mb-3">
        問題を選んで開始します。画像の上の 25
        パネル（5×5）を開きながら推理し、回答で正誤判定します。
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <span className="rounded-full bg-gray-700 px-2 py-1 text-gray-200">
          カテゴリ {categories?.length ?? 0}
        </span>
        <span className="rounded-full bg-gray-700 px-2 py-1 text-gray-200">
          問題 {totalProblems}
        </span>
        {searchQuery.trim() && (
          <span className="rounded-full bg-blue-700/60 px-2 py-1 text-blue-100">
            検索結果 {filteredProblemCount}
          </span>
        )}
      </div>
      <div className="mb-3 min-h-6">
        {resetMessage && (
          <p className="text-sm text-gray-300">{resetMessage}</p>
        )}
      </div>

      {error && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">読み込みエラー</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">{error}</CardContent>
        </Card>
      )}

      {!error && !categories && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">読み込み中</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">
            問題一覧を取得しています。
          </CardContent>
        </Card>
      )}

      {categories && (
        <div className="space-y-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="問題名 / ID / カテゴリ名で絞り込み"
              className="bg-gray-800 border-gray-700 pl-9 pr-10 text-gray-100 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                aria-label="検索条件をクリア"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {categorySections.length === 0 && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100">該当なし</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300">
                条件に一致する問題がありません。検索語を変更してください。
              </CardContent>
            </Card>
          )}

          <div className="space-y-10">
            {categorySections.map(({ category, problems, totalCount }) => (
              <section key={category.id}>
                <div className="mb-1 flex items-center gap-2">
                  <Grid3X3
                    className="h-5 w-5"
                    style={{ color: category.color }}
                  />
                  <h3 className="text-xl font-bold text-gray-100">
                    {category.name}
                  </h3>
                  <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-200">
                    {problems.length}
                    {searchQuery.trim() ? ` / ${totalCount}` : ""} 問
                  </span>
                </div>
                <p className="mb-4 text-sm text-gray-400">
                  {category.description}
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {problems.map((problem) => {
                    const number = problem.linkName.replace(/[^0-9]/g, "");
                    const isNavigating = navigatingId === problem.id;
                    return (
                      <button
                        key={problem.id}
                        type="button"
                        onClick={(e) =>
                          handleCardClick(problem.id, category.color, e)
                        }
                        className={[
                          "group relative block w-full cursor-pointer rounded-xl text-left transition-all duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900",
                          isNavigating ? "scale-[0.98]" : "hover:-translate-y-0.5",
                          navigatingId && !isNavigating ? "opacity-70" : "",
                        ].join(" ")}
                        aria-label={`${problem.linkName} を開く`}
                      >
                        <Card className="h-full cursor-pointer border border-gray-700 bg-gray-800/85 transition-all duration-200 group-hover:border-gray-500 group-hover:shadow-lg group-hover:shadow-black/40">
                          <CardContent
                            className={[
                              "relative flex h-full cursor-pointer flex-col items-center gap-1 px-3 py-5 transition-opacity duration-300",
                              isNavigating ? "opacity-50" : "",
                            ].join(" ")}
                          >
                            <span
                              className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
                              style={{ backgroundColor: category.color }}
                            />
                            <span
                              className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                              style={{ backgroundColor: category.color }}
                            >
                              {number || "?"}
                            </span>
                            <span className="text-center text-sm font-medium text-gray-100">
                              {problem.linkName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {problem.id}
                            </span>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
