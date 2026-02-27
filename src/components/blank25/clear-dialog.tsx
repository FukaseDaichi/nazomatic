"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Blank25ClearDialog({
  open,
  onOpenChange,
  score,
  openedCount,
  countLabel = "開封",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  score: number;
  openedCount: number;
  countLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[70] overflow-hidden border-gray-700 bg-gradient-to-b from-gray-950 to-gray-900 text-white">
        <DialogHeader className="relative">
          <DialogTitle className="text-center text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-yellow-200 bg-clip-text text-transparent">
              CLEAR!
            </span>
          </DialogTitle>
          <DialogDescription className="text-center text-gray-300">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-300" />
              おめでとう！正解です。
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2 grid gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
            <div className="text-xs text-gray-300">スコア（残りパネル数）</div>
            <div className="mt-1 text-5xl font-black text-white">{score}</div>
          </div>
          <div className="text-center text-sm text-gray-300">
            {countLabel}:{" "}
            <span className="text-white font-semibold">{openedCount}</span> / 25
          </div>
        </div>

        <DialogFooter className="relative">
          <DialogClose asChild>
            <Button className="bg-white text-gray-900 hover:bg-gray-100">
              OK
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
