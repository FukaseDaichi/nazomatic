import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button,
  Label,
  Input,
} from "nazomatic";

// SheetContent は body へ portal されるため <html> に .dark を付与する
function useDark() {
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);
}

export const RightPanel = () => {
  useDark();
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 min-h-[380px]">
      <Sheet open>
        <SheetContent side="right" className="text-gray-50">
          <SheetHeader>
            <SheetTitle>チーム設定</SheetTitle>
            <SheetDescription className="text-gray-400">
              参加チームの情報を編集します。完了したら保存してください。
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">チーム名</Label>
              <Input id="name" defaultValue="暗号解読班" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="members">人数</Label>
              <Input id="members" type="number" defaultValue={4} />
            </div>
          </div>
          <SheetFooter>
            <Button className="bg-purple-600 text-white hover:bg-purple-500 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500">
              保存する
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};
