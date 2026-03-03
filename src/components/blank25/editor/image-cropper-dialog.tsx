"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CropResult = {
  base64: string;
  contentType: "image/webp";
  previewUrl: string;
};

type Blank25ImageCropperDialogProps = {
  open: boolean;
  imageUrl: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (result: CropResult) => void;
};

const OUTPUT_SIZE = 1024;
const OUTPUT_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.92;

const createImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read image data."));
        return;
      }
      resolve(reader.result.replace(/^data:[^;]+;base64,/, ""));
    };
    reader.onerror = () => reject(new Error("Failed to read image data."));
    reader.readAsDataURL(blob);
  });

const getCroppedSquareWebp = async ({
  imageUrl,
  croppedAreaPixels,
}: {
  imageUrl: string;
  croppedAreaPixels: Area;
}): Promise<{ blob: Blob; previewUrl: string; base64: string }> => {
  const sourceImage = await createImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context is unavailable.");
  }

  ctx.drawImage(
    sourceImage,
    Math.round(croppedAreaPixels.x),
    Math.round(croppedAreaPixels.y),
    Math.round(croppedAreaPixels.width),
    Math.round(croppedAreaPixels.height),
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY);
  });
  if (!blob) {
    throw new Error("Failed to create cropped image.");
  }

  const previewUrl = canvas.toDataURL(OUTPUT_TYPE, OUTPUT_QUALITY);
  const base64 = await blobToBase64(blob);

  return { blob, previewUrl, base64 };
};

const Blank25RulerOverlay = ({ showNumbers }: { showNumbers: boolean }) => (
  <div className="pointer-events-none absolute inset-0 z-20">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)",
        backgroundSize: "20% 20%",
      }}
    />
    <div className="absolute inset-0 border border-white/70" />
    {showNumbers && (
      <div className="absolute inset-0 grid grid-cols-5 grid-rows-5">
        {Array.from({ length: 25 }, (_, index) => (
          <span
            key={index + 1}
            className="flex items-center justify-center text-[10px] font-semibold text-white/85 drop-shadow-[0_0_2px_rgba(0,0,0,0.7)] sm:text-xs"
          >
            {index + 1}
          </span>
        ))}
      </div>
    )}
  </div>
);

export default function Blank25ImageCropperDialog({
  open,
  imageUrl,
  onOpenChange,
  onApply,
}: Blank25ImageCropperDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showNumbers, setShowNumbers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
    setSubmitting(false);
  }, [open, imageUrl]);

  const canApply = useMemo(
    () => Boolean(imageUrl) && Boolean(croppedAreaPixels) && !submitting,
    [croppedAreaPixels, imageUrl, submitting],
  );

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApply = useCallback(async () => {
    if (!imageUrl || !croppedAreaPixels || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { base64, previewUrl } = await getCroppedSquareWebp({
        imageUrl,
        croppedAreaPixels,
      });
      onApply({
        base64,
        contentType: "image/webp",
        previewUrl,
      });
      onOpenChange(false);
    } catch {
      setError("画像の切り出しに失敗しました。別の画像で再試行してください。");
    } finally {
      setSubmitting(false);
    }
  }, [croppedAreaPixels, imageUrl, onApply, onOpenChange, submitting]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto border-gray-700 bg-gray-900 text-gray-100">
        <DialogHeader>
          <DialogTitle>画像トリミング</DialogTitle>
          <DialogDescription className="text-gray-400">
            正方形で切り出します。5x5 ルーラーを目安に調整してください。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-lg border border-gray-700 bg-black">
            {imageUrl && (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                showGrid={false}
                cropShape="rect"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain"
                minZoom={1}
                maxZoom={3}
              />
            )}
            <Blank25RulerOverlay showNumbers={showNumbers} />
          </div>

          <div className="grid gap-3">
            <label className="text-sm text-gray-300">
              ズーム: {zoom.toFixed(2)}x
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700"
            />

            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={showNumbers}
                onChange={(event) => setShowNumbers(event.target.checked)}
              />
              ルーラー番号（1-25）を表示
            </label>

            {error && <p className="text-sm text-red-300">{error}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="bg-white text-gray-900"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? "切り出し中..." : "この範囲で確定"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
