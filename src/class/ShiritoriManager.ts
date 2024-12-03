import { normalizeKana } from "@/lib/utils";

export class ShiritoriManager {
  private static longestShiritoris: string[] = []; // 最長のしりとりを保持する配列
  private static unusedWords: string[] = []; // 使用されなかった単語リスト
  public static words: string[] = [];
  constructor() {}

  public static setWordsByText(inputText: string) {
    if (inputText && inputText.trim()) {
      ShiritoriManager.words = inputText
        .trim()
        .split(/\r\n|\r|\n/)
        .filter(Boolean);
    } else {
      ShiritoriManager.words = [];
    }
  }

  // 最長しりとりを取得するメソッド
  public static getLongestShiritoris(): string[] {
    this.longestShiritoris = [];
    this.unusedWords = [...this.words]; // 初期化：全単語を未使用リストに追加

    // 各単語からしりとりを開始
    for (let i = 0; i < ShiritoriManager.words.length; i++) {
      const word = this.words[i];
      const remainingWords = this.words.filter((_, index) => index !== i);
      this.findLongest([word], remainingWords);
    }

    // 使用された単語を未使用リストから削除
    this.unusedWords = this.unusedWords.filter(
      (word) => !this.longestShiritoris.includes(word)
    );

    // 最長のしりとり連鎖をスペースで区切って返す
    return this.longestShiritoris;
  }

  // しりとりの連鎖を再帰的に探索するメソッド
  private static findLongest(
    currentChain: string[],
    remainingWords: string[]
  ): void {
    // 現在の連鎖が最長の連鎖より長ければ更新
    if (currentChain.length > this.longestShiritoris.length) {
      this.longestShiritoris = [...currentChain];
    }

    // 最後の単語を取得
    const lastWord = currentChain[currentChain.length - 1];
    const lastChar = lastWord[lastWord.length - 1];

    // 残りの単語でしりとりに続く単語を探索
    for (let i = 0; i < remainingWords.length; i++) {
      const word = remainingWords[i];

      // ひらがな・カタカナを統一して比較
      const normalizedLastChar = normalizeKana(lastChar);
      const normalizedFirstChar = normalizeKana(word[0]);

      if (normalizedFirstChar === normalizedLastChar) {
        // しりとりの条件
        const newChain = [...currentChain, word];
        const newRemainingWords = remainingWords.filter(
          (_, index) => index !== i
        );
        this.findLongest(newChain, newRemainingWords); // 再帰で探索
      }
    }
  }
  // 未使用の単語リストを取得するメソッド
  public static getUnusedWords(): string[] {
    return this.unusedWords;
  }
}
