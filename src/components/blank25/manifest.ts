import type { Blank25Manifest } from "@/components/blank25/types";

type ManifestResult =
  | { ok: true; manifest: Blank25Manifest }
  | { ok: false; error: string };

type ManifestApiResponse =
  | { ok: true; manifest: Blank25Manifest }
  | { ok: false; error: string };

let cachedPromise: Promise<ManifestResult> | null = null;

export const fetchBlank25Manifest = async (): Promise<ManifestResult> => {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      try {
        const response = await fetch("/api/blank25/manifest", {
          cache: "no-store",
        });
        const json = (await response.json()) as ManifestApiResponse;

        if (!response.ok || !json.ok) {
          return {
            ok: false,
            error: json.ok ? "manifest の取得に失敗しました" : json.error,
          };
        }

        // サーバー側で検証済みだが、ID 重複のみクライアントでも確認する
        const ids = new Set<string>();
        for (const category of json.manifest.categories) {
          for (const problem of category.problems) {
            if (ids.has(problem.id)) {
              return { ok: false, error: `問題IDが重複しています: ${problem.id}` };
            }
            ids.add(problem.id);
          }
        }

        return { ok: true, manifest: json.manifest };
      } catch {
        return { ok: false, error: "manifest の読み込み中にエラーが発生しました" };
      }
    })();
  }

  return cachedPromise;
};
