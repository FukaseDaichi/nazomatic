import { normalizeKana } from "@/lib/utils";

export const ANAGRAM_RESULT_MAXCOUNT = 200; // MAXCOUNTを定義

/**
 * 辞書の型定義
 */
export type Dictionary = {
  key: string;
  name: string;
  description: string;
  words: string[];
};

/**
 * 利用可能な辞書の一覧
 */
export const DICTIONARIES = [
  {
    key: "buta",
    name: "日本語（豚辞書）",
    description:
      "20万語の日本語ひらがな辞書です。大文字と小文字を区別しません。",
    path: "/dic/buta.dic",
    placeholder: "例：あい？つ",
  },
  {
    key: "cefr",
    name: "英単語(CEFR-J)",
    description: "基本英単語「CEFR-J Wordlist」です。大文字のみ検索可能です。",
    path: "/dic/CEFR-J.dic",
    placeholder: "例：hel?l",
  },
  // 他の辞書を追加可能
];

/**
 * 単語を正規化する関数
 * - 小文字化とUnicode正規化を行う
 * - カタカナをひらがなに
 * @param word 単語
 * @returns 正規化された単語
 */
function normalizeWord(word: string): string {
  // 小さい文字を大きいひらがなに変換
  const convertedWord = word
    .replace(/ゃ/g, "や")
    .replace(/ゅ/g, "ゆ")
    .replace(/ょ/g, "よ")
    .replace(/っ/g, "つ")
    .replace(/ぁ/g, "あ")
    .replace(/ぃ/g, "い")
    .replace(/ぅ/g, "う")
    .replace(/ぇ/g, "え")
    .replace(/ぉ/g, "お");

  return normalizeKana(convertedWord.toLowerCase().normalize("NFKC"));
}

/**
 * 全角数字を半角数字に変更する関数
 * -
 * @param str 単語
 * @returns 半角数字の値
 */
function fullWidthToHalfWidth(str: string): string {
  return str.replace(/[\uFF10-\uFF19]/g, function (match) {
    switch (match) {
      case "\uff10":
        return "0";
      case "\uff11":
        return "1";
      case "\uff12":
        return "2";
      case "\uff13":
        return "3";
      case "\uff14":
        return "4";
      case "\uff15":
        return "5";
      case "\uff16":
        return "6";
      case "\uff17":
        return "7";
      case "\uff18":
        return "8";
      case "\uff19":
        return "9";
      default:
        return match;
    }
  });
}

