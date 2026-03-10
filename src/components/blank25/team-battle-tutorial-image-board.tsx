import Image from "next/image";
import { cn } from "@/lib/utils";
import { TEAM_BATTLE_TUTORIAL_IMAGE_URL } from "@/components/blank25/team-battle-board";

type TeamBattleTutorialImageBoardProps = {
  hiddenPanels: readonly number[];
  lockedOpenPanels?: readonly number[];
  newlyOpenedPanels?: readonly number[];
  className?: string;
  showLegendLabels?: boolean;
  onPanelToggle?: (panelNumber: number) => void;
};

export default function TeamBattleTutorialImageBoard({
  hiddenPanels,
  lockedOpenPanels = [],
  newlyOpenedPanels = [],
  className,
  showLegendLabels = false,
  onPanelToggle,
}: TeamBattleTutorialImageBoardProps) {
  const hiddenSet = new Set(hiddenPanels);
  const lockedOpenSet = new Set(lockedOpenPanels);
  const newlyOpenedSet = new Set(newlyOpenedPanels);
  const isInteractive = typeof onPanelToggle === "function";

  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full overflow-hidden border border-white/10 bg-gray-950/70 shadow-[0_20px_60px_rgba(0,0,0,0.38)]",
        className,
      )}
    >
      <Image
        src={TEAM_BATTLE_TUTORIAL_IMAGE_URL}
        alt="BLANK25 チュートリアル問題"
        fill
        sizes="(max-width: 768px) 100vw, 480px"
        className="object-cover"
      />
      <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 gap-0">
        {Array.from({ length: 25 }, (_, index) => {
          const panelNumber = index + 1;
          const isHidden = hiddenSet.has(panelNumber);
          const isLockedOpen = !isHidden && lockedOpenSet.has(panelNumber);
          const isNewlyOpened = !isHidden && newlyOpenedSet.has(panelNumber);
          const panelContent = (
            <>
              <div
                className={cn(
                  "absolute inset-0 bg-transparent",
                  isInteractive &&
                    !isHidden &&
                    "transition-colors group-hover:bg-black/35 group-focus-visible:bg-black/35",
                )}
              />
              {isHidden && (
                <div className="absolute inset-0 bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]" />
              )}
              {isLockedOpen && (
                <div className="absolute inset-0 border border-purple-200/55 bg-purple-500/55 backdrop-blur-[1px]" />
              )}
              {isNewlyOpened && (
                <div className="absolute inset-0 border border-white/60 bg-white/45 backdrop-blur-[1px]" />
              )}
              {isHidden && (
                <span className="relative z-10 text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.9)]">
                  {panelNumber}
                </span>
              )}
              {showLegendLabels && isHidden && (
                <span className="absolute left-1 top-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] text-white">
                  HIDE
                </span>
              )}
              {showLegendLabels && isLockedOpen && (
                <span className="absolute bottom-1 rounded-full bg-purple-200/25 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] text-white">
                  FIX
                </span>
              )}
              {showLegendLabels && isNewlyOpened && (
                <span className="absolute bottom-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] text-white">
                  NEW
                </span>
              )}
            </>
          );

          if (onPanelToggle) {
            return (
              <button
                key={panelNumber}
                type="button"
                onClick={() => onPanelToggle(panelNumber)}
                aria-label={`パネル ${panelNumber} を${isHidden ? "戻す" : "隠す"}`}
                aria-pressed={isHidden}
                className={cn(
                  "group relative flex items-center justify-center border text-[11px] font-black transition-colors",
                  isHidden ? "border-white" : "border-white/15",
                  "cursor-pointer focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80",
                )}
              >
                {panelContent}
              </button>
            );
          }

          return (
            <div
              key={panelNumber}
              className="relative flex items-center justify-center border border text-[11px] font-black transition-colors"
            >
              {panelContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
