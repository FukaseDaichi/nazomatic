"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock3,
  ChevronLeft,
  ImagePlus,
  Minus,
  Monitor,
  Pause,
  PartyPopper,
  Play,
  Plus,
  RotateCcw,
  ScanLine,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { PartyAvatar } from "@/components/blank25/party-avatar";
import {
  clearBlank25PartyState,
  coerceBlank25PartyScore,
  createBlank25PartyId,
  createBlank25PartyState,
  loadBlank25PartyState,
  saveBlank25PartyState,
} from "@/components/blank25/party-storage";
import PartyPodium, {
  type PartyPodiumEntry,
} from "@/components/blank25/party-podium";
import {
  fireBlank25Confetti,
  type ConfettiCleanup,
} from "@/components/blank25/confetti";
import type {
  Blank25PartyParticipant,
  Blank25PartyParticipantKind,
  Blank25PartyPersistedState,
  Blank25PartyScoreEvent,
} from "@/components/blank25/party-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PartyPodiumScene = dynamic(
  () => import("@/components/blank25/party-podium-scene"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] w-full items-center justify-center rounded-[1.8rem] border border-gray-800 bg-gray-950/75 lg:h-[300px]">
        <div className="rounded-full border border-purple-300/20 bg-purple-400/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-purple-100">
          ステージ描画中...
        </div>
      </div>
    ),
  },
);

type RankedParticipant = Blank25PartyParticipant & {
  rank: number;
  isTied: boolean;
};

type PendingDangerAction =
  | {
      type: "deleteParticipant";
      participantId: string;
      participantName: string;
    }
  | { type: "resetScores" }
  | { type: "clearBoard" }
  | null;

const updatedAtFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const historyFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const kindLabel = (kind: Blank25PartyParticipantKind) =>
  kind === "group" ? "グループ" : "個人";

const normalizeNameKey = (value: string) => value.trim().toLocaleLowerCase();

const parseScoreInput = (value: string, fallback = 0) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return fallback;
  return coerceBlank25PartyScore(parsed);
};

const PARTY_ICON_SIZE = 192;
const PARTY_ICON_MIME = "image/webp";
const PARTY_ICON_QUALITY = 0.86;
const PARTY_ICON_MAX_LENGTH = 280_000;
const DEFAULT_PARTY_TIMER_SECONDS = 180;
const MAX_PARTY_TIMER_SECONDS = 99 * 60 + 59;
const PARTY_TIMER_PRESETS = [30, 60, 180, 300] as const;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("画像の読み込みに失敗しました。"));
    };
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.readAsDataURL(file);
  });

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    image.src = src;
  });

const createPartyIconDataUrl = async (file: File) => {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください。");
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = PARTY_ICON_SIZE;
  canvas.height = PARTY_ICON_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("画像の変換に失敗しました。");
  }

  context.clearRect(0, 0, PARTY_ICON_SIZE, PARTY_ICON_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const scale = Math.max(
    PARTY_ICON_SIZE / image.width,
    PARTY_ICON_SIZE / image.height,
  );
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (PARTY_ICON_SIZE - drawWidth) / 2;
  const offsetY = (PARTY_ICON_SIZE - drawHeight) / 2;

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  const dataUrl = canvas.toDataURL(PARTY_ICON_MIME, PARTY_ICON_QUALITY);
  if (dataUrl.length > PARTY_ICON_MAX_LENGTH) {
    throw new Error(
      "画像サイズが大きすぎます。もう少し軽い画像を選んでください。",
    );
  }

  return dataUrl;
};

const clampPartyTimerSeconds = (value: number) => {
  if (!Number.isFinite(value)) return DEFAULT_PARTY_TIMER_SECONDS;
  return Math.min(MAX_PARTY_TIMER_SECONDS, Math.max(1, Math.floor(value)));
};

const formatPartyTimerDisplay = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    totalSeconds,
  };
};

const formatPartyTimerPresetLabel = (seconds: number) => {
  if (seconds % 60 === 0) return `${seconds / 60}分`;
  return `${seconds}秒`;
};

function KindToggle({
  value,
  onChange,
  size = "default",
}: {
  value: Blank25PartyParticipantKind;
  onChange: (value: Blank25PartyParticipantKind) => void;
  size?: "default" | "compact";
}) {
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-gray-700 bg-gray-950/80 p-1",
        isCompact && "text-xs",
      )}
      role="group"
      aria-label="参加者の種別"
    >
      <button
        type="button"
        onClick={() => onChange("group")}
        className={cn(
          "rounded-full font-medium transition-colors",
          isCompact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
          value === "group"
            ? "bg-purple-400 text-gray-950"
            : "text-gray-300 hover:text-white",
        )}
      >
        グループ
      </button>
      <button
        type="button"
        onClick={() => onChange("person")}
        className={cn(
          "rounded-full font-medium transition-colors",
          isCompact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
          value === "person"
            ? "bg-purple-400 text-gray-950"
            : "text-gray-300 hover:text-white",
        )}
      >
        個人
      </button>
    </div>
  );
}

