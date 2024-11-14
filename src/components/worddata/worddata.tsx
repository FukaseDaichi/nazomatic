"use client";
import { FC } from "react";
import styles from "./worddata.module.css";
import React from "react";

export type WordInfoProps = {
  word: string;
  definition?: string;
  count: number;
  onClickHandler: () => void;
};

const WordData: FC<WordInfoProps> = ({
  word,
  definition,
  count,
  onClickHandler,
}) => {
  const isActive = count > 0;
  return word ? (
    <div
      className={`w-1/12 h-1/5 ${styles.worddata} ${
        isActive ? styles.active : ""
      }`}
      onClick={onClickHandler}
    >
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
