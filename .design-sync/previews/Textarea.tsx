import * as React from "react";
import { Textarea, Label, Button } from "nazomatic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 min-h-[160px]">
      {children}
    </div>
  );
}

export const WithLabel = () => (
  <Frame>
    <div className="grid w-full max-w-md gap-2">
      <Label htmlFor="hint">謎の解説文</Label>
      <Textarea
        id="hint"
        rows={4}
        placeholder="この謎の解き方やヒントを入力してください…"
      />
      <p className="text-xs text-gray-400">参加者には正解後に表示されます</p>
    </div>
  </Frame>
);

export const States = () => (
  <Frame>
    <div className="grid w-full max-w-md gap-4">
      <Textarea defaultValue={"最初の暗号を解くと、次の場所のヒントが現れます。\n落ち着いて盤面全体を見渡しましょう。"} rows={3} />
      <Textarea placeholder="無効化された入力" rows={2} disabled />
      <div className="flex justify-end">
        <Button className="bg-purple-600 text-white hover:bg-purple-500 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500">
          保存
        </Button>
      </div>
    </div>
  </Frame>
);
