import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ひらがな・カタカナを統一するヘルパーメソッド
export function normalizeKana(char: string): string {
  return char.replace(/[\u30a1-\u30f6]/g, function (match) {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}
