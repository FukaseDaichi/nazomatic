"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderTree,
  ImagePlus,
  Link2,
  ListOrdered,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

import Blank25ImageCropperDialog from "@/components/blank25/editor/image-cropper-dialog";
import { getBlank25ImageUrl } from "@/components/blank25/image-url";
import type {
  Blank25Category,
  Blank25Manifest,
  Blank25Problem,
} from "@/components/blank25/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type EditorMode = "create" | "update";
type PublishMode = EditorMode | "delete";

type CropPayload = {
  base64: string;
  contentType: "image/webp";
  previewUrl: string;
};

type EditorManifestResponse =
  | {
      ok: true;
      manifest: Blank25Manifest;
    }
  | {
      ok: false;
      error: string;
    };

type PublishResponse =
  | {
      ok: true;
      mode: PublishMode;
      problemId: string;
      imageFile: string;
      commitSha: string;
      previousImageFile?: string;
      manifest: Blank25Manifest;
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

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );

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
      return getBlank25ImageUrl(selectedProblem.imageFile);
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

  const applyUpdateValues = useCallback((problem: FlatProblem) => {
    setMode("update");
    setSelectedProblemId(problem.id);
    setCategoryId(problem.categoryId);
    setLinkName(problem.linkName);
    setAnswersText(problem.answers.join("\n"));
    setImagePayload(null);
    setFormError(null);
    setSubmitMessage(null);
  }, []);

  const loadManifest = useCallback(
    async (refreshOnly: boolean): Promise<Blank25Category[] | null> => {
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
        setCategoryId((current) => current || json.manifest.categories[0]?.id || "");
        return json.manifest.categories;
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError("Failed to load editor manifest.");
        }
        return null;
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
        setFormError("PNG, JPEG, WebP のみ対応しています。");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setFormError("画像は 5MB 以下にしてください。");
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
      setFormError("必須項目が未入力です。");
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
        }),
      });

      const json = (await response.json()) as PublishResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? "Publish failed." : json.error);
      }

      setSubmitMessage(
        `保存完了: ${json.problemId} (${json.imageFile}) / ${json.commitSha.slice(0, 8)}`,
      );
      cleanupCropImageUrl();
      setImagePayload(null);

      // レスポンスに含まれる最新マニフェストを直接反映（GitHub CDN の再取得を省略）
      setCategories(json.manifest.categories);

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
        setFormError("保存に失敗しました。");
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
    mode,
    selectedProblemId,
  ]);

  const handleDelete = useCallback(async () => {
    setFormError(null);
    setSubmitMessage(null);

    if (mode !== "update" || !selectedProblem) {
      setFormError("削除する問題を選択してください。");
      return;
    }

    const confirmed = window.confirm(
      `「${selectedProblem.linkName}」(${selectedProblem.id}) を削除しますか？この操作は取り消せません。`,
    );
    if (!confirmed) {
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
          mode: "delete",
          problemId: selectedProblem.id,
        }),
      });

      const json = (await response.json()) as PublishResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? "Delete failed." : json.error);
      }

      setSubmitMessage(`削除完了: ${json.problemId} / ${json.commitSha.slice(0, 8)}`);
      cleanupCropImageUrl();
      setImagePayload(null);

      // レスポンスに含まれる最新マニフェストを直接反映（GitHub CDN の再取得を省略）
      setCategories(json.manifest.categories);
      applyCreateDefaults(json.manifest.categories);
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        setFormError(deleteError.message);
      } else {
        setFormError("削除に失敗しました。");
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    applyCreateDefaults,
    cleanupCropImageUrl,
    mode,
    selectedProblem,
  ]);

  const toggleCategory = useCallback((id: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <main className="flex h-[100dvh] flex-col bg-gradient-to-b from-gray-900 to-gray-800 text-white">
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

      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-gray-900/80 px-4 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-400/20 text-purple-200">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-white">
              BLANK25 エディタ
            </p>
            <p className="text-[11px] text-gray-500">
              {flatProblems.length} 問
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void loadManifest(true)}
          disabled={loading || reloading}
          aria-label="マニフェストを再読み込み"
          title="再読み込み"
          className="h-8 w-8 text-gray-400 hover:text-white"
        >
          <RefreshCw className={cn("h-4 w-4", reloading && "animate-spin")} />
        </Button>
      </header>

      {/* ── Error / Loading ── */}
      {error && (
        <div className="flex items-center gap-2 border-b border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple-300" />
          <span className="ml-2 text-sm text-gray-300">読み込み中...</span>
        </div>
      )}

      {/* ── Main Layout ── */}
      {!loading && categories && (
        <div className="flex min-h-0 flex-1">
          {/* ── Left Sidebar: Problem List ── */}
          <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-gray-900/50">
            {/* New button */}
            <div className="border-b border-white/10 p-3">
              <Button
                type="button"
                onClick={() => applyCreateDefaults(categories)}
                disabled={submitting}
                className={cn(
                  "h-10 w-full rounded-xl text-sm font-medium",
                  mode === "create"
                    ? "bg-purple-400 text-gray-900 hover:bg-purple-300"
                    : "border border-purple-400/50 bg-purple-400/10 text-purple-200 hover:bg-purple-400/20",
                )}
              >
                <Plus className="mr-2 h-4 w-4" />
                新規作成
              </Button>
            </div>

            {/* Problem list */}
            <nav className="flex-1 overflow-y-auto">
              {categories.map((category) => {
                const isCollapsed = collapsedCategories.has(category.id);
                return (
                  <div key={category.id}>
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="flex w-full items-center gap-2 border-b border-white/5 px-3 py-2.5 text-left text-xs font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="truncate">{category.name}</span>
                      <span className="ml-auto tabular-nums text-gray-600">
                        {category.problems.length}
                      </span>
                    </button>
                    {!isCollapsed &&
                      category.problems.map((problem) => {
                        const isSelected =
                          mode === "update" && selectedProblemId === problem.id;
                        return (
                          <button
                            key={problem.id}
                            type="button"
                            onClick={() => {
                              const flat = flatProblems.find(
                                (p) => p.id === problem.id,
                              );
                              if (flat) {
                                applyUpdateValues(flat);
                              }
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 border-b border-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/5",
                              isSelected && "bg-purple-400/15 hover:bg-purple-400/20",
                            )}
                          >
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-800">
                              <Image
                                src={getBlank25ImageUrl(problem.imageFile)}
                                alt={problem.linkName}
                                fill
                                className="object-cover"
                                sizes="40px"
                                unoptimized
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-sm",
                                  isSelected
                                    ? "font-medium text-purple-200"
                                    : "text-gray-200",
                                )}
                              >
                                {problem.linkName}
                              </p>
                              <p className="truncate text-[11px] text-gray-500">
                                {problem.id}
                              </p>
                            </div>
                            {isSelected && (
                              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* ── Right Main: Editor Form ── */}
          <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* Status messages */}
            {(formError || submitMessage) && (
              <div className="space-y-0 border-b border-white/10">
                {formError && (
                  <div className="flex items-center gap-2 bg-red-500/10 px-5 py-2.5 text-sm text-red-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                {submitMessage && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 px-5 py-2.5 text-sm text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{submitMessage}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 p-5">
              {/* Mode indicator */}
              <div className="mb-5 flex items-center gap-3">
                <span
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider",
                    mode === "create"
                      ? "bg-purple-400/20 text-purple-200"
                      : "bg-blue-400/20 text-blue-200",
                  )}
                >
                  {mode === "create" ? "新規作成" : "編集"}
                </span>
                {mode === "update" && selectedProblem && (
                  <span className="text-sm text-gray-400">
                    {selectedProblem.linkName}
                    <span className="ml-2 font-mono text-xs text-gray-600">
                      {selectedProblem.id}
                    </span>
                  </span>
                )}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_240px]">
                {/* Form fields */}
                <div className="space-y-4">
                  {/* Category + Link name row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="category-select"
                        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400"
                      >
                        <FolderTree className="h-3.5 w-3.5 text-purple-300" />
                        カテゴリ
                      </label>
                      <select
                        id="category-select"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        className="h-10 w-full rounded-lg border border-white/10 bg-gray-800/60 px-3 text-sm text-gray-100 outline-none transition-colors focus:border-purple-400/60 focus:ring-1 focus:ring-purple-400/30"
                      >
                        {categories.map((category) => (
                          <option
                            key={category.id}
                            value={category.id}
                            className="bg-gray-900 text-gray-100"
                          >
                            {category.name} ({category.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="link-name-input"
                        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400"
                      >
                        <Link2 className="h-3.5 w-3.5 text-purple-300" />
                        リンク名
                      </label>
                      <Input
                        id="link-name-input"
                        value={linkName}
                        onChange={(event) => setLinkName(event.target.value)}
                        placeholder="例: 第1問"
                        className="h-10 rounded-lg border-white/10 bg-gray-800/60 text-sm text-gray-100 placeholder:text-gray-500 focus-visible:border-purple-400/60 focus-visible:ring-1 focus-visible:ring-purple-400/30"
                      />
                    </div>
                  </div>

                  {/* Answers */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label
                        htmlFor="answers-input"
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-400"
                      >
                        <ListOrdered className="h-3.5 w-3.5 text-purple-300" />
                        正解ワード
                      </label>
                      <span className="rounded-full bg-purple-400/15 px-2 py-0.5 text-[11px] tabular-nums text-purple-200">
                        {answers.length} 件
                      </span>
                    </div>
                    <Textarea
                      id="answers-input"
                      value={answersText}
                      onChange={(event) => setAnswersText(event.target.value)}
                      placeholder={"カンマ区切り or 改行で入力\n例:\nりんご\nアップル"}
                      className="min-h-[140px] rounded-lg border-white/10 bg-gray-800/60 text-sm text-gray-100 placeholder:text-gray-500 focus-visible:border-purple-400/60 focus-visible:ring-1 focus-visible:ring-purple-400/30"
                    />
                  </div>

                  {/* Image upload */}
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                      <ImagePlus className="h-3.5 w-3.5 text-purple-300" />
                      画像
                      <span className="ml-1 text-[10px] text-gray-600">
                        {mode === "create" ? "(必須)" : "(変更時のみ)"}
                      </span>
                      {imagePayload && (
                        <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </div>
                    <input
                      id="image-upload-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="image-upload-input"
                      className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-purple-400/40 bg-purple-400/5 text-sm text-purple-200 transition-colors hover:border-purple-400/60 hover:bg-purple-400/10"
                    >
                      <ImagePlus className="h-4 w-4" />
                      <span>画像を選択</span>
                    </label>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={handlePublish}
                      disabled={!canSubmit}
                      className="h-11 min-w-[160px] rounded-xl bg-purple-400 text-sm font-semibold text-gray-900 hover:bg-purple-300 disabled:opacity-40"
                    >
                      {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {mode === "create" ? "作成する" : "更新する"}
                    </Button>

                    {mode === "update" && (
                      <Button
                        type="button"
                        onClick={handleDelete}
                        disabled={submitting || !selectedProblem}
                        className="h-11 rounded-xl border border-red-400/40 bg-red-500/10 text-sm text-red-200 hover:bg-red-500/20"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        削除
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
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
                      className="h-11 rounded-xl border-white/15 bg-white/[0.03] text-sm text-gray-300 hover:bg-white/[0.08]"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      リセット
                    </Button>
                  </div>
                </div>

                {/* Image preview */}
                <div className="order-first xl:order-last">
                  <p className="mb-1.5 text-xs font-medium text-gray-400">
                    プレビュー
                  </p>
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-800/40">
                    <div className="relative aspect-square w-full bg-black/30">
                      {previewImageUrl ? (
                        <Image
                          src={previewImageUrl}
                          alt="プレビュー"
                          fill
                          className="object-contain"
                          sizes="240px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-600">
                          <ImagePlus className="h-8 w-8" />
                          <span className="text-xs">未選択</span>
                        </div>
                      )}
                    </div>
                    {mode === "update" && selectedProblem && !imagePayload && (
                      <p className="truncate border-t border-white/5 px-3 py-2 text-[11px] text-gray-500">
                        {selectedProblem.imageFile}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
