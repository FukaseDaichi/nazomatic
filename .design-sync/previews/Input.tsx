import * as React from "react";
import { Input, Label, Button } from "nazomatic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 min-h-[120px]">
      {children}
    </div>
  );
}

export const WithLabel = () => (
  <Frame>
    <div className="grid w-full max-w-sm items-center gap-2">
      <Label htmlFor="answer">解答を入力</Label>
      <Input id="answer" placeholder="例: ナゾマチック" />
      <p className="text-xs text-gray-400">ひらがな・カタカナは自動で統一されます</p>
    </div>
  </Frame>
);

export const Types = () => (
  <Frame>
    <div className="grid w-full max-w-sm gap-3">
      <Input type="email" placeholder="メールアドレス" />
      <Input type="password" placeholder="パスワード" defaultValue="secret" />
      <Input type="number" placeholder="チーム人数" />
    </div>
  </Frame>
);

export const States = () => (
  <Frame>
    <div className="grid w-full max-w-sm gap-3">
      <Input defaultValue="入力済みの解答" />
      <Input placeholder="無効化された入力" disabled />
      <div className="flex gap-2">
        <Input placeholder="クーポンコード" />
        <Button className="bg-purple-600 text-white hover:bg-purple-500 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500">適用</Button>
      </div>
    </div>
  </Frame>
);
