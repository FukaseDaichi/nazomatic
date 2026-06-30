import * as React from "react";
import { Button } from "nazomatic";

// NAZOMATIC は dark-first。primitive は .dark 配下で本来の見た目になり、
// ブランドの主役アクションは purple アクセントで装飾して使う。
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 flex flex-wrap items-center gap-3 min-h-[120px]">
      {children}
    </div>
  );
}

export const Variants = () => (
  <Frame>
    <Button>謎を解く</Button>
    <Button variant="secondary">ヒントを見る</Button>
    <Button variant="outline">あとで</Button>
    <Button variant="ghost">スキップ</Button>
    <Button variant="link">遊び方</Button>
    <Button variant="destructive">リセット</Button>
  </Frame>
);

export const Sizes = () => (
  <Frame>
    <Button size="sm">小</Button>
    <Button size="default">標準</Button>
    <Button size="lg">大きく解答する</Button>
    <Button size="icon" aria-label="お気に入り">★</Button>
  </Frame>
);

// NAZOMATIC のブランドアクセント (purple) を主役ボタンに適用する実使用パターン。
// dark-first なので bg だけでなく dark:bg も指定しないと default variant の
// dark:bg-gray-50 に上書きされて白くなる点に注意。
export const BrandAccent = () => (
  <Frame>
    <Button className="bg-purple-600 text-white hover:bg-purple-500 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500">
      解答を送信
    </Button>
    <Button variant="outline" className="border-purple-400 text-purple-300 hover:bg-purple-400/10 dark:border-purple-400 dark:text-purple-300 dark:hover:bg-purple-400/10">
      別の謎へ
    </Button>
  </Frame>
);

export const States = () => (
  <Frame>
    <Button disabled>解答受付前</Button>
    <Button variant="secondary" disabled>
      集計中…
    </Button>
  </Frame>
);
