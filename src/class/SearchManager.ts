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
  type: string;
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
    type: "jp",
  },
  {
    key: "cefr",
    name: "英単語(CEFR-J)",
    description: "基本英単語「CEFR-J Wordlist」です。",
    path: "/dic/CEFR-J.dic",
    placeholder: "例：hel?l",
    type: "en",
  },
  // 他の辞書を追加可能
];

export const KANA_MARKS: Record<string, string> = {
  DAKUTEN: "゛",
  HANDAKUTEN: "゜",
  DAKUTEN_REPLACE: "d",
  HANDAKUTEN_REPLACE: "p",
};

function replaceMarks(inputString: string): string {
  return inputString
    .split("")
    .map((char) => {
      if (char === KANA_MARKS.DAKUTEN) {
        return KANA_MARKS.DAKUTEN_REPLACE;
      } else if (char === KANA_MARKS.HANDAKUTEN) {
        return KANA_MARKS.HANDAKUTEN_REPLACE;
      }
      return char; // 置換対象でない場合そのまま返す
    })
    .join("");
}

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
function normalizeRegexPattern(pattern: string): string {
  if (!pattern) {
    return "";
  }

  const normalized = fullWidthToHalfWidth(pattern);
  return normalizeWord(normalized);
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

// 濁点半濁点の入力を一時変更文字列に変更する関数
function normalizeInputMark(input: string): string {
  if (!input) {
    return "";
  }

  const numMarkRegex = new RegExp(
    `([0-9])[${KANA_MARKS.DAKUTEN_REPLACE}${KANA_MARKS.HANDAKUTEN_REPLACE}]`,
    "g"
  );

  const markRegex = new RegExp(
    `[${KANA_MARKS.DAKUTEN_REPLACE}${KANA_MARKS.HANDAKUTEN_REPLACE}]`,
    "g"
  );

  // 濁点や半濁点が数字に続く場合は削除
  const replacedInput = input
    .replace(numMarkRegex, (_, digit) => {
      return "?"; // 数字と濁点の組み合わせを "?" に置換
    })
    .replace(markRegex, ""); // 残った濁点・半濁点を削除

  return replacedInput;
}

// 濁点半濁点の部分チェック
function isMatchMarkPoint(word: string, rawInput: string): boolean {
  // 濁点・半濁点を取り除く関数
  const removeDiacritics = (input: string): string => {
    return input.replace(
      new RegExp(
        `[${KANA_MARKS.DAKUTEN_REPLACE}${KANA_MARKS.HANDAKUTEN_REPLACE}]`,
        "g"
      ),
      ""
    );
  };

  let wordIndex = 0;
  // 濁点・半濁点付き文字の確認
  for (let i = 0; i < rawInput.length; i++) {
    const inputChar = rawInput[i];
    if (
      inputChar === KANA_MARKS.DAKUTEN_REPLACE ||
      inputChar === KANA_MARKS.HANDAKUTEN_REPLACE
    ) {
      // 濁点・半濁点がある場合、直前の文字とwordの対応を確認
      const preRawChar = rawInput[i - 1];
      const targetWordChar = word[wordIndex - 1];

      //濁点文字ではなかった場合false
      if (
        inputChar === KANA_MARKS.DAKUTEN_REPLACE &&
        !isDakutenChar(targetWordChar)
      ) {
        return false;
      }

      //半濁点文字ではなかった場合false
      if (
        inputChar === KANA_MARKS.HANDAKUTEN_REPLACE &&
        !isHandakutenChar(targetWordChar)
      ) {
        return false;
      }

      //任意の濁点であるためそのまま次へ
      if (preRawChar === "?") {
        continue;
      }

      if (/[0-9]/.test(preRawChar)) {
        //数字に濁点半濁点がついている場合

        //一度自分の濁点半濁点ついている場所を!へ変更する
        const removeDiacriticsInput = removeDiacritics(
          rawInput.replace(
            new RegExp(
              `${preRawChar}[${KANA_MARKS.DAKUTEN_REPLACE}${KANA_MARKS.HANDAKUTEN_REPLACE}]`,
              "g"
            ),
            "!"
          )
        );
        const removeDakutenChar = removeDakuten(targetWordChar);

        let point = null;
        // 一文字ずつ確認
        for (let j = 0; j < removeDiacriticsInput.length; j++) {
          //同じ数字のものがあった場合
          if (
            removeDiacriticsInput[j] === preRawChar &&
            word[j] !== removeDakutenChar
          ) {
            return false;
          }

          //全ての濁点箇所が一致している必要がある
          if ("!" === removeDiacriticsInput[j]) {
            if (!point) {
              //初めての時は濁点が付いていない文字を記憶
              point = removeDakuten(word[j]);
            } else if (point !== removeDakuten(word[j])) {
              return false;
            }
          }
        }
      }
      //濁点がある場合はwordIndexをインクメントしない
      continue;
    }
    wordIndex++;
  }

  return true;
}
function isDakutenChar(char: string): boolean {
  const dakutenChars = "がぎぐげござじずぜぞだぢづでどばびぶべぼ";
  return dakutenChars.includes(char);
}

function isHandakutenChar(char: string): boolean {
  const handakutenChars = "ぱぴぷぺぽ";
  return handakutenChars.includes(char);
}

function removeDakuten(char: string): string {
  const kanaMap: Record<string, string> = {
    が: "か",
    ぎ: "き",
    ぐ: "く",
    げ: "け",
    ご: "こ",
    ざ: "さ",
    じ: "し",
    ず: "す",
    ぜ: "せ",
    ぞ: "そ",
    だ: "た",
    ぢ: "ち",
    づ: "つ",
    で: "て",
    ど: "と",
    ば: "は",
    び: "ひ",
    ぶ: "ふ",
    べ: "へ",
    ぼ: "ほ",
    ぱ: "は",
    ぴ: "ひ",
    ぷ: "ふ",
    ぺ: "へ",
    ぽ: "ほ",
  };
  return kanaMap[char] || char;
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
        type: dictionaryData.type,
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
   * パターン検索する（非同期版）
   * @param input 入力文字列
   * @returns
   */
  public findPatternwordAsync(input: string): Promise<string[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const markRegex = new RegExp(
          `[${KANA_MARKS.DAKUTEN}${KANA_MARKS.HANDAKUTEN}]`,
          "g"
        );
        const markReplaceRegex = new RegExp(
          `[${KANA_MARKS.DAKUTEN_REPLACE}${KANA_MARKS.HANDAKUTEN_REPLACE}]`,
          "g"
        );

        //濁点半濁点の判定
        const isContainMark =
          markRegex.test(input) ||
          (this.dictionary.type === "jp" && markReplaceRegex.test(input));

        const normalizedInput = isContainMark
          ? fullWidthToHalfWidth(normalizeWord(replaceMarks(input)))
          : fullWidthToHalfWidth(normalizeWord(input));

        // console.log("normalizedInput:" + normalizedInput);

        const normalizedMarkInput = isContainMark
          ? normalizeInputMark(normalizedInput)
          : normalizedInput;

        // console.log("normalizedMarkInput: " + normalizedMarkInput);
        const regex = generateRegex(normalizedMarkInput);
        console.log("regex = " + regex);
        const inputLength = normalizedMarkInput.length;

        // 入力文字列と同じ長さの単語群を取得
        const candidateWords = this.wordsByLength.get(inputLength) || [];

        const results: string[] = [];

        // 候補となる単語を一つずつ確認
        for (const candidate of candidateWords) {
          let matches = true;
          matches = regex.test(candidate);

          // すべての文字がマッチした場合
          if (matches && !isContainMark) {
            results.push(candidate);
          }

          //濁点がある場合でマッチしている場合
          if (matches && isContainMark) {
            if (isMatchMarkPoint(candidate, normalizedInput)) {
              results.push(candidate);
            }
          }
          // 結果上限チェック
          if (results.length >= ANAGRAM_RESULT_MAXCOUNT) {
            break;
          }
        }

        resolve(results);
      }, 0);
    });
  }

  public findRegexAsync(pattern: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const normalizedPattern = normalizeRegexPattern(pattern);
          const regex = new RegExp(normalizedPattern);
          const results: string[] = [];

          for (const word of this.dictionary.words) {
            regex.lastIndex = 0;
            if (regex.test(word)) {
              results.push(word);
              if (results.length >= ANAGRAM_RESULT_MAXCOUNT) {
                break;
              }
            }
          }

          resolve(results);
        } catch (error: any) {
          const message =
            error instanceof Error && error.message
              ? `正規表現が無効です: ${error.message}`
              : "正規表現が無効です。";
          reject(new Error(message));
        }
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

  static getType(key: string): string {
    return (
      DICTIONARIES.find((dictionary) => dictionary.key === key)?.type || ""
    );
  }
}

