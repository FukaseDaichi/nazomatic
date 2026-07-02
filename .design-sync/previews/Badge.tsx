import * as React from "react";
import { Badge } from "nazomatic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 flex flex-wrap items-center gap-3 min-h-[100px]">
      {children}
    </div>
  );
}

export const Variants = () => (
  <Frame>
    <Badge>開催中</Badge>
    <Badge variant="secondary">準備中</Badge>
    <Badge variant="destructive">終了</Badge>
    <Badge variant="outline">下書き</Badge>
  </Frame>
);

// ブランドアクセント。dark-first なので dark:bg も併記する
export const BrandAndStatus = () => (
  <Frame>
    <Badge className="bg-purple-600 text-white dark:bg-purple-600 dark:text-white">NEW</Badge>
    <Badge className="border-purple-400 text-purple-300 dark:border-purple-400 dark:text-purple-300" variant="outline">
      謎解き
    </Badge>
    <Badge className="bg-green-600 text-white dark:bg-green-600 dark:text-white">クリア</Badge>
    <Badge variant="secondary">残り3問</Badge>
  </Frame>
);
