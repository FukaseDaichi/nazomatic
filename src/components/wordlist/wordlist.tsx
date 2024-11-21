"use client";
import { Card } from "../ui/card";
import WordData, { WordInfoProps } from "../worddata/worddata";

type WordListProps = {
  wordInfos: Array<WordInfoProps>;
};

export default function WordList({ wordInfos }: WordListProps) {
  return (
    <Card className="flex flex-col flex-wrap-reverse w-full sm:w-96 h-64 mx-auto my-8 text-lg p-0 sm:p-3 bg-gray-700 border-gray-600">
      {wordInfos.map((wordInfo, index) => (
        <WordData
          key={index}
          word={wordInfo.word}
          count={wordInfo.count}
          onClickHandler={wordInfo.onClickHandler}
          number={wordInfo.number}
        />
      ))}
    </Card>
  );
}
