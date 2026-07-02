import * as React from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Button,
} from "nazomatic";

export const Open = () => (
  <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-12 flex flex-col items-center min-h-[200px]">
    <TooltipProvider delayDuration={0}>
      <Tooltip open>
        <TooltipTrigger asChild>
          <Button variant="secondary" style={{ width: "fit-content", alignSelf: "center" }}>
            ヒントを見る
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          残りヒント: 2回。スコアには影響しません。
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);
