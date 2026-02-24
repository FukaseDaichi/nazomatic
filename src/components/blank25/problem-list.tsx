"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3X3, RotateCcw } from "lucide-react";
import { fetchBlank25Manifest } from "@/components/blank25/manifest";
import type { Blank25Category } from "@/components/blank25/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Blank25ProblemList() {
  const router = useRouter();
  const [categories, setCategories] = useState<Blank25Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const rippleRef = useRef<HTMLDivElement | null>(null);

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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

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
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
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
      <p className="text-gray-300 mb-2">
        問題を選んで開始します。画像の上の 25
        パネル（5×5）を開きながら推理し、回答で正誤判定します。
      </p>
      <div className="mb-8 min-h-6">
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
        <div className="space-y-10">
          {categories.map((category) => (
            <section key={category.id}>
              <div className="flex items-center gap-2 mb-1">
                <Grid3X3
                  className="w-5 h-5"
                  style={{ color: category.color }}
                />
                <h3 className="text-xl font-bold text-gray-100">
                  {category.name}
                </h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                {category.description}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {category.problems.map((problem) => {
                  const number = problem.linkName.replace(/[^0-9]/g, "");
                  const isNavigating = navigatingId === problem.id;
                  return (
                    <button
                      key={problem.id}
                      type="button"
                      onClick={(e) =>
                        handleCardClick(problem.id, category.color, e)
                      }
                      disabled={navigatingId !== null}
                      className="text-left group block relative"
                      style={{ backgroundColor: category.color }}
                    >
                      <Card
                        className="bg-gray-800/80 border border-gray-700 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                        style={{
                          borderColor: undefined,
                          ["--cat-color" as string]: category.color,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = category.color;
                          e.currentTarget.style.boxShadow = `0 4px 20px ${category.color}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "";
                          e.currentTarget.style.boxShadow = "";
                        }}
                      >
                        <CardContent
                          className={[
                            "flex flex-col items-center gap-2 py-5 px-3 transition-opacity duration-300",
                            isNavigating ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          <span
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold text-white"
                            style={{ backgroundColor: category.color }}
                          >
                            {number}
                          </span>
                          <span className="text-gray-100 font-medium text-sm text-center">
                            {problem.linkName}
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
      )}

      <div ref={rippleRef} />
    </main>
  );
}
