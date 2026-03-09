import { cn } from "@/lib/utils";

type TeamBattleMiniBoardProps = {
  hiddenPanels: readonly number[];
  lockedOpenPanels?: readonly number[];
  newlyOpenedPanels?: readonly number[];
  className?: string;
  showLegendLabels?: boolean;
};

export default function TeamBattleMiniBoard({
  hiddenPanels,
  lockedOpenPanels = [],
  newlyOpenedPanels = [],
  className,
  showLegendLabels = false,
}: TeamBattleMiniBoardProps) {
  const hiddenSet = new Set(hiddenPanels);
  const lockedOpenSet = new Set(lockedOpenPanels);
  const newlyOpenedSet = new Set(newlyOpenedPanels);

  return (
    <div
      className={cn("grid grid-cols-5 gap-1.5", className)}
      role="img"
      aria-label="BLANK25の25マス盤面イメージ"
    >
      {Array.from({ length: 25 }, (_, index) => {
        const panelNumber = index + 1;
        const isHidden = hiddenSet.has(panelNumber);
        const isLockedOpen = !isHidden && lockedOpenSet.has(panelNumber);
        const isNewlyOpened = !isHidden && newlyOpenedSet.has(panelNumber);

        return (
          <div
            key={panelNumber}
            className={cn(
              "relative aspect-square rounded-[0.9rem] border text-[11px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
              "flex items-center justify-center overflow-hidden transition-colors",
              isHidden &&
                "border-gray-500/90 bg-black text-gray-100 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]",
              isLockedOpen &&
                "border-purple-300/40 bg-purple-400/10 text-purple-100",
              isNewlyOpened &&
                "border-white/15 bg-white/10 text-white",
              !isHidden &&
                !isLockedOpen &&
                !isNewlyOpened &&
                "border-white/10 bg-gray-900/75 text-gray-400",
            )}
            aria-hidden="true"
          >
            {!isHidden && (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_70%)]" />
            )}
            <span className="relative z-10">{panelNumber}</span>
            {showLegendLabels && isLockedOpen && (
              <span className="absolute bottom-1 rounded-full bg-purple-300/20 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] text-purple-50">
                FIX
              </span>
            )}
            {showLegendLabels && isNewlyOpened && (
              <span className="absolute bottom-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] text-white">
                NEW
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
