"use client";

import { StylishAutoResizeTextareaComponent } from "@/components/textarea/stylish-auto-resize-textarea";
import WordList from "@/components/wordlist/wordlist";
import { useCallback, useEffect, useState } from "react";
import hiragana from "@/lib/json/hiragana.json";
import { WordInfoProps } from "@/components/worddata/worddata";
import { ShiritoriResultComponent } from "@/components/shiritoriResult/shiritori-result";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardTitle } from "@/components/ui/card";
import Article from "@/components/common/json-ld-component";
import ArticleHeaderComponent from "@/components/common/article-header-component";

const hiraganaList = hiragana.list;

const countHiragana = (hiragana: any, text: string): number => {
  // パターンをまとめて正規表現を作る
  const regexPattern = new RegExp(hiragana.paterns, "g");
  // マッチする部分をすべてカウント
  const matches = text.match(regexPattern);

  // マッチした数を返す（マッチしなければ0）
  return matches ? matches.length : 0;
};

export default function Comprehensive() {
  const [text, setText] = useState<string>("");
  const [shiritoriText, setShiritoriText] = useState<string>("");
  const [wordInfos, setWordInfos] = useState<Array<WordInfoProps>>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const addWord = useCallback((word: string) => {
    setText((pre) => pre + word);
  }, []);

  useEffect(() => {
    setWordInfos(
      hiraganaList.map((hiragana) => {
        const data: WordInfoProps = {
          word: hiragana.value,
          count: countHiragana(hiragana, text),
          number: hiragana.number ?? 0,
          onClickHandler: () => addWord(hiragana.value),
        };
        return data;
      })
    );
  }, [text, addWord]);

  const generateShiritori = useCallback(() => {
    setShiritoriText(text);
    setIsModalOpen(true);
  }, [text]);

  return (
    <>
      <ArticleHeaderComponent />
      <Article index={0} />
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-gray-900 to-gray-800">
        <Card className="bg-gray-800 border-gray-700 flex flex-col items-center mx-auto text-white sm:p-4 md:p-8 mt-5 w-full sm:w-auto">
          <WordList wordInfos={wordInfos} />
          <StylishAutoResizeTextareaComponent value={text} setValue={setText} />
          <Button
            onClick={generateShiritori}
            className="bg-purple-600 hover:bg-purple-700 text-white mb-4"
          >
            ✨しりとり生成 ✨
          </Button>
        </Card>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[1000px] overflow-y-auto text-black">
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-bold">
                <CardTitle className="text-2xl font-bold text-center text-purple-800 dark:text-purple-200">
                  しりとり結果
                </CardTitle>
              </DialogTitle>
            </DialogHeader>
            {shiritoriText && (
              <ShiritoriResultComponent inputText={shiritoriText} />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
