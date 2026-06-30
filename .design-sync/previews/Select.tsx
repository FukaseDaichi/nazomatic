import * as React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "nazomatic";

// SelectContent は body へ portal されるため <html> に .dark を付与する
function useDark() {
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);
}

export const Open = () => {
  useDark();
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 min-h-[420px]">
      <Select defaultValue="shibuya" defaultOpen>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="開催エリアを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>関東</SelectLabel>
            <SelectItem value="shibuya">渋谷</SelectItem>
            <SelectItem value="shinjuku">新宿</SelectItem>
            <SelectItem value="yokohama">横浜</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export const Closed = () => (
  <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8 min-h-[120px]">
    <Select defaultValue="normal">
      <SelectTrigger className="w-64">
        <SelectValue placeholder="難易度を選択" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="easy">やさしい</SelectItem>
        <SelectItem value="normal">ふつう</SelectItem>
        <SelectItem value="hard">むずかしい</SelectItem>
      </SelectContent>
    </Select>
  </div>
);
