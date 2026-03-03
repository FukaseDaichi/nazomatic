"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import Image from "next/image";
import { RefreshCw } from "lucide-react";

import Blank25ImageCropperDialog from "@/components/blank25/editor/image-cropper-dialog";
import type {
  Blank25Category,
  Blank25Manifest,
  Blank25Problem,
} from "@/components/blank25/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EditorMode = "create" | "update";

type CropPayload = {
  base64: string;
  contentType: "image/webp";
  previewUrl: string;
};

type EditorManifestResponse =
  | {
      ok: true;
      manifestSha: string;
      manifest: Blank25Manifest;
    }
  | {
      ok: false;
      error: string;
    };

type PublishResponse =
  | {
      ok: true;
      mode: EditorMode;
      problemId: string;
      imageFile: string;
      commitSha: string;
      previousImageFile?: string;
    }
  | {
      ok: false;
      error: string;
    };

type FlatProblem = Blank25Problem & { categoryId: string };

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function Blank25EditorPage() {
  const [mode, setMode] = useState<EditorMode>("create");
  const [categories, setCategories] = useState<Blank25Category[] | null>(null);
  const [manifestSha, setManifestSha] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedProblemId, setSelectedProblemId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [linkName, setLinkName] = useState("");
  const [answersText, setAnswersText] = useState("");

  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [imagePayload, setImagePayload] = useState<CropPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const flatProblems = useMemo<FlatProblem[]>(
    () =>
      (categories ?? []).flatMap((category) =>
        category.problems.map((problem) => ({
          ...problem,
          categoryId: category.id,
        })),
      ),
    [categories],
  );

  const selectedProblem = useMemo(
    () => flatProblems.find((problem) => problem.id === selectedProblemId) ?? null,
    [flatProblems, selectedProblemId],
  );

  const previewImageUrl = useMemo(() => {
    if (imagePayload) {
      return imagePayload.previewUrl;
    }
    if (mode === "update" && selectedProblem) {
      return `/img/blank25/${selectedProblem.imageFile}`;
    }
    return null;
  }, [imagePayload, mode, selectedProblem]);

  const cleanupCropImageUrl = useCallback(() => {
    setCropImageUrl((current) => {
      if (current && current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      cleanupCropImageUrl();
    };
  }, [cleanupCropImageUrl]);

  const applyCreateDefaults = useCallback((nextCategories: Blank25Category[]) => {
    setMode("create");
    setSelectedProblemId("");
    setCategoryId(nextCategories[0]?.id ?? "");
    setLinkName("");
    setAnswersText("");
    setImagePayload(null);
    setFormError(null);
    setSubmitMessage(null);
  }, []);

  const applyUpdateValues = useCallback(
    (problem: FlatProblem) => {
      setMode("update");
      setSelectedProblemId(problem.id);
      setCategoryId(problem.categoryId);
      setLinkName(problem.linkName);
      setAnswersText(problem.answers.join("\n"));
      setImagePayload(null);
      setFormError(null);
      setSubmitMessage(null);
    },
    [],
  );

  const loadManifest = useCallback(
    async (refreshOnly: boolean) => {
      setError(null);
      if (!refreshOnly) {
        setLoading(true);
      } else {
        setReloading(true);
      }

      try {
        const response = await fetch("/api/internal/blank25/editor/manifest", {
          cache: "no-store",
        });
        const json = (await response.json()) as EditorManifestResponse;
        if (!response.ok || !json.ok) {
          throw new Error(
            json.ok ? "Manifest load failed." : json.error ?? "Manifest load failed.",
          );
        }

        setCategories(json.manifest.categories);
        setManifestSha(json.manifestSha);
        setCategoryId((current) => current || json.manifest.categories[0]?.id || "");
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError("Failed to load editor manifest.");
        }
      } finally {
        setLoading(false);
        setReloading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadManifest(false);
  }, [loadManifest]);

  const openCropDialog = useCallback(
    (file: File) => {
      const objectUrl = URL.createObjectURL(file);
      cleanupCropImageUrl();
      setCropImageUrl(objectUrl);
      setCropOpen(true);
    },
    [cleanupCropImageUrl],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormError(null);
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file) {
        return;
      }
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        setFormError("画像形式は PNG/JPEG/WebP のみ対応しています。");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setFormError("画像サイズは 5MB 以下にしてください。");
        return;
      }
      openCropDialog(file);
    },
    [openCropDialog],
  );

  const handleApplyCrop = useCallback((result: CropPayload) => {
    setImagePayload(result);
    setFormError(null);
  }, []);

  const answers = useMemo(
    () =>
      answersText
        .split(/\r?\n|,/)
        .map((answer) => answer.trim())
        .filter((answer) => answer.length > 0),
    [answersText],
  );

  const canSubmit = useMemo(() => {
    if (submitting) {
      return false;
    }
    if (!categoryId || !linkName.trim() || answers.length === 0) {
      return false;
    }
    if (mode === "create" && !imagePayload) {
      return false;
    }
    if (mode === "update" && !selectedProblemId) {
      return false;
    }
    return true;
  }, [
    answers.length,
    categoryId,
    imagePayload,
    linkName,
    mode,
    selectedProblemId,
    submitting,
  ]);

  const handlePublish = useCallback(async () => {
    setFormError(null);
    setSubmitMessage(null);

    if (!canSubmit) {
      setFormError("必須項目を入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/internal/blank25/editor/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          problemId: mode === "update" ? selectedProblemId : undefined,
          categoryId,
          linkName: linkName.trim(),
          answers,
          image: imagePayload
            ? {
                base64: imagePayload.base64,
                contentType: imagePayload.contentType,
              }
            : undefined,
          baseManifestSha: manifestSha ?? undefined,
        }),
      });

      const json = (await response.json()) as PublishResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? "Publish failed." : json.error);
      }

      setSubmitMessage(
        `公開完了: ${json.problemId} (${json.imageFile}) / commit ${json.commitSha.slice(
          0,
          8,
        )}`,
      );
      cleanupCropImageUrl();
      setImagePayload(null);

      await loadManifest(true);

      if (json.mode === "create") {
        setMode("update");
        setSelectedProblemId(json.problemId);
      } else {
        setSelectedProblemId(json.problemId);
      }
    } catch (publishError) {
      if (publishError instanceof Error) {
        setFormError(publishError.message);
      } else {
        setFormError("公開に失敗しました。");
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    answers,
    canSubmit,
    categoryId,
    cleanupCropImageUrl,
    imagePayload,
    linkName,
    loadManifest,
    manifestSha,
    mode,
    selectedProblemId,
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Blank25ImageCropperDialog
        open={cropOpen}
        imageUrl={cropImageUrl}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) {
            cleanupCropImageUrl();
          }
        }}
        onApply={handleApplyCrop}
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-100">
            BLANK25 Editor
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            画像トリミング + 回答入力で問題を作成・更新します（Basic認証保護）。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="bg-white text-gray-900"
          onClick={() => void loadManifest(true)}
          disabled={loading || reloading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {reloading ? "再読み込み中..." : "再読み込み"}
        </Button>
      </div>

      {error && (
        <Card className="mb-4 border-red-400/40 bg-red-950/40">
          <CardHeader>
            <CardTitle className="text-red-200">読み込みエラー</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-100">{error}</CardContent>
        </Card>
      )}

      {loading && (
        <Card className="mb-4 border-gray-700 bg-gray-800">
          <CardContent className="py-6 text-sm text-gray-200">
            エディタ情報を読み込み中です...
          </CardContent>
        </Card>
      )}

      {!loading && categories && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Card className="border-gray-700 bg-gray-800">
            <CardHeader>
              <CardTitle className="text-gray-100">操作モード</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => applyCreateDefaults(categories)}
                  className={
                    mode === "create"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-gray-700 hover:bg-gray-600"
                  }
                >
                  新規作成
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const target = flatProblems[0];
                    if (target) {
                      applyUpdateValues(target);
                    }
                  }}
                  className={
                    mode === "update"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gray-700 hover:bg-gray-600"
                  }
                  disabled={flatProblems.length === 0}
                >
                  既存編集
                </Button>
              </div>

              {mode === "update" && (
                <label className="grid gap-1 text-sm text-gray-200">
                  編集対象
                  <select
                    value={selectedProblemId}
                    onChange={(event) => {
                      const problem = flatProblems.find(
                        (item) => item.id === event.target.value,
                      );
                      if (problem) {
                        applyUpdateValues(problem);
                      }
                    }}
                    className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                  >
                    {flatProblems.map((problem) => (
                      <option key={problem.id} value={problem.id}>
                        {problem.linkName} ({problem.id})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="rounded-md bg-gray-900/60 px-3 py-2 text-xs text-gray-300">
                manifest sha: {manifestSha ? manifestSha.slice(0, 10) : "-"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-700 bg-gray-800">
            <CardHeader>
              <CardTitle className="text-gray-100">
                {mode === "create" ? "問題を新規作成" : "問題を更新"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-1 text-sm text-gray-200">
                カテゴリ
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm text-gray-200">
                問題名（linkName）
                <Input
                  value={linkName}
                  onChange={(event) => setLinkName(event.target.value)}
                  className="border-gray-600 bg-gray-900 text-gray-100"
                />
              </label>

              <label className="grid gap-1 text-sm text-gray-200">
                回答（改行区切り。カンマ区切りも可）
                <Textarea
                  value={answersText}
                  onChange={(event) => setAnswersText(event.target.value)}
                  className="min-h-[120px] border-gray-600 bg-gray-900 text-gray-100"
                />
              </label>

              <div className="grid gap-2 text-sm text-gray-200">
                <div className="flex items-center justify-between">
                  <span>
                    画像（{mode === "create" ? "必須" : "任意"} / 5MB以下）
                  </span>
                  {imagePayload && (
                    <span className="text-xs text-emerald-300">
                      トリミング済み
                    </span>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="border-gray-600 bg-gray-900 text-gray-100 file:text-gray-100"
                />
                <p className="text-xs text-gray-400">
                  選択後にトリミングダイアログが開き、5x5ルーラーで調整できます。
                </p>
              </div>

              {previewImageUrl && (
                <div className="grid gap-2">
                  <span className="text-sm text-gray-200">画像プレビュー</span>
                  <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-lg border border-gray-700 bg-black">
                    <Image
                      src={previewImageUrl}
                      alt="Preview"
                      fill
                      className="object-cover"
                      sizes="320px"
                      unoptimized
                    />
                  </div>
                  {mode === "update" && selectedProblem && (
                    <span className="text-xs text-gray-400">
                      現在の画像ファイル: {selectedProblem.imageFile}
                    </span>
                  )}
                </div>
              )}

              {answers.length > 0 && (
                <div className="rounded-md bg-gray-900/70 px-3 py-2 text-xs text-gray-300">
                  回答候補: {answers.join(", ")}
                </div>
              )}

              {formError && <p className="text-sm text-red-300">{formError}</p>}
              {submitMessage && (
                <p className="text-sm text-emerald-300">{submitMessage}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handlePublish}
                  disabled={!canSubmit}
                  className={
                    mode === "create"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }
                >
                  {submitting
                    ? "公開中..."
                    : mode === "create"
                      ? "新規公開"
                      : "更新公開"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white text-gray-900"
                  onClick={() => {
                    if (mode === "create") {
                      applyCreateDefaults(categories);
                      return;
                    }
                    if (selectedProblem) {
                      applyUpdateValues(selectedProblem);
                    }
                  }}
                  disabled={submitting}
                >
                  フォームを戻す
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
