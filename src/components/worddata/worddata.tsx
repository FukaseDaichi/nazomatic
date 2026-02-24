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
      className={`w-9 h-1/5 relative group ${styles.worddata} ${
        isActive ? styles.active : ""
      } relative`}
      onClick={onClickHandler}
    >
      <span
        className={`absolute top-0 left-0 bg-gray-900 text-gray-400 px-1 rounded-tl-lg rounded-br-lg opacity-75 transition-opacity duration-300 group-hover:opacity-100 text-white ${styles.number}`}
      >
        {number}
      </span>
      <div className={`rounded-lg ${styles.word} bg-gray-500 text-white`}>
        {word}
      </div>
      <div className={styles.count}>{count}</div>
    </div>
  ) : (
    <div className={`w-1/10 h-1/5`}></div>
  );
};

export default React.memo(WordData);
