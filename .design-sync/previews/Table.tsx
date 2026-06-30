import * as React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Badge,
} from "nazomatic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      {children}
    </div>
  );
}

const ROWS = [
  { rank: 1, team: "暗号解読班", solved: 5, time: "01:12:30" },
  { rank: 2, team: "ナゾ友", solved: 5, time: "01:18:04" },
  { rank: 3, team: "謎の集団", solved: 4, time: "01:25:47" },
  { rank: 4, team: "ひらめきチーム", solved: 4, time: "01:31:09" },
];

export const Leaderboard = () => (
  <Frame>
    <Table>
      <TableCaption>渋谷ナゾトキ街めぐり — 暫定順位</TableCaption>
      <TableHeader>
        <TableRow className="border-gray-800 hover:bg-transparent">
          <TableHead className="w-16">順位</TableHead>
          <TableHead>チーム</TableHead>
          <TableHead className="text-right">正解数</TableHead>
          <TableHead className="text-right">タイム</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((r) => (
          <TableRow key={r.rank} className="border-gray-800">
            <TableCell>
              {r.rank === 1 ? (
                <Badge className="bg-purple-600 text-white dark:bg-purple-600 dark:text-white">1位</Badge>
              ) : (
                r.rank
              )}
            </TableCell>
            <TableCell className="font-medium">{r.team}</TableCell>
            <TableCell className="text-right">{r.solved} / 5</TableCell>
            <TableCell className="text-right tabular-nums">{r.time}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Frame>
);
