"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShiritoriManager } from "@/class/ShiritoriManager";

interface ShiritoriResultProps {
  inputText: string;
}

export function ShiritoriResultComponent({
  inputText = "",
}: ShiritoriResultProps) {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [shiritoriWords, setShiritoriWords] = useState<string[]>([]);
  const [unusedWords, setUnusedWords] = useState<string[]>([]);

  useEffect(() => {
    setDisplayedWords([]);
    ShiritoriManager.setWordsByText(inputText);
    setShiritoriWords(ShiritoriManager.getLongestShiritoris());
    setUnusedWords(ShiritoriManager.getUnusedWords());
  }, [inputText]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (displayedWords.length < shiritoriWords.length) {
        setDisplayedWords((prev) => [...prev, shiritoriWords[prev.length]]);
      } else {
        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [shiritoriWords, displayedWords]);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-purple-800 dark:text-purple-200">
            しりとり結果
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {displayedWords.map((word, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Badge className="text-lg px-3 py-1 bg-purple-500 hover:bg-purple-600 transition-colors duration-200">
                  {word}
                </Badge>
                {index < displayedWords.length - 1 && (
                  <span className="mx-2 text-purple-600 dark:text-purple-300">
                    →
                  </span>
                )}
              </motion.div>
            ))}
          </div>
          <Separator className="my-4" />
          <h3 className="text-xl font-semibold mb-4 text-center text-pink-700 dark:text-pink-300">
            使用されなかった単語
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {unusedWords.map((word, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Badge
                  variant="outline"
                  className="text-sm px-2 py-1 border-pink-400 text-pink-600 dark:border-pink-500 dark:text-pink-300"
                >
                  {word}
                </Badge>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
