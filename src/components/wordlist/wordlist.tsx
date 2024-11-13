"use client";
import WordData, { WordInfoProps } from "../worddata/worddata";

type WordListProps = {
  wordInfos: Array<WordInfoProps>;
};

export default function WordList({ wordInfos }: WordListProps) {
  return (
    <div className="flex flex-col flex-wrap-reverse w-96 h-64 mx-auto my-8 text-lg">
      {wordInfos.map((wordInfo, index) => (
        <WordData
          key={index}
          word={wordInfo.word}
          count={wordInfo.count}
          onClickHandler={wordInfo.onClickHandler}
        />
      ))}
    </div>
  );
}
