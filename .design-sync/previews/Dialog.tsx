import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "nazomatic";

// オーバーレイは body へ portal されるため、dark バリアントを効かせるには
// <html> に .dark を付ける。card は単一セル + 固定ビューポートで描画する。
function useDark() {
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);
}

export const Confirm = () => {
  useDark();
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 min-h-[360px]">
      <Dialog open>
        {/* portal 先の body には text 色が無いため、content 側で text-gray-50 を指定 */}
        <DialogContent className="text-gray-50">
          <DialogHeader>
            <DialogTitle>解答を確定しますか？</DialogTitle>
            <DialogDescription className="text-gray-400">
              一度送信すると修正できません。残りの挑戦回数は 2 回です。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">戻る</Button>
            <Button className="bg-purple-600 text-white hover:bg-purple-500 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500">
              確定して送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
