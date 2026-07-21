# 公開ツール

## 共通構造

公開ツールは `src/app/(main)` に page、`src/components` に UI、`src/lib` または `src/class` に再利用可能なロジックを置きます。メイン導線へ載せる機能は `src/lib/json/features.json` に登録します。

| 機能 | 主なロジック | データ |
|---|---|---|
| しりとり | `src/class/ShiritoriManager.ts` | ユーザー入力 |
| サイコロ | `src/components/diceComponent` | `dice-nets.tsx` の展開図定義 |
| アルファベット変換 | `alphabet-converter.tsx` | クライアント状態 |
| 都道府県検索 | `prefecture-search-table.tsx` | コンポーネント内定義 |
| 方眼紙 | `graph-paper-component.tsx` | クライアント状態 |
| 辞書検索 | `src/class/SearchManager.ts` | `public/dic/*.dic` |
| 星座検索 | `src/lib/constellation` | `constellations-data.json` |
| 文字拾い検索 | `src/lib/character-pick-search.ts` | `SearchManager` の辞書 |

## 辞書基盤

`SearchManager` の `DICTIONARIES` が辞書一覧の正本です。

| key | type | ファイル |
|---|---|---|
| `buta` | `jp` | `public/dic/buta.dic` |
| `cefr` | `en` | `public/dic/CEFR-J.dic` |

辞書はブラウザから同一 origin で取得し、`SearchManager` がプロセス内で cache します。辞書検索、Shift Search、文字拾い検索がこの基盤を共有します。通常のアナグラム結果上限は `ANAGRAM_RESULT_MAXCOUNT=200` です。

## しりとり

入力を行単位の単語へ分け、`ShiritoriManager` が最長連鎖と未使用語を求めます。manager は static state を持つため、入力を設定してから結果を取得します。

## サイコロ

`dice-nets.tsx` の展開図候補と、Three.js 系ライブラリによる 3D 表示を組み合わせます。各面の文字と回転は画面 state です。

## 星座検索

星座名、ラテン名・略称、季節・十二星座タブを横断します。かな正規化と検索判定は `src/lib/constellation/search.ts`、表示整形は `ConstellationSearchTable.tsx` が担当します。

## 文字拾い検索

最大 10 個の登録語から、各語ごとに指定した文字数範囲で文字を取り出し、構成可能な辞書語を返します。

- 既定は各登録語から 1 文字ずつ使う。
- 最小値 0 は、その登録語を使わない組み合わせを許す。
- 候補語の文字順は問わず、アナグラムを含む。
- 全組み合わせを生成せず、辞書語を走査して文字割り当て可能性を判定する。
- 結果上限は `CHARACTER_PICK_RESULT_MAXCOUNT=200`。
- 登録語の追加、削除、文字幅、辞書変更で結果を再計算する。

## 変更時の整合点

- 公開導線へ追加する page は `features.json`、JSON-LD index、sitemap への影響を同時に確認する。
- 辞書定義を変える場合は、辞書検索、Shift Search、文字拾い検索を確認する。
- text-like input はモバイル 16px 以上にする。
