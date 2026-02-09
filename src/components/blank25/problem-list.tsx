"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchBlank25Manifest } from "@/components/blank25/manifest";
import type { Blank25Problem } from "@/components/blank25/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Blank25ProblemList() {
  const [problems, setProblems] = useState<Blank25Problem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const result = await fetchBlank25Manifest();
      if (canceled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProblems(result.manifest.problems);
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    if (!problems) return null;
    return [...problems];
  }, [problems]);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold tracking-tight text-gray-100 mb-2">
        BLANK25
      </h2>
      <p className="text-gray-300 mb-6">
        問題を選んで開始します。画像の上の 25 パネル（5×5）を開きながら推理し、回答で正誤判定します。
      </p>

      {error && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">読み込みエラー</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">{error}</CardContent>
        </Card>
      )}

      {!error && !sorted && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">読み込み中</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">問題一覧を取得しています。</CardContent>
        </Card>
      )}

      {sorted && (
        <div className="grid gap-3">
          {sorted.map((problem) => (
            <Card
              key={problem.id}
              className="bg-gray-800 border-gray-700 hover:border-purple-500/60 transition-colors"
            >
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="text-gray-100 font-medium truncate">
                    {problem.linkName}
                  </div>
                  <div className="text-gray-400 text-sm truncate">
                    ID: {problem.id}
                  </div>
                </div>
                <Button asChild className="bg-purple-600 hover:bg-purple-700">
                  <Link href={`/blank25/${encodeURIComponent(problem.id)}`}>
                    開く
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