function generateRegex(pattern: string): RegExp {
  let regex = "";
  const captures: any = {};
  let captureIndex = 1;

  for (const char of pattern) {
    if (/[0-9]/.test(char)) {
      // 数字のの場合（例: 0, 2）
      if (!captures[char]) {
        // 新しいキャプチャグループを作成
        captures[char] = `\\${captureIndex}`;
        regex += "(.)"; // 任意の1文字をキャプチャ
        captureIndex++;
      } else {
        // 既存のキャプチャグループを参照
        regex += captures[char];
      }
    } else if (char === "?" || char === "？") {
      // 任意の1文字
      regex += ".";
    } else {
      // 特殊文字やその他をエスケープ
      regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }

  return new RegExp(`^${regex}$`);
}

/**
 * アナグラムマネージャークラス
 * - 辞書のロード、前処理、アナグラム検索を行う
 */
export class SearchManager {
  private dictionary: Dictionary; // ロードされた辞書
  private processed: Map<string, string[]>; // 前処理済みデータ
  private wordsByLength: Map<number, string[]> = new Map();
  /**
   * 辞書のキャッシュ（複数の辞書を管理）
   */
  private static dictionaryCache: Map<string, Dictionary> = new Map();

  /**
   * コンストラクタ（外部からの直接呼び出しを防ぐ）
   * @param dictionary 辞書データ
   */
  private constructor(dictionary: Dictionary) {
    this.dictionary = dictionary;
    this.processed = new Map();
    this.preprocessDictionary(); // 辞書を前処理
  }

  /**
   * ファクトリーメソッド：キーからAnagramManagerのインスタンスを生成する
   * @param key 辞書のキー
   * @returns AnagramManagerのインスタンス
   */
  static async create(key: string): Promise<SearchManager> {
    const dictionary = await SearchManager.loadDictionary(key);
    return new SearchManager(dictionary);
  }

  /**
   * 辞書をファイルからロードする（キャッシュを利用）
   * @param key 辞書のキー
   * @returns 辞書データ
   */
  public static async loadDictionary(key: string): Promise<Dictionary> {
    // キャッシュに存在する場合はそれを返す
    if (SearchManager.dictionaryCache.has(key)) {
      return SearchManager.dictionaryCache.get(key)!;
    }

    const dictionaryData = DICTIONARIES.find((d) => d.key === key);
    const filePath = dictionaryData?.path;

    if (!dictionaryData || !filePath) {
      throw new Error(`辞書ファイル '${key}' が見つかりません。`);
    }

    try {
      // Fetch APIを使用して辞書データを取得
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ステータスコード ${response.status}`);
      }
      const data = await response.text();

      // 単語を正規化して配列に格納
      const words = data
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean)
        .map(normalizeWord);

      const dictionary: Dictionary = {
        key: key,
        name: dictionaryData.name,
        description: `${dictionaryData.description}に関連する単語の辞書です。`,
        words,
      };

      // キャッシュに保存
      SearchManager.dictionaryCache.set(key, dictionary);

      return dictionary;
    } catch (error: any) {
      throw new Error(
        `辞書ファイルの読み込み中にエラーが発生しました: ${error.message}`
      );
    }
  }

  /**
   * 辞書を前処理して、長さごとの単語のマッピングを作成
   */
  private preprocessDictionary(): void {
    this.dictionary.words.forEach((word) => {
      // 通常のアナグラム検索用
      const key = word.split("").sort().join("");
      if (!this.processed.has(key)) {
        this.processed.set(key, []);
      }
      this.processed.get(key)!.push(word);

      // あいまい検索用（単語の長さによるマップ）
      const length = word.length;
      if (!this.wordsByLength.has(length)) {
        this.wordsByLength.set(length, []);
      }
      this.wordsByLength.get(length)!.push(word);
    });
  }

  /**
   * アナグラムを検索する（非同期版）
   * @param input 入力文字列
   * @returns アナグラムの配列をPromiseで返す
   */
  public findAnagramsAsync(input: string): Promise<string[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const normalizedInput = normalizeWord(input);
        const inputLength = normalizedInput.length;

        if (normalizedInput.includes("?")) {
          // あいまい検索を実行
          const results: string[] = [];

          // 入力文字のカウント（'?'を除く）
          const inputLetterCounts = new Map<string, number>();
          let wildcardCount = 0;
          for (const char of normalizedInput) {
            if (char !== "?") {
              inputLetterCounts.set(
                char,
                (inputLetterCounts.get(char) || 0) + 1
              );
            } else {
              wildcardCount++;
            }
          }

          // 同じ長さの単語を取得
          const candidateWords = this.wordsByLength.get(inputLength) || [];

          // 辞書内の単語を順にチェック
          for (const word of candidateWords) {
            // 単語の文字数をカウント
            const wordLetterCounts = new Map<string, number>();
            for (const char of word) {
              wordLetterCounts.set(char, (wordLetterCounts.get(char) || 0) + 1);
            }

            // 入力の文字とワイルドカードで単語が作れるかチェック
            let matches = true;
            let requiredWildcards = 0;

            const entries = Array.from(wordLetterCounts.entries());
            for (const [char, count] of entries) {
              const inputCount = inputLetterCounts.get(char) || 0;
              if (inputCount < count) {
                requiredWildcards += count - inputCount;
              }
              if (requiredWildcards > wildcardCount) {
                matches = false;
                break;
              }
            }

            if (matches) {
              results.push(word);
              if (results.length >= ANAGRAM_RESULT_MAXCOUNT) {
                break;
              }
            }
          }

          resolve(results);
        } else {
          // 通常のアナグラム検索
          const key = normalizedInput.split("").sort().join("");
          resolve(this.processed.get(key) || []);
        }
      }, 0);
    });
  }

  /**
   * クロスワード検索する（非同期版）
   * @param input 入力文字列
   * @returns
   */
  public findCrosswordAsync(input: string): Promise<string[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const normalizedInput = normalizeWord(input);
        const inputLength = normalizedInput.length;

        // 入力文字列と同じ長さの単語群を取得
        const candidateWords = this.wordsByLength.get(inputLength) || [];

        const results: string[] = [];

        // 候補となる単語を一つずつ確認
        for (const candidate of candidateWords) {
          let matches = true;

          for (let i = 0; i < inputLength; i++) {
            const inputChar = normalizedInput[i];
            const candidateChar = candidate[i];

            // 入力文字が'?'の場合は任意の文字OK、それ以外は文字一致を要求
            if (inputChar !== "?" && inputChar !== candidateChar) {
              matches = false;
              break;
            }
          }

          // すべての文字がマッチした場合
          if (matches) {
            results.push(candidate);

            // 結果上限チェック
            if (results.length >= ANAGRAM_RESULT_MAXCOUNT) {
              break;
            }
          }
        }

        resolve(results);
      }, 0);
    });
  }

  /**
   * パターン検索する（非同期版）
   * @param input 入力文字列
   * @returns
   */
  public findPatternwordAsync(input: string): Promise<string[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const normalizedInput = fullWidthToHalfWidth(normalizeWord(input));
        const regex = generateRegex(normalizedInput);
        console.log(regex);
        const inputLength = normalizedInput.length;

        // 入力文字列と同じ長さの単語群を取得
        const candidateWords = this.wordsByLength.get(inputLength) || [];

        const results: string[] = [];

        // 候補となる単語を一つずつ確認
        for (const candidate of candidateWords) {
          let matches = true;
          matches = regex.test(candidate);

          // すべての文字がマッチした場合
          if (matches) {
            results.push(candidate);

            // 結果上限チェック
            if (results.length >= ANAGRAM_RESULT_MAXCOUNT) {
              break;
            }
          }
        }

        resolve(results);
      }, 0);
    });
  }

  /**
   * 指定したキーの辞書をキャッシュから削除する
   * @param key 辞書のキー
   */
  static unloadDictionary(key: string): void {
    this.dictionaryCache.delete(key);
  }

  /**
   * すべての辞書をキャッシュから削除する
   */
  static unloadAllDictionaries(): void {
    this.dictionaryCache.clear();
  }

  static getDescription(key: string): string {
    return (
      DICTIONARIES.find((dictionary) => dictionary.key === key)?.description ||
      ""
    );
  }

  static getPlaceholder(key: string): string {
    return (
      DICTIONARIES.find((dictionary) => dictionary.key === key)?.placeholder ||
      ""
    );
  }

  static getName(key: string): string {
    return (
      DICTIONARIES.find((dictionary) => dictionary.key === key)?.name || ""
    );
  }
}
