import * as React from "react";
import { Separator } from "nazomatic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 min-h-[120px]">
      {children}
    </div>
  );
}

export const Horizontal = () => (
  <Frame>
    <div className="max-w-sm">
      <div className="space-y-1">
        <h4 className="text-sm font-medium">NAZOMATIC</h4>
        <p className="text-sm text-gray-400">謎解き・イベント支援ツール</p>
      </div>
      <Separator className="my-4 bg-gray-700" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <span>謎を作る</span>
        <Separator orientation="vertical" className="bg-gray-700" />
        <span>遊ぶ</span>
        <Separator orientation="vertical" className="bg-gray-700" />
        <span>集計</span>
      </div>
    </div>
  </Frame>
);
