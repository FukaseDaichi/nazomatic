"use client";
import { FC } from "react";
import styles from "./worddata.module.css";
import React from "react";

export type WordInfoProps = {
  word: string;
  definition?: string;
  count: number;
  onClickHandler: () => void;
  number: number;
};

const WordData: FC<WordInfoProps> = ({
  word,
  definition,
  count,
  onClickHandler,
  number,
}) => {
  const isActive = count > 0;
  return word ? (
    <div
      className={`w-1/12 h-1/5 ${styles.worddata} ${
        isActive ? styles.active : ""
      } relative`}
      onClick={onClickHandler}
    >
      <div className="absolute -top-1 -left-2 text-[0.6rem] text-gray-400 px-1 m-0.5 leading-3 min-w-[1.2rem] text-center">
        {number}
      </div>
      <div className={`bg-purple-100 rounded-lg ${styles.word} text-gray-500`}>
        {word}
      </div>
      <div className={styles.count}>{count}</div>
    </div>
  ) : (
    <div className={`w-1/12 h-1/5`}></div>
  );
};

export default React.memo(WordData);