function IconPicker({
  id,
  name,
  iconDataUrl,
  onPick,
  onClear,
  size = "default",
}: {
  id: string;
  name: string;
  iconDataUrl: string | null;
  onPick: (file: File) => Promise<void> | void;
  onClear?: () => void;
  size?: "default" | "compact";
}) {
  const isCompact = size === "compact";

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await onPick(file);
  };

  return (
    <div className="relative shrink-0">
      <label htmlFor={id} className="group relative block cursor-pointer">
        <PartyAvatar
          name={name}
          iconDataUrl={iconDataUrl}
          className={cn(
            "transition-all duration-200 group-hover:border-purple-300/45",
            isCompact
              ? "h-14 w-14 rounded-[1.2rem]"
              : "h-16 w-16 rounded-[1.35rem]",
          )}
          monogramClassName={cn(isCompact ? "text-base" : "text-lg")}
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-gray-950/70 opacity-0 transition-opacity group-hover:opacity-100">
          <ImagePlus
            className={cn(
              isCompact ? "h-4.5 w-4.5" : "h-5.5 w-5.5",
              "text-purple-100",
            )}
          />
        </span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          void handleChange(event);
        }}
      />
      {iconDataUrl && onClear && (
        <button
          type="button"
          className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-800 bg-gray-950 text-gray-200 transition-colors hover:border-purple-300/45 hover:text-white"
          onClick={onClear}
          aria-label={`${name} のアイコンを削除`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ParticipantCard({
  participant,
  onRename,
  onChangeKind,
  onPickIcon,
  onClearIcon,
  onAdjustScore,
  onSetScore,
  onDelete,
}: {
  participant: RankedParticipant;
  onRename: (participantId: string, nextName: string) => void;
  onChangeKind: (
    participantId: string,
    nextKind: Blank25PartyParticipantKind,
  ) => void;
  onPickIcon: (
    participantId: string,
    participantName: string,
    file: File,
  ) => Promise<void> | void;
  onClearIcon: (participantId: string, participantName: string) => void;
  onAdjustScore: (participantId: string, delta: number) => void;
  onSetScore: (participantId: string, nextScore: number) => void;
  onDelete: (participantId: string, participantName: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState(participant.name);
  const [scoreDraft, setScoreDraft] = useState(String(participant.score));

  useEffect(() => {
    setNameDraft(participant.name);
  }, [participant.name]);

  useEffect(() => {
    setScoreDraft(String(participant.score));
  }, [participant.score]);

  const commitName = useCallback(() => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameDraft(participant.name);
      return;
    }
    if (trimmed === participant.name) return;
    onRename(participant.id, trimmed);
  }, [nameDraft, onRename, participant.id, participant.name]);

  const commitScore = useCallback(() => {
    const nextScore = parseScoreInput(scoreDraft, participant.score);
    setScoreDraft(String(nextScore));
    if (nextScore === participant.score) return;
    onSetScore(participant.id, nextScore);
  }, [onSetScore, participant.id, participant.score, scoreDraft]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <Card className="overflow-hidden border-gray-700 bg-[linear-gradient(to_bottom,rgba(3,7,18,0.94),rgba(17,24,39,0.88))] shadow-xl shadow-black/25">
        <CardContent className="p-3">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <IconPicker
                id={`participant-icon-${participant.id}`}
                name={participant.name}
                iconDataUrl={participant.iconDataUrl}
                onPick={(file) =>
                  onPickIcon(participant.id, participant.name, file)
                }
                onClear={() => onClearIcon(participant.id, participant.name)}
              />
              <div className="min-w-0 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-100">
                  {participant.rank} 位
                </span>
                <span className="rounded-full border border-gray-700 bg-gray-900/80 px-2 py-1 text-[11px] text-gray-200">
                  {kindLabel(participant.kind)}
                </span>
                {participant.isTied && (
                  <span className="rounded-full border border-gray-600 bg-gray-800 px-2 py-1 text-[11px] text-gray-200">
                    同点
                  </span>
                )}
              </div>
              <div className="ml-auto min-w-[80px] rounded-[1.2rem] border border-purple-300/20 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.18),transparent_70%),rgba(3,7,18,0.92)] px-2.5 py-2 text-center">
                <div className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                  得点
                </div>
                <div className="mt-1 flex items-end justify-center gap-1.5">
                  <span className="text-[1.75rem] font-black tracking-tight text-white">
                    {participant.score}
                  </span>
                  <span className="pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-200">
                    pt
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                  名前
                </label>
                <Input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onBlur={commitName}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitName();
                    }
                  }}
                  className="h-9 border-gray-700 bg-gray-950/90 text-base text-white placeholder:text-gray-500 focus-visible:ring-purple-400"
                  placeholder="名前を入力"
                />
              </div>
              <KindToggle
                value={participant.kind}
                size="compact"
                onChange={(nextKind) => onChangeKind(participant.id, nextKind)}
              />
            </div>

            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-gray-700 bg-gray-950 px-2 text-white hover:border-purple-300 hover:bg-gray-800"
                onClick={() => onAdjustScore(participant.id, -1)}
              >
                <Minus className="mr-1 h-3.5 w-3.5" />
                -1
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-purple-300/35 bg-purple-400/10 px-2 text-purple-100 hover:bg-purple-400/20 hover:text-white"
                onClick={() => onAdjustScore(participant.id, 1)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                +1
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-purple-300/35 bg-purple-400/10 px-2 text-purple-100 hover:bg-purple-400/20 hover:text-white"
                onClick={() => onAdjustScore(participant.id, 5)}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                +5
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 border border-gray-800 px-2 text-gray-300 hover:bg-gray-800 hover:text-white"
                onClick={() => onDelete(participant.id, participant.name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
              <Input
                type="number"
                inputMode="numeric"
                value={scoreDraft}
                onChange={(event) => setScoreDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitScore();
                  }
                }}
                className="h-9 border-gray-700 bg-gray-950/90 text-base text-white placeholder:text-gray-500 focus-visible:ring-purple-400"
                placeholder="得点を直接入力"
              />
              <Button
                type="button"
                size="sm"
                className="h-9 bg-white px-3 text-gray-950 hover:bg-gray-100"
                onClick={commitScore}
              >
                反映
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.article>
  );
}

function GmTimerControl({ onFinish }: { onFinish: () => void }) {
  const defaultDurationMs = DEFAULT_PARTY_TIMER_SECONDS * 1000;
  const [open, setOpen] = useState(false);
  const [durationMs, setDurationMs] = useState(defaultDurationMs);
  const [remainingMs, setRemainingMs] = useState(defaultDurationMs);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [minutesInput, setMinutesInput] = useState("03");
  const [secondsInput, setSecondsInput] = useState("00");
  const didFinishRef = useRef(false);

  const isRunning = endsAt !== null;
  const hasFinished = remainingMs === 0;
  const isPaused = !isRunning && remainingMs > 0 && remainingMs < durationMs;
  const timerDisplay = useMemo(
    () => formatPartyTimerDisplay(remainingMs),
    [remainingMs],
  );
  const durationDisplay = useMemo(
    () => formatPartyTimerDisplay(durationMs),
    [durationMs],
  );
  const progress = durationMs > 0 ? remainingMs / durationMs : 0;

  const syncTimerInputs = useCallback((nextTotalSeconds: number) => {
    const minutes = Math.floor(nextTotalSeconds / 60);
    const seconds = nextTotalSeconds % 60;
    setMinutesInput(String(minutes).padStart(2, "0"));
    setSecondsInput(String(seconds).padStart(2, "0"));
  }, []);

  const applyTimerDuration = useCallback(
    (nextTotalSeconds: number) => {
      const normalizedSeconds = clampPartyTimerSeconds(nextTotalSeconds);
      const nextDurationMs = normalizedSeconds * 1000;

      didFinishRef.current = false;
      setEndsAt(null);
      setDurationMs(nextDurationMs);
      setRemainingMs(nextDurationMs);
      syncTimerInputs(normalizedSeconds);
    },
    [syncTimerInputs],
  );

  const applyTimerInputs = useCallback(() => {
    const minutes = Number(minutesInput.trim() || "0");
    const seconds = Number(secondsInput.trim() || "0");

    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return;
    }

    const nextTotalSeconds = minutes * 60 + seconds;
    applyTimerDuration(nextTotalSeconds);
  }, [applyTimerDuration, minutesInput, secondsInput]);

  const startTimer = useCallback(() => {
    const nextRemainingMs = remainingMs > 0 ? remainingMs : durationMs;
    didFinishRef.current = false;
    setRemainingMs(nextRemainingMs);
    setEndsAt(Date.now() + nextRemainingMs);
  }, [durationMs, remainingMs]);

  const pauseTimer = useCallback(() => {
    if (!endsAt) return;
    setRemainingMs(Math.max(0, endsAt - Date.now()));
    setEndsAt(null);
  }, [endsAt]);

  const resetTimer = useCallback(() => {
    didFinishRef.current = false;
    setEndsAt(null);
    setRemainingMs(durationMs);
  }, [durationMs]);

  useEffect(() => {
    if (!endsAt) return;

    const updateRemaining = () => {
      const nextRemainingMs = Math.max(0, endsAt - Date.now());
      setRemainingMs(nextRemainingMs);

      if (nextRemainingMs <= 0 && !didFinishRef.current) {
        didFinishRef.current = true;
        setEndsAt(null);
        onFinish();
      }
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 250);

    return () => window.clearInterval(intervalId);
  }, [endsAt, onFinish]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-10 border-gray-700 bg-gray-950/80 px-4 text-white hover:bg-gray-800",
          isRunning &&
            "border-purple-300/35 bg-purple-400/10 text-purple-100 hover:bg-purple-400/20",
        )}
        onClick={() => setOpen(true)}
      >
        <Clock3 className="mr-2 h-4 w-4" />
        <span className="font-semibold">
          {isRunning || isPaused || hasFinished
            ? `${timerDisplay.minutes}:${timerDisplay.seconds}`
            : "GMタイマー"}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[920px] border-gray-700 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.2),transparent_55%),linear-gradient(to_bottom,rgba(2,6,23,0.98),rgba(17,24,39,0.96))] p-0 text-white">
          <div className="relative overflow-hidden rounded-[1.8rem] p-6">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(192,132,252,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(192,132,252,0.06)_1px,transparent_1px)] bg-[size:42px_42px] opacity-30" />
            <div className="relative">
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-100">
                      <Clock3 className="h-3.5 w-3.5" />
                      GM Timer
                    </div>
                    <DialogTitle className="mt-4 text-4xl font-black tracking-[-0.04em] text-white">
                      カウントダウン
                    </DialogTitle>
                  </div>
                  <div
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]",
                      isRunning
                        ? "border-purple-300/20 bg-purple-400/10 text-purple-100"
                        : hasFinished
                          ? "border-white/20 bg-white/10 text-white"
                          : isPaused
                            ? "border-gray-600 bg-gray-900/85 text-gray-200"
                            : "border-gray-700 bg-gray-950/85 text-gray-300",
                    )}
                  >
                    {isRunning
                      ? "進行中"
                      : hasFinished
                        ? "終了"
                        : isPaused
                          ? "一時停止"
                          : "待機中"}
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_320px]">
                <div className="rounded-[2rem] border border-purple-300/18 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.22),transparent_62%),rgba(3,7,18,0.84)] px-6 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                  <div className="text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-gray-400">
                      COUNTDOWN
                    </div>
                    <div className="mt-5 flex items-end justify-center gap-3">
                      <span className="font-mono text-[7.5rem] font-black leading-none tracking-[-0.08em] text-white xl:text-[8.6rem]">
                        {timerDisplay.minutes}
                      </span>
                      <span className="mb-4 font-mono text-[5.4rem] font-black leading-none text-purple-300 xl:text-[6.2rem]">
                        :
                      </span>
                      <span className="font-mono text-[7.5rem] font-black leading-none tracking-[-0.08em] text-white xl:text-[8.6rem]">
                        {timerDisplay.seconds}
                      </span>
                    </div>
                    <div className="mt-5 h-3 overflow-hidden rounded-full border border-gray-800 bg-gray-950/90">
                      <motion.div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(250,245,255,0.95),rgba(192,132,252,0.92),rgba(168,85,247,0.9))] shadow-[0_0_30px_rgba(192,132,252,0.45)]"
                        animate={{ width: `${Math.max(progress * 100, hasFinished ? 0 : 4)}%` }}
                        transition={{ ease: "easeOut", duration: 0.2 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.55rem] border border-gray-800 bg-gray-950/82 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">
                      プリセット
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {PARTY_TIMER_PRESETS.map((seconds) => (
                        <Button
                          key={seconds}
                          type="button"
                          variant="outline"
                          className="h-11 border-gray-700 bg-gray-950 text-white hover:border-purple-300 hover:bg-gray-800"
                          onClick={() => applyTimerDuration(seconds)}
                        >
                          {formatPartyTimerPresetLabel(seconds)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.55rem] border border-gray-800 bg-gray-950/82 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">
                      時間設定
                    </div>
                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                      <div>
                        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                          分
                        </label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={99}
                          value={minutesInput}
                          onChange={(event) => setMinutesInput(event.target.value)}
                          className="h-11 border-gray-700 bg-gray-900/90 text-base text-white focus-visible:ring-purple-400"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                          秒
                        </label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={59}
                          value={secondsInput}
                          onChange={(event) => setSecondsInput(event.target.value)}
                          className="h-11 border-gray-700 bg-gray-900/90 text-base text-white focus-visible:ring-purple-400"
                        />
                      </div>
                      <Button
                        type="button"
                        className="h-11 self-end bg-purple-400 px-4 text-gray-950 hover:bg-purple-300"
                        onClick={applyTimerInputs}
                      >
                        反映
                      </Button>
                    </div>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                      SET {durationDisplay.minutes}:{durationDisplay.seconds}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-2.5 md:grid-cols-3">
                <Button
                  type="button"
                  className="h-12 bg-purple-400 text-base font-semibold text-gray-950 hover:bg-purple-300"
                  onClick={startTimer}
                  disabled={isRunning}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {hasFinished ? "もう一度開始" : isPaused ? "再開" : "開始"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 border-gray-700 bg-gray-950 text-base text-white hover:bg-gray-800"
                  onClick={pauseTimer}
                  disabled={!isRunning}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  一時停止
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 border-purple-300/30 bg-purple-400/10 text-base text-purple-100 hover:bg-purple-400/20 hover:text-white"
                  onClick={resetTimer}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  リセット
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PartyScoreboard() {
  const [partyState, setPartyState] = useState<Blank25PartyPersistedState>(() =>
    createBlank25PartyState(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newParticipantKind, setNewParticipantKind] =
    useState<Blank25PartyParticipantKind>("group");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantScore, setNewParticipantScore] = useState("0");
  const [newParticipantIcon, setNewParticipantIcon] = useState<string | null>(
    null,
  );
  const [pendingDangerAction, setPendingDangerAction] =
    useState<PendingDangerAction>(null);
  const previousSoleLeaderIdRef = useRef<string | null>(null);
  const leaderEffectReadyRef = useRef(false);
  const confettiCleanupRef = useRef<ConfettiCleanup | null>(null);

  const commitState = useCallback(
    (
      updater: (
        previousState: Blank25PartyPersistedState,
      ) => Blank25PartyPersistedState,
    ) => {
      setPartyState((previousState) => {
        const nextState = updater(previousState);
        if (nextState === previousState) return previousState;
        return {
          ...nextState,
          updatedAt: Date.now(),
        };
      });
    },
    [],
  );

  useEffect(() => {
    const loadResult = loadBlank25PartyState();
    setPartyState(loadResult.state);
    setHydrated(true);
    if (loadResult.recoveredFromInvalidData) {
      setStatusMessage("保存データが壊れていたため、ボードを初期化しました。");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateDesktopState = () => setIsDesktop(mediaQuery.matches);

    updateDesktopState();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateDesktopState);
      return () => mediaQuery.removeEventListener("change", updateDesktopState);
    }

    mediaQuery.addListener(updateDesktopState);
    return () => mediaQuery.removeListener(updateDesktopState);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    try {
      saveBlank25PartyState(partyState);
    } catch {
      setStatusMessage("保存に失敗しました。");
    }
  }, [hydrated, partyState]);

  useEffect(() => {
    return () => {
      confettiCleanupRef.current?.();
    };
  }, []);

  const rankedParticipants = useMemo<RankedParticipant[]>(() => {
    const sortedParticipants = [...partyState.participants].sort(
      (left, right) => {
        if (left.score !== right.score) return right.score - left.score;
        if (left.createdAt !== right.createdAt)
          return left.createdAt - right.createdAt;
        return left.name.localeCompare(right.name, "ja");
      },
    );

    const scoreCounts = new Map<number, number>();
    sortedParticipants.forEach((participant) => {
      scoreCounts.set(
        participant.score,
        (scoreCounts.get(participant.score) ?? 0) + 1,
      );
    });

    let currentRank = 0;
    let previousScore: number | null = null;

    return sortedParticipants.map((participant, index) => {
      if (participant.score !== previousScore) {
        currentRank = index + 1;
        previousScore = participant.score;
      }

      return {
        ...participant,
        rank: currentRank,
        isTied: (scoreCounts.get(participant.score) ?? 0) > 1,
      };
    });
  }, [partyState.participants]);

  const participantCount = rankedParticipants.length;
  const topScore = rankedParticipants[0]?.score ?? null;
  const topGroupCount =
    topScore === null
      ? 0
      : rankedParticipants.filter(
          (participant) => participant.score === topScore,
        ).length;
  const soleLeaderId =
    topScore !== null && topGroupCount === 1
      ? (rankedParticipants[0]?.id ?? null)
      : null;

  const podiumEntries = useMemo<PartyPodiumEntry[]>(
    () =>
      rankedParticipants.slice(0, 3).map((participant, index) => ({
        participant,
        rank: participant.rank,
        isTied: participant.isTied,
        slot: (index + 1) as 1 | 2 | 3,
      })),
    [rankedParticipants],
  );

  const latestEvents = useMemo(() => {
    const participantById = new Map(
      partyState.participants.map((participant) => [
        participant.id,
        participant,
      ]),
    );

    return [...partyState.events]
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 10)
      .map((event) => ({
        event,
        participantName:
          participantById.get(event.participantId)?.name ?? "削除済みの参加者",
      }));
  }, [partyState.events, partyState.participants]);

  useEffect(() => {
    if (!hydrated) return;

    if (!leaderEffectReadyRef.current) {
      leaderEffectReadyRef.current = true;
      previousSoleLeaderIdRef.current = soleLeaderId;
      return;
    }

    if (soleLeaderId && soleLeaderId !== previousSoleLeaderIdRef.current) {
      confettiCleanupRef.current?.();
      confettiCleanupRef.current = fireBlank25Confetti();
      setStatusMessage("首位が入れ替わりました。");
    }

    previousSoleLeaderIdRef.current = soleLeaderId;
  }, [hydrated, soleLeaderId]);

  const addParticipant = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = newParticipantName.trim();
      if (!trimmedName) {
        setStatusMessage("名前を入力してください。");
        return;
      }

      const duplicated = partyState.participants.some(
        (participant) =>
          normalizeNameKey(participant.name) === normalizeNameKey(trimmedName),
      );
      if (duplicated) {
        setStatusMessage("同じ名前の参加者がすでに存在します。");
        return;
      }

      const nextScore = parseScoreInput(newParticipantScore, 0);
      const now = Date.now();
      const nextParticipant: Blank25PartyParticipant = {
        id: createBlank25PartyId(),
        name: trimmedName,
        kind: newParticipantKind,
        score: nextScore,
        iconDataUrl: newParticipantIcon,
        createdAt: now,
        updatedAt: now,
      };

      commitState((previousState) => ({
        ...previousState,
        participants: [...previousState.participants, nextParticipant],
      }));

      setNewParticipantName("");
      setNewParticipantScore("0");
      setNewParticipantIcon(null);
      setStatusMessage(`${trimmedName} を追加しました。`);
    },
    [
      commitState,
      newParticipantKind,
      newParticipantIcon,
      newParticipantName,
      newParticipantScore,
      partyState.participants,
    ],
  );

  const setParticipantIcon = useCallback(
    (participantId: string, nextIconDataUrl: string | null) => {
      commitState((previousState) => ({
        ...previousState,
        participants: previousState.participants.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                iconDataUrl: nextIconDataUrl,
                updatedAt: Date.now(),
              }
            : participant,
        ),
      }));
    },
    [commitState],
  );

  const handleNewParticipantIconPick = useCallback(async (file: File) => {
    try {
      const nextIconDataUrl = await createPartyIconDataUrl(file);
      setNewParticipantIcon(nextIconDataUrl);
      setStatusMessage("追加用アイコンをセットしました。");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "アイコンの登録に失敗しました。",
      );
    }
  }, []);

  const handleParticipantIconPick = useCallback(
    async (participantId: string, participantName: string, file: File) => {
      try {
        const nextIconDataUrl = await createPartyIconDataUrl(file);
        setParticipantIcon(participantId, nextIconDataUrl);
        setStatusMessage(`${participantName} のアイコンを更新しました。`);
      } catch (error) {
        setStatusMessage(
          error instanceof Error
            ? error.message
            : "アイコンの登録に失敗しました。",
        );
      }
    },
    [setParticipantIcon],
  );

  const clearParticipantIcon = useCallback(
    (participantId: string, participantName: string) => {
      setParticipantIcon(participantId, null);
      setStatusMessage(`${participantName} のアイコンを削除しました。`);
    },
    [setParticipantIcon],
  );

  const renameParticipant = useCallback(
    (participantId: string, nextName: string) => {
      const trimmedName = nextName.trim();
      if (!trimmedName) return;

      const duplicated = partyState.participants.some(
        (participant) =>
          participant.id !== participantId &&
          normalizeNameKey(participant.name) === normalizeNameKey(trimmedName),
      );
      if (duplicated) {
        setStatusMessage("同じ名前の参加者がすでに存在します。");
        return;
      }

      commitState((previousState) => ({
        ...previousState,
        participants: previousState.participants.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                name: trimmedName,
                updatedAt: Date.now(),
              }
            : participant,
        ),
      }));
    },
    [commitState, partyState.participants],
  );

  const changeParticipantKind = useCallback(
    (participantId: string, nextKind: Blank25PartyParticipantKind) => {
      commitState((previousState) => ({
        ...previousState,
        participants: previousState.participants.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                kind: nextKind,
                updatedAt: Date.now(),
              }
            : participant,
        ),
      }));
    },
    [commitState],
  );

  const appendScoreEvent = useCallback(
    (
      previousState: Blank25PartyPersistedState,
      event: Blank25PartyScoreEvent,
      participantId: string,
      nextScore: number,
    ) => ({
      ...previousState,
      participants: previousState.participants.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              score: nextScore,
              updatedAt: Date.now(),
            }
          : participant,
      ),
      events: [...previousState.events, event],
    }),
    [],
  );

  const adjustParticipantScore = useCallback(
    (participantId: string, delta: number) => {
      commitState((previousState) => {
        const participant = previousState.participants.find(
          (item) => item.id === participantId,
        );
        if (!participant) return previousState;

        const nextScore = coerceBlank25PartyScore(participant.score + delta);
        const scoreEvent: Blank25PartyScoreEvent = {
          id: createBlank25PartyId(),
          participantId,
          mode: "delta",
          delta,
          fromScore: participant.score,
          toScore: nextScore,
          createdAt: Date.now(),
        };

        return appendScoreEvent(
          previousState,
          scoreEvent,
          participantId,
          nextScore,
        );
      });
    },
    [appendScoreEvent, commitState],
  );

  const setParticipantScore = useCallback(
    (participantId: string, nextScoreValue: number) => {
      commitState((previousState) => {
        const participant = previousState.participants.find(
          (item) => item.id === participantId,
        );
        if (!participant) return previousState;

        const nextScore = coerceBlank25PartyScore(nextScoreValue);
        if (nextScore === participant.score) return previousState;

        const scoreEvent: Blank25PartyScoreEvent = {
          id: createBlank25PartyId(),
          participantId,
          mode: "set",
          delta: nextScore - participant.score,
          fromScore: participant.score,
          toScore: nextScore,
          createdAt: Date.now(),
        };

        return appendScoreEvent(
          previousState,
          scoreEvent,
          participantId,
          nextScore,
        );
      });
    },
    [appendScoreEvent, commitState],
  );

  const undoLastScoreEvent = useCallback(() => {
    commitState((previousState) => {
      const lastEvent = previousState.events.at(-1);
      if (!lastEvent) return previousState;

      return {
        ...previousState,
        participants: previousState.participants.map((participant) =>
          participant.id === lastEvent.participantId
            ? {
                ...participant,
                score: lastEvent.fromScore,
                updatedAt: Date.now(),
              }
            : participant,
        ),
        events: previousState.events.slice(0, -1),
      };
    });

    setStatusMessage("直前の得点操作を取り消しました。");
  }, [commitState]);

  const confirmDangerAction = useCallback(() => {
    if (!pendingDangerAction) return;

    if (pendingDangerAction.type === "deleteParticipant") {
      commitState((previousState) => ({
        ...previousState,
        participants: previousState.participants.filter(
          (participant) => participant.id !== pendingDangerAction.participantId,
        ),
        events: previousState.events.filter(
          (event) => event.participantId !== pendingDangerAction.participantId,
        ),
      }));
      setStatusMessage(
        `${pendingDangerAction.participantName} を削除しました。`,
      );
    }

    if (pendingDangerAction.type === "resetScores") {
      commitState((previousState) => ({
        ...previousState,
        participants: previousState.participants.map((participant) => ({
          ...participant,
          score: 0,
          updatedAt: Date.now(),
        })),
        events: [],
      }));
      setStatusMessage("全員の得点を 0 にしました。");
    }

    if (pendingDangerAction.type === "clearBoard") {
      clearBlank25PartyState();
      setPartyState(createBlank25PartyState(Date.now()));
      previousSoleLeaderIdRef.current = null;
      leaderEffectReadyRef.current = false;
      setNewParticipantName("");
      setNewParticipantScore("0");
      setNewParticipantIcon(null);
      setStatusMessage("ボードを初期化しました。");
    }

    setPendingDangerAction(null);
  }, [commitState, pendingDangerAction]);

  const updatedAtLabel =
    partyState.updatedAt > 0
      ? updatedAtFormatter.format(partyState.updatedAt)
      : "未保存";
  const handleTimerFinish = useCallback(() => {
    setStatusMessage("GMタイマーが終了しました。");
  }, []);

  if (!hydrated || isDesktop === null) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Card className="border-gray-700 bg-gray-900/80">
          <CardHeader>
            <CardTitle className="text-white">ステージを読み込み中</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">
            ローカルデータを同期しています。
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isDesktop) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Card className="overflow-hidden border-purple-300/25 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.18),transparent_62%),linear-gradient(to_bottom,rgba(3,7,18,0.96),rgba(17,24,39,0.94))] shadow-2xl shadow-black/30">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-purple-300/20 bg-purple-400/10">
              <Monitor className="h-7 w-7 text-purple-200" />
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-white">
              PC 専用ステージ
            </h2>
            <p className="mt-3 text-sm text-gray-300">
              このパーティボードはデスクトップ表示に限定しています。
            </p>
            <Button
              asChild
              className="mt-6 bg-white text-gray-950 hover:bg-gray-100"
            >
              <Link href="/blank25">
                <ChevronLeft className="mr-2 h-4 w-4" />
                BLANK25 一覧へ
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1520px] px-6 py-8 xl:px-8">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-purple-300/20 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.16),transparent_52%),linear-gradient(to_bottom,rgba(2,6,23,0.98),rgba(17,24,39,0.96))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(192,132,252,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(192,132,252,0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />
        <div className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/70 to-transparent" />
        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <Button
              asChild
              variant="ghost"
              className="border border-gray-700 bg-gray-950/80 text-gray-100 hover:bg-gray-800"
            >
              <Link href="/blank25">
                <ChevronLeft className="mr-2 h-4 w-4" />
                一覧へ戻る
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <GmTimerControl onFinish={handleTimerFinish} />
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-purple-100">
                <PartyPopper className="h-3.5 w-3.5" />
                PC 専用
              </div>
            </div>
          </div>

          <div className="relative mt-6 overflow-hidden rounded-[2rem] border border-gray-800 bg-black/30 px-6 pb-6 pt-6">
            <div className="absolute left-8 top-8 z-10 max-w-[280px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-gray-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-purple-100">
                <ScanLine className="h-3.5 w-3.5" />
                表彰台コア
              </div>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white xl:text-[3.4rem]">
                Stage
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-gray-700 bg-gray-950/85 px-3 py-1 text-xs font-semibold text-gray-200">
                  参加者 {participantCount}
                </span>
                <span className="rounded-full border border-gray-700 bg-gray-950/85 px-3 py-1 text-xs font-semibold text-gray-200">
                  トップ {topScore ?? 0} pt
                </span>
                <span className="rounded-full border border-gray-700 bg-gray-950/85 px-3 py-1 text-xs font-semibold text-gray-200">
                  {topScore === null
                    ? "未登録"
                    : topGroupCount > 1
                      ? `同点 ${topGroupCount} 組`
                      : "単独トップ"}
                </span>
              </div>
            </div>

            <div className="absolute right-8 top-8 z-10 w-56 space-y-3">
              <div className="rounded-[1.4rem] border border-gray-800 bg-gray-950/82 p-3.5 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.28em] text-gray-500">
                  更新
                </div>
                <div className="mt-2 text-lg font-bold text-white">
                  {updatedAtLabel}
                </div>
              </div>
              <AnimatePresence initial={false}>
                {statusMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-[1.4rem] border border-purple-300/20 bg-purple-400/10 px-3.5 py-3 text-sm text-purple-50 backdrop-blur"
                  >
                    {statusMessage}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="px-8 pt-4">
              <PartyPodiumScene entries={podiumEntries} />
            </div>

            <div className="mx-auto mt-1.5 max-w-[1240px]">
              <PartyPodium
                entries={podiumEntries}
                participantCount={participantCount}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.42fr)_320px]">
        <Card className="overflow-hidden border-gray-700 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.96),rgba(17,24,39,0.9))] shadow-2xl shadow-black/25">
          <CardHeader className="border-b border-gray-800/80 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gray-500">
                  参加者一覧
                </div>
                <CardTitle className="mt-2 text-2xl font-black tracking-tight text-white">
                  スコアノード
                </CardTitle>
              </div>
              <div className="rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-100">
                {participantCount} 組
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {rankedParticipants.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-gray-700 bg-gray-950/50 px-5 py-16 text-center text-sm text-gray-400">
                一番下の操作デッキから参加者を追加してください。
              </div>
            ) : (
              <motion.div layout className="grid gap-3 xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {rankedParticipants.map((participant) => (
                    <ParticipantCard
                      key={participant.id}
                      participant={participant}
                      onRename={renameParticipant}
                      onChangeKind={changeParticipantKind}
                      onPickIcon={handleParticipantIconPick}
                      onClearIcon={clearParticipantIcon}
                      onAdjustScore={adjustParticipantScore}
                      onSetScore={setParticipantScore}
                      onDelete={(participantId, participantName) =>
                        setPendingDangerAction({
                          type: "deleteParticipant",
                          participantId,
                          participantName,
                        })
                      }
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-gray-700 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.96),rgba(17,24,39,0.9))] shadow-2xl shadow-black/25">
          <CardHeader className="border-b border-gray-800/80 pb-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gray-500">
              変更履歴
            </div>
            <CardTitle className="mt-2 text-2xl font-black tracking-tight text-white">
              スコアログ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {latestEvents.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-gray-700 bg-gray-950/50 px-4 py-10 text-center text-sm text-gray-400">
                まだ得点変更はありません。
              </div>
            ) : (
              <div className="space-y-2.5">
                {latestEvents.map(({ event, participantName }) => (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[1.25rem] border border-gray-700 bg-gray-950/72 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-gray-700 bg-gray-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-200">
                            {event.mode === "set" ? "直接編集" : "加減点"}
                          </span>
                          <span className="truncate text-sm font-semibold text-white">
                            {participantName}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-300">
                          {event.fromScore} → {event.toScore}
                          <span className="ml-2 font-semibold text-purple-200">
                            {event.delta >= 0 ? `+${event.delta}` : event.delta}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 text-xs text-gray-400">
                        {historyFormatter.format(event.createdAt)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-5">
        <Card className="overflow-hidden border-gray-700 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.96),rgba(17,24,39,0.9))] shadow-2xl shadow-black/25">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gray-500">
                  追加・操作
                </div>
                <div className="mt-1 text-lg font-black tracking-tight text-white">
                  操作デッキ
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-gray-700 bg-gray-950/82 px-3 py-1 text-xs font-semibold text-gray-200">
                  {participantCount} 組
                </span>
                <span className="rounded-full border border-gray-700 bg-gray-950/82 px-3 py-1 text-xs font-semibold text-gray-200">
                  トップ {topScore ?? 0} pt
                </span>
                <span className="rounded-full border border-gray-700 bg-gray-950/82 px-3 py-1 text-xs font-semibold text-gray-200">
                  更新 {updatedAtLabel}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.95fr)]">
              <form
                className="grid gap-3 lg:grid-cols-[auto_auto_minmax(0,1fr)_110px_auto] lg:items-end"
                onSubmit={addParticipant}
              >
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                    種別
                  </div>
                  <KindToggle
                    value={newParticipantKind}
                    onChange={setNewParticipantKind}
                  />
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                    アイコン
                  </div>
                  <IconPicker
                    id="new-participant-icon"
                    name={newParticipantName || "NEW"}
                    iconDataUrl={newParticipantIcon}
                    onPick={handleNewParticipantIconPick}
                    onClear={() => setNewParticipantIcon(null)}
                    size="compact"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                    名前
                  </label>
                  <Input
                    value={newParticipantName}
                    onChange={(event) =>
                      setNewParticipantName(event.target.value)
                    }
                    placeholder="例: チームA"
                    className="h-10 border-gray-700 bg-gray-950/90 text-base text-white placeholder:text-gray-500 focus-visible:ring-purple-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                    初期得点
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={newParticipantScore}
                    onChange={(event) =>
                      setNewParticipantScore(event.target.value)
                    }
                    className="h-10 border-gray-700 bg-gray-950/90 text-base text-white placeholder:text-gray-500 focus-visible:ring-purple-400"
                  />
                </div>

                <Button
                  type="submit"
                  className="h-10 bg-purple-400 px-4 text-gray-950 hover:bg-purple-300"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  追加
                </Button>
              </form>

              <div className="grid gap-2 lg:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-center border-gray-700 bg-gray-950 text-white hover:bg-gray-800"
                  onClick={undoLastScoreEvent}
                  disabled={partyState.events.length === 0}
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  1つ戻す
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-center border-purple-300/30 bg-purple-400/10 text-purple-100 hover:bg-purple-400/20 hover:text-white"
                  onClick={() =>
                    setPendingDangerAction({ type: "resetScores" })
                  }
                  disabled={participantCount === 0}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  全員 0 点
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 justify-center border border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white"
                  onClick={() => setPendingDangerAction({ type: "clearBoard" })}
                  disabled={
                    participantCount === 0 && partyState.events.length === 0
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  初期化
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={pendingDangerAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDangerAction(null);
        }}
      >
        <DialogContent className="border-gray-700 bg-gradient-to-b from-gray-950 to-gray-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              {pendingDangerAction?.type === "deleteParticipant" &&
                "参加者を削除しますか？"}
              {pendingDangerAction?.type === "resetScores" &&
                "全員の得点を 0 にしますか？"}
              {pendingDangerAction?.type === "clearBoard" &&
                "ボードを初期化しますか？"}
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              {pendingDangerAction?.type === "deleteParticipant" &&
                "この参加者の得点履歴も同時に削除されます。"}
              {pendingDangerAction?.type === "resetScores" &&
                "得点履歴もクリアされます。参加者名は残ります。"}
              {pendingDangerAction?.type === "clearBoard" &&
                "参加者、得点、履歴をまとめて消去します。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="text-gray-300 hover:bg-gray-800 hover:text-white"
              onClick={() => setPendingDangerAction(null)}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              className="bg-white text-gray-950 hover:bg-gray-100"
              onClick={confirmDangerAction}
            >
              実行する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
