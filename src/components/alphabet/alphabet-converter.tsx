"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const AlphabetConverter = () => {
  const [inputNumber, setInputNumber] = useState("");
  const [inputLetter, setInputLetter] = useState("");
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputNumber(value);
  };

  const handleLetterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .replace(/[Ａ-Ｚａ-ｚ]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0)
      )
      .toUpperCase();
    setInputLetter(value);
  };
  const getCorrespondingLetter = () => {
    if (!inputNumber) {
      return "";
    }
    const normalizedInput = inputNumber
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[ー−\s　]/g, "-");

    if (normalizedInput.includes("-")) {
      return normalizedInput
        .split("-")
        .map((num) => {
          const n = parseInt(num);
          return n >= 1 && n <= 26 ? alphabet[n - 1] : "?";
        })
        .join("");
    }
    const num = parseInt(normalizedInput);
    if (num >= 1 && num <= 26) {
      return alphabet[num - 1];
    }
    return "?";
  };

  const getCorrespondingNumber = () => {
    if (inputLetter) {
      return inputLetter
        .split("")
        .map((letter) => {
          const index = alphabet.indexOf(letter);
          return index !== -1 ? index + 1 : "?";
        })
        .join(" ");
    }
    return "";
  };

  return (
    <main className="p-8">
      <TooltipProvider>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">
            アルファベット数字システム
          </h1>
          <Card className="bg-gray-800 border-gray-700 md:col-span-2 flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-purple-400">
                  アルファベット表
                </CardTitle>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <Label
                    htmlFor="selectedLetters"
                    className="text-sm font-medium text-gray-300 whitespace-nowrap"
                  >
                    選択された文字:
                  </Label>
                  <Input
                    id="selectedLetters"
                    type="text"
                    value={selectedLetters.join("")}
                    onChange={(e) => {
                      const value = e.target.value
                        .replace(/[Ａ-Ｚａ-ｚ]/g, (s) =>
                          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
                        )
                        .toUpperCase();
                      setSelectedLetters(
                        value
                          .split("")
                          .filter((char) => alphabet.includes(char))
                      );
                    }}
                    className="bg-gray-700 border-gray-600 text-white uppercase"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-13 gap-2">
                {alphabet.split("").map((letter, index) => (
                  <Tooltip key={letter}>
                    <TooltipTrigger>
                      <div
                        className="relative group"
                        onClick={() => {
                          if (selectedLetters.includes(letter)) {
                            setSelectedLetters(
                              selectedLetters.filter((l) => l !== letter)
                            );
                          } else {
                            setSelectedLetters([...selectedLetters, letter]);
                          }
                        }}
                      >
                        <div
                          className={`flex items-center justify-center p-2 rounded-lg h-12 transition-all duration-300 
                          ${
                            selectedLetters.includes(letter)
                              ? "bg-purple-500"
                              : "bg-gray-700 group-hover:bg-purple-500"
                          }`}
                        >
                          <span className="text-2xl font-bold text-white">
                            {letter}
                          </span>
                        </div>
                        <span className="absolute top-0 left-0 bg-gray-900 text-gray-400 text-xs px-1 rounded-tl-lg rounded-br-lg opacity-75 transition-opacity duration-300 group-hover:opacity-100">
                          {index + 1}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {letter} = {index + 1}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-purple-400">
                  数字からアルファベットへの変換
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label
                  htmlFor="numberInput"
                  className="text-sm font-medium text-gray-300"
                >
                  数字をスペース区切りで入力
                </Label>
                <Input
                  id="numberInput"
                  type="text"
                  value={inputNumber}
                  onChange={handleNumberInputChange}
                  className="mt-1 bg-gray-700 border-gray-600 text-white"
                />
                <div className="mt-4">
                  <span className="text-sm font-semibold text-purple-300">
                    対応するアルファベット:{" "}
                  </span>
                  <span className="text-lg text-purple-400">
                    {getCorrespondingLetter()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-purple-400">
                  アルファベットから数字への変換
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label
                  htmlFor="letterInput"
                  className="text-sm font-medium text-gray-300"
                >
                  アルファベットを入力 (A-Z):
                </Label>
                <Input
                  id="letterInput"
                  type="text"
                  value={inputLetter}
                  onChange={handleLetterInputChange}
                  className="mt-1 bg-gray-700 border-gray-600 text-white uppercase"
                />
                <div className="mt-4">
                  <span className="text-sm font-semibold text-purple-300">
                    対応する数字:{" "}
                  </span>
                  <span className="text-lg text-purple-400">
                    {getCorrespondingNumber()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TooltipProvider>
    </main>
  );
};
