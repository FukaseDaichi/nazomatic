# Shift Search 設計書

## 位置づけ

この文書は、シフト検索、辞書検索連携、全探索レポート、表示用生成 assets をまとめた設計書です。実装の正本は `src/lib/shift-search.ts`、`src/components/shift-search`、`src/app/(main)/shift-search`、`scripts/build-shift-search-*.mjs` です。

## 概要

Shift Search は、入力語を文字シフトして辞書に存在する語を探す機能です。必要に応じて、シフト後の語に対するアナグラム検索も行います。通常の対話 UI と、事前生成済みの全探索レポート表示 UI を持ちます。

## ルート

| ルート | 実装 | 役割 |
|---|---|---|
| `/shift-search` | `src/app/(main)/shift-search/page.tsx` | 対話式のシフト検索 |
| `/shift-search/reports` | `src/app/(main)/shift-search/reports/page.tsx` | レポート一覧 |
| `/shift-search/reports/[lang]/[length]` | `src/app/(main)/shift-search/reports/[lang]/[length]/page.tsx` | レポート詳細 / 外部リンク案内 |

## 辞書

辞書定義は `src/class/SearchManager.ts` の `DICTIONARIES` です。

| key | 種別 | 内容 |
|---|---|---|
| `buta` | `jp` | `public/dic/buta.dic` |
| `cefr` | `en` | `public/dic/CEFR-J.dic` |

辞書はクライアント側で fetch し、`SearchManager` が cache します。

## シフト仕様

| 種別 | 対象文字 | シフト数 | 備考 |
|---|---|---:|---|
| 英語 | `a-z` | 25 | `NFKC` 正規化と小文字化を行う |
| 日本語 | ひらがな 46 字から「ゐ」「ゑ」を除いた 45 字 | 45 | カタカナをひらがな化し、小書き文字を通常文字に寄せる |

日本語は濁点・半濁点を base kana と mark に分け、シフト後の base kana に可能な範囲で mark を戻します。

## 検索仕様

`runShiftSearch` は以下を返します。

```ts
type ShiftSearchOutcome = {
  normalizedInput: string;
  results: ShiftSearchResult[];
  limitReached: boolean;
};
```

制限値:

| 定数 | 値 | 用途 |
|---|---:|---|
| `SHIFT_EXACT_RESULT_MAXCOUNT` | 1000 | 完全一致結果の上限 |
| `SHIFT_ANAGRAM_RESULT_MAXCOUNT` | 3000 | アナグラム結果の上限 |
| `SHIFT_TOTAL_RESULT_MAXCOUNT` | 5000 | 合計結果の上限 |

結果は shift 昇順、完全一致優先、語句昇順で重複排除して返します。

## レポート成果物

全探索レポートは、アプリの通常 UI とは別に `artifacts/shift-search/reports` で管理します。

| ファイル | 役割 |
|---|---|
| `artifacts/shift-search/reports/{jp|en}/shift-search-*-len-*.md` | 長さ別 Markdown レポート |
| `artifacts/shift-search/reports/shift-search-report-index.md` | レポート索引 |
| `artifacts/shift-search/reports/shift-search-report-manifest.json` | レポート metadata |
| `artifacts/shift-search/reports/shift-search-external-links.json` | 外部配信する大型レポートの URL |

## 表示用生成 assets

Next.js の画面は `src/generated/shift-search` を import します。元成果物を直接読ませないことで、表示に必要な JSON だけをアプリへ持ち込みます。

| ファイル | 役割 |
|---|---|
| `src/generated/shift-search/view-manifest.json` | レポート一覧と表示方法 |
| `src/generated/shift-search/internal/{lang}-{length}.json` | アプリ内表示する小さめのレポート本文 |

`scripts/shift-search-threshold.mjs` の `EXTERNAL_THRESHOLD` 以上の行数を持つレポートは `external` 扱いです。外部 URL がない場合は unresolved external として manifest に残ります。

## 更新フロー

1. `artifacts/shift-search/reports/{jp|en}` に Markdown レポートを配置する。
2. 大きなレポートを外部配信する場合は `shift-search-external-links.json` を更新する。
3. `npm run shift:report:meta` を実行する。
4. `npm run shift:report:view-assets` を実行する。
5. `artifacts/shift-search/reports/*` と `src/generated/shift-search/*` の差分を確認する。

## 実装境界

| 領域 | 実装 |
|---|---|
| 対話 UI | `src/components/shift-search/shift-search.tsx` |
| シフトロジック | `src/lib/shift-search.ts` |
| 辞書検索 | `src/class/SearchManager.ts` |
| レポート一覧 | `src/components/shift-search/shift-search-report-list.tsx` |
| レポート詳細 | `src/components/shift-search/shift-search-report-detail.tsx` |
| レポート読み込み | `src/lib/shift-search-report-view.ts` |
| manifest / index 生成 | `scripts/build-shift-search-report-meta.mjs` |
| 表示用 assets 生成 | `scripts/build-shift-search-view-assets.mjs` |

## 制約

- 辞書はクライアント側 fetch なので、初回読み込みに時間がかかる。
- 日本語シフトはひらがなベースで、漢字や記号は対象外。
- 大型レポートはアプリ内に全件持たず、外部リンク案内に切り替える。
