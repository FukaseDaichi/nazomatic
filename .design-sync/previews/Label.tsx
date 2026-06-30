import * as React from "react";
import { Label, Input } from "nazomatic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 min-h-[120px]">
      {children}
    </div>
  );
}

export const WithInput = () => (
  <Frame>
    <div className="grid w-full max-w-sm items-center gap-2">
      <Label htmlFor="team">チーム名</Label>
      <Input id="team" placeholder="例: 暗号解読班" />
    </div>
  </Frame>
);

// peer-disabled で無効状態のラベルを薄く表示する shadcn の作法
export const States = () => (
  <Frame>
    <div className="grid w-full max-w-sm gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input id="email" type="email" placeholder="you@example.com" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="code" className="text-purple-300">
          招待コード（任意）
        </Label>
        <Input id="code" placeholder="NAZO-XXXX" />
      </div>
    </div>
  </Frame>
);
