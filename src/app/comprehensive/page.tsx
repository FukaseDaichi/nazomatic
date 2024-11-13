"use client";

import { StylishAutoResizeTextareaComponent } from "@/components/textarea/stylish-auto-resize-textarea";
import WordList from "@/components/wordlist/wordlist";
import { useCallback, useEffect, useState } from "react";
import hiragana from "@/lib/json/hiragana.json";
import { WordInfoProps } from "@/components/worddata/worddata";
import { ShiritoriResultComponent } from "@/components/shiritoriResult/shiritori-result";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    //初回実行時
    setWordInfos(
      hiraganaList.map((hiragana) => {
        const data: WordInfoProps = {
          word: hiragana.value,
          count: 0,
          onClickHandler: () => alert(`Word: ${hiragana}`),
        };
        return data;
      })
    );
  }, []);

  useEffect(() => {
    setWordInfos(
      hiraganaList.map((hiragana) => {
        const data: WordInfoProps = {
          word: hiragana.value,
          count: countHiragana(hiragana, text),
          onClickHandler: () => alert(`Word: ${hiragana.value}`),
        };
        return data;
      })
    );
  }, [text]);

  const generateShiritori = useCallback(() => {
    setShiritoriText(text);
  }, [text]);

  return (
    <main className="flex min-h-screen flex-col items-center">
      <WordList wordInfos={wordInfos} />
      <StylishAutoResizeTextareaComponent value={text} setValue={setText} />
      <Button onClick={generateShiritori}>✨しりとり生成 ✨</Button>
      {shiritoriText && <ShiritoriResultComponent inputText={shiritoriText} />}
    </main>
  );
}
