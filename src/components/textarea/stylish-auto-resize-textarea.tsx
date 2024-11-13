"use client";

import React, { useState, ChangeEvent, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PenLine } from "lucide-react";

const MAX_LENGTH = 2000;

type StylishAutoResizeTextareaComponentProps = {
  value: string;
  setValue: (value: string) => void;
};

const adjustHeight = (element: HTMLTextAreaElement) => {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};

export function StylishAutoResizeTextareaComponent({
  value,
  setValue,
}: StylishAutoResizeTextareaComponentProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    adjustHeight(event.target);
  };

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight(textareaRef.current);
    }
  }, [value]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className={`relative rounded-lg transition-all duration-300 ease-in-out
        ${isFocused ? "shadow-lg" : "shadow-md"}
        ${
          isFocused
            ? "bg-gradient-to-r from-primary/20 to-secondary/20"
            : "bg-background"
        }
      `}
      >
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-secondary opacity-50 blur-sm"></div>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            maxLength={MAX_LENGTH}
            placeholder=""
            className="min-h-[100px] resize-none transition-all duration-300 ease-in-out bg-transparent
                        border-2 border-transparent focus:border-gray-900/50 rounded-lg p-4 text-foreground
                       placeholder-transparent focus:ring-0 focus:outline-none focus-visible:ring-0 dark:focus:border-gray-50/50"
          />
          <Label
            htmlFor="stylish-textarea"
            className={`absolute left-3 transition-all duration-300 ease-in-out pointer-events-none
              ${value || isFocused ? "-top-4 text-xs" : "top-2 text-base"}
              ${isFocused ? "text-primary/70" : "text-muted-foreground"}
              bg-background px-1 rounded
            `}
          >
            単語は改行して文字を入力してね
          </Label>
        </div>
      </div>
      <div className="mt-2 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center">
          <PenLine className="w-4 h-4 mr-1" />
          <span>{value.length} 文字</span>
        </div>
        <span>{MAX_LENGTH - value.length} 文字入力可能</span>
      </div>
    </div>
  );
}
