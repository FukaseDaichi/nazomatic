# 公開メインツール設計書

## 位置づけ

この文書は、`src/app/(main)` にある小型の公開ツール群をまとめた設計書です。BLANK25、謎チケカレンダー、Shift Search は別設計書に分けます。

## 共通方針

- 画面は `src/app/(main)` 配下に置く。
- 共通ヘッダーは `ArticleHeaderComponent` / `HeaderComponent` を使う。
- メイン導線に出す機能は `src/lib/json/features.json` に登録する。
- 公開ページは `(main)` layout の metadata と `sitemap.ts` の対象になる。
- UI は `docs/ai-coding-rules.md` のダークグラデーション + `purple-400` を維持する。

## 機能一覧

| ルート | 主な実装 | データ / ロジック |
|---|---|---|
| `/shiritori` | `src/app/(main)/shiritori/page.tsx`、`src/components/shiritoriResult/shiritori-result.tsx` | `src/class/ShiritoriManager.ts` |
| `/dice` | `src/app/(main)/dice/page.tsx`、`src/components/diceComponent/*` | `dice-nets.tsx` の展開図定義 |
| `/alphabet` | `src/app/(main)/alphabet/page.tsx`、`src/components/alphabet/alphabet-converter.tsx` | クライアント内変換 |
| `/prefectures` | `src/app/(main)/prefectures/page.tsx`、`src/components/prefecture/prefecture-search-table.tsx` | コンポーネント内の検索データ |
| `/graphpaper` | `src/app/(main)/graphpaper/page.tsx`、`src/components/graphpaper/graph-paper-component.tsx` | クライアント状態 |
| `/anagram` | `src/app/(main)/anagram/page.tsx`、`src/components/anagram/anagram-search.tsx` | `SearchManager` と `public/dic/*.dic` |
| `/constellation` | `src/app/(main)/constellation/page.tsx`、`src/components/constellation/ConstellationSearchTable.tsx` | `src/lib/constellation/*`、`src/lib/json/constellations-data.json` |
| `/character-pick-search` | `src/app/(main)/character-pick-search/page.tsx`、`src/components/character-pick-search/character-pick-search.tsx` | `src/lib/character-pick-search.ts` と `SearchManager` |

## 辞書検索

辞書検索は `SearchManager` を中心に実装します。辞書定義は `DICTIONARIES` です。

| key | ファイル | 用途 |
|---|---|---|
| `buta` | `public/dic/buta.dic` | 日本語ひらがな辞書 |
| `cefr` | `public/dic/CEFR-J.dic` | 英単語辞書 |

主な検索:

- 完全一致
- アナグラム
- クロスワード用パターン
- 正規表現的な繰り返し指定

Shift Search も同じ `SearchManager` を使います。Shift Search 固有の仕様は `docs/shift-search/design.md` を参照します。

文字拾い検索も同じ辞書を使います。登録語から指定文字数ずつ拾って作れる辞書語を判定し、候補語の文字順は問わないためアナグラムも結果に含みます。詳細は `docs/character-pick-search/design.md` を参照します。

## しりとり

`ShiritoriManager` は入力テキストを行単位の単語に分解し、最長のしりとり連鎖と未使用語を求めます。状態は static field に持つため、呼び出し前に入力をセットしてから結果を取得します。

## サイコロ

サイコロ機能は展開図と 3D 表示を組み合わせます。

- 展開図候補は `src/components/diceComponent/dice-nets.tsx`。
- 表示部品は `dice-components.tsx` と `dice-net-icon.tsx`。
- 3D 表示は Three.js 系ライブラリを利用する。

## 星座検索

星座検索は `src/lib/json/constellations-data.json` をデータ源とし、`src/lib/constellation/search.ts` で検索します。

主な観点:

- 十二星座、季節の星座などを横断して扱う。
- ひらがな検索を中心にする。
- 表示用の整形は `ConstellationSearchTable` 側で行う。

## 追加時チェック

- メイン導線に出す場合は `features.json` に登録したか。
- `features.json` の順序変更が JSON-LD の `Article` index に影響しないか。
- クライアントから外部サイトへ直接 fetch していないか。
- 入力系 UI はモバイル 16px 以上になっているか。
- 既存の小型ツールで足りる抽象を重複実装していないか。
