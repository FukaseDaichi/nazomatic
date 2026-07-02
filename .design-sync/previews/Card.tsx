import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "nazomatic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 flex flex-wrap gap-6">
      {children}
    </div>
  );
}

export const PuzzleCard = () => (
  <Frame>
    <Card className="w-80 border-gray-800 bg-gray-900/60">
      <CardHeader>
        <CardTitle>謎解きイベント #12</CardTitle>
        <CardDescription>渋谷ナゾトキ街めぐり 2026</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-gray-300">
        制限時間90分。全5問のうち3問以上の正解でクリアです。チームで協力して暗号を読み解きましょう。
      </CardContent>
      <CardFooter className="flex justify-between">
        <span className="text-xs text-gray-400">参加 24チーム</span>
        <Button className="bg-purple-600 text-white hover:bg-purple-500 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500">参加する</Button>
      </CardFooter>
    </Card>
  </Frame>
);

export const StatCard = () => (
  <Frame>
    <Card className="w-64 border-gray-800 bg-gray-900/60">
      <CardHeader className="pb-2">
        <CardDescription>正答率</CardDescription>
        <CardTitle className="text-3xl text-purple-400">68.4%</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-sm text-gray-300">
        <Badge className="bg-purple-600 text-white dark:bg-purple-600 dark:text-white">+4.2%</Badge>
        <span>先週比</span>
      </CardContent>
    </Card>
  </Frame>
);
