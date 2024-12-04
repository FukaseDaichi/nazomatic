"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CaseUpper, ArrowLeftRight } from "lucide-react";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const getCorrespondingNumber = (str: string) => {
  const value = str
    .replace(/[Ａ-Ｚａ-ｚ]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    )
    .toUpperCase();

  if (value) {
    return value
      .split("")
      .map((letter) => {
        const index = alphabet.indexOf(letter);
        return index !== -1 ? index + 1 : "?";
      })
      .join(" ");
  }
  return "";
};

const getViewWordByStr = (str: string) => {
  const n = parseInt(str);
  return n >= 1 && n <= 26 ? alphabet[n - 1] : getCorrespondingNumber(str);
};

const getRegexAlphabet = (letter: string) => {
  const lowerLetter = letter.toLowerCase();
  const fullWidthUpperLetter = String.fromCharCode(
    letter.charCodeAt(0) + 0xfee0
  );
  const fullWidthLowerLetter = String.fromCharCode(
    lowerLetter.charCodeAt(0) + 0xfee0
  );
  const regex = new RegExp(
    `[${letter}${lowerLetter}${fullWidthUpperLetter}${fullWidthLowerLetter}]`,
    "g"
  );
  return regex;
};

export const AlphabetConverter = () => {
  const [inputText, setInputText] = useState("");
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);
  };

  const getCorrespondingLetter = () => {
    if (!inputText) {
      return "";
    }
    const normalizedInput = inputText
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[ー−\s　]/g, "-");

    if (normalizedInput.includes("-")) {
      return normalizedInput
        .split("-")
        .map((str) => getViewWordByStr(str))
        .join(" ");
    }
    return getViewWordByStr(inputText);
  };

  // inputTextを監視してselectedLettersを更新
  useEffect(() => {
    const value = inputText
      .replace(/[Ａ-Ｚａ-ｚ]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0)
      )
      .toUpperCase();
    setSelectedLetters(
      value.split("").filter((char) => alphabet.includes(char))
    );
  }, [inputText]);

  return (
    <main className="p-8">
      <TooltipProvider>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
            アルファベットシステム
          </h1>
          <Card className="bg-gray-800 border-gray-700 md:col-span-2 flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-purple-400">
                  アルファベット表
                </CardTitle>
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
                            setInputText((pre) =>
                              pre.replace(getRegexAlphabet(letter), "")
                            );
                          } else {
                            setInputText((pre) => pre + ` ${letter}`);
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

          <Card className="bg-gray-800 border-gray-700 mt-2">
            <CardContent className="relative">
              <Label
                htmlFor="numberInput"
                className="text-sm font-medium text-gray-300"
              >
                <span className="text-purple-400 text-lg">
                  <CaseUpper className="h-9 w-9 text-purple-400 inline" />
                  <ArrowLeftRight className="h-3 w-3 text-purple-400 inline" />
                  Number
                </span>
                <span className="ml-3 text-xs text-gray-400 mt-1">
                  ※スペース区切りで入力
                </span>
              </Label>
              <Input
                id="numberInput"
                type="text"
                value={inputText}
                onChange={handleNumberInputChange}
                className="-mt-2 bg-gray-700 border-gray-600 text-white text-base"
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
        </div>
      </TooltipProvider>
    </main>
  );
};
