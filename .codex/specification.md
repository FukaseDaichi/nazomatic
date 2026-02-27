# NAZOMATIC 要件定義書（2026-02-27）

本書は `/Users/fukasedaichi/git/nazomatic` の現行実装（Next.js App Router）を基準に更新した要件定義です。

---

## 1. サイト概要

- 目的: 謎解き・パズル支援ツールと、イベント周辺の補助ツールを1サイトに集約する。
- 主対象: 日本語話者の謎解き参加者 / 制作者、イベント情報を追うユーザー。
- UI方針: ダークテーマ（グレー系グラデーション）+ レスポンシブ。
- 実装方式: Next.js App Router（Route Group で領域分離）。

---

## 2. アーキテクチャ方針

### 2.1 Route Group 構成

- `src/app/(main)`: 公開メイン機能。
- `src/app/(blank25)`: BLANK25 専用領域（`robots.index=false`）。
- `src/app/(secret)`: 秘匿系機能（`robots.index=false`）。
- `src/app/api/*`: 公開 / 内部 API。

### 2.2 単一ソース運用（features.json）

`src/lib/json/features.json` を以下の単一ソースとして扱う。

- トップページの機能カード一覧
- ヘッダーアイコンナビ
- `sitemap.ts` のURL列挙
- `json-ld-component.tsx` の `Article index` 参照元

注意:

- `Article` は `features.features[index]` を直接参照するため、配列順は仕様。
- `features.json` に含まれないページ（`/blank25`, `/shift-search/reports` など）は sitemap / ヘッダー導線対象外。

### 2.3 SEO / クロール制御

- `robots.ts` で `/api/` と `/secret/` をクロール禁止。
- `(secret)` と `(blank25)` の layout で `robots.index=false` を設定。
- `sitemap.ts` は `/` + `features.json` のパスのみ出力。

### 2.4 演出ポリシー（紙吹雪）

`canvas-confetti` を使用し、以下を必須とする。

- `prefers-reduced-motion: reduce` の場合は無効化。
- 固定配置 `<canvas>` を作成し `confetti.create(canvas, { resize: true, useWorker: true })` を利用。
- cleanup（`reset()`、タイマー解除、canvas remove）を実装。

---

## 3. 技術スタック

- Next.js 14 / React 18 / TypeScript
- Tailwind CSS + shadcn/ui（Radix UI）
- framer-motion / lucide-react
- 3D: `react-three/fiber` + `@react-three/drei` + `three`
  - 3D描画は必要に応じて `next/dynamic` + `ssr:false`（例: `/dice`）
- JSON-LD: `schema-dts`
- Firebase Admin SDK（Firestore）
- 日時推定: `chrono-node`
- 広告: Google AdSense（localhost / standalone PWA では非表示）

---

## 4. 環境変数

### 4.1 共通

- `NEXT_PUBLIC_BASE_URL`
  - 用途: metadata / sitemap / JSON-LD で利用。
  - 未設定時既定値: `https://nazomatic.vercel.app`

### 4.2 Firestore（サーバー側）

`src/server/firebase/admin.ts` は以下いずれかで初期化。

- 方式A: `FIREBASE_SERVICE_ACCOUNT`（service account JSON文字列）
- 方式B: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_PRIVATE_KEY` の `\\n` は実改行に復元して使用

### 4.3 内部 API 認可（必須）

- `REALTIME_INTERNAL_API_TOKEN`
  - 対象: `/api/internal/realtime/register`, `/api/internal/realtime/prune`, `/api/internal/x/repost/events`
  - 形式: `Authorization: Bearer <token>`

### 4.4 X 再投稿機能（利用時のみ必須）

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_USER_ID`

---

## 5. 画面要件（公開）

### 5.1 メイン領域（`(main)`）

| パス | 機能 | 備考 |
| --- | --- | --- |
| `/` | トップページ | `features.json` からカード生成 |
| `/shiritori` | しりとり最長連鎖探索 | 入力語を再帰探索 |
| `/dice` | サイコロ展開図 + 3D | 3D側は dynamic import |
| `/alphabet` | アルファベット⇔数字変換 | 双方向変換UI |
| `/prefectures` | 都道府県検索 | ひらがな検索 |
| `/graphpaper` | 方眼紙エディタ | マス編集UI |
| `/anagram` | 辞書検索 | アナグラム / クロスワード / 正規表現 |
| `/calendar` | 謎チケカレンダー | Firestoreイベント表示 |
| `/constellation` | 星座検索 | タブ + 文字列検索 |
| `/shift-search` | シフト検索 | 文字シフト + 任意でアナグラム |
| `/shift-search/reports` | 全探索レポート一覧 | 事前生成メタ表示 |
| `/shift-search/reports/[lang]/[length]` | レポート詳細 | 大規模データは外部リンク誘導 |

### 5.2 BLANK25 領域（`(blank25)`）

| パス | 機能 | 備考 |
| --- | --- | --- |
| `/blank25` | 問題一覧 | カテゴリ表示、保存データ全リセット |
| `/blank25/[problemId]` | 問題プレイ | 5x5パネル開封 + 回答判定 |

---

## 6. 画面要件（シークレット）

| パス | 機能 | 備考 |
| --- | --- | --- |
| `/secret/christmas` | Google風UI + 音声入力 | 特定ワードで遷移 |
| `/secret/christmas/congratulations` | 演出ページ | 雪演出 + モーション |
| `/secret/ponpoppo/[productId]` | クイズ表示 | `quiz-data.json` を参照 |

---

## 7. 主要機能要件

### 7.1 しりとり

- 改行区切り単語を読み込み、最長連鎖を探索。
- 未使用単語も併記。
- ひらがな / カタカナは正規化して先頭末尾比較。

### 7.2 辞書検索（Anagram）

- 辞書切替: `buta.dic` / `CEFR-J.dic`。
- 検索モード:
  - アナグラム検索
  - クロスワード検索（`?`・数字・濁点半濁点ルール）
  - 正規表現検索
- 表示上限: `ANAGRAM_RESULT_MAXCOUNT = 200`

### 7.3 シフト検索

- 入力を正規化後、全シフトパターンを探索。
  - 英語: 25シフト
  - 日本語: 45シフト
- `includeAnagram=true` でシフト後アナグラム検索も実施。
- 結果上限:
  - exact: 1000
  - anagram: 3000
  - total: 5000

### 7.4 シフト検索レポート閲覧

- データソース: `src/generated/shift-search/view-manifest.json`。
- `deliveryType`:
  - `internal`: `src/generated/shift-search/internal/*.json` を表示
  - `external`: ダウンロードリンク（GitHub raw）へ誘導
- 静的パラメータで `[lang]/[length]` を生成。

### 7.5 謎チケカレンダー

- 月表示 42セル、日別イベント件数・詳細表示。
- クエリ切替: `#謎チケ売ります` / `#謎解き同行者募集` / `#謎チケ譲ります`
- クライアント側 `useCalendarData` で 1分TTL キャッシュ。
- テキストフィルタ（`rawPostText`）対応。

### 7.6 BLANK25

- 問題定義: `public/data/blank25/problems.json`
- プレイ仕様:
  - 5x5パネル（25枚）を開封
  - 回答正規化（かな→ひらがな + 空白除去）で `answers[]` 判定
  - スコア: `25 - 開封数`
- 進行保存:
  - `localStorage` キー: `blank25:v1:<manifestVersion>:<problemId>`
- クリア演出:
  - ダイアログ表示時に紙吹雪
  - reduced-motion 時は演出なし

---

## 8. API 要件

### 8.1 公開 API

- `GET /api/realtime`
  - Yahooリアルタイム検索ページから `__NEXT_DATA__` を抽出して正規化
  - パラメータ: `query`, `page`, `limit`
  - キャッシュ: `s-maxage=60`

- `GET /api/calendar`
  - Firestore `realtimeEvents` を `eventTime` 範囲で取得
  - パラメータ: `query`, `from`, `to`, `rangeDays`
  - デフォルト: `query=#謎チケ売ります`, `rangeDays=28`
  - 上限: `rangeDays<=60`, `MAX_RESULTS=500`

### 8.2 内部 API（Bearer 必須）

- `POST /api/internal/realtime/register`
  - Yahoo取得データを `normalizePost` でイベント化し Firestore 保存
  - `eventTime` 未取得 / 過去時刻 / 重複はスキップ
  - docId: `<postId>:<RULESET_VERSION>`
  - body: `query`, `limit`, `sinceId?`, `dryRun?`

- `POST /api/internal/realtime/prune`
  - `eventTime < cutoff` の古いドキュメントを削除
  - body: `cutoffDays?`, `dryRun?`

- `POST /api/internal/x/repost/events`
  - 条件一致候補（未レビュー）を抽出し X API へ repost
  - body: `hashtag`, `dryRun?`
  - 204: 候補なし

---

## 9. Firestore データ要件（`realtimeEvents`）

主フィールド:

- 投稿情報: `postId`, `postURL`, `hashtags`, `rawPostText`
- 投稿者: `authorId`, `authorName`, `authorImageUrl`
- イベント情報: `eventTime`, `eventDateResolution`, `ticketTitle`, `category`, `price`, `quantity`, `deliveryMethod`, `location`
- 収集情報: `sourceQuery`, `capturedAt`, `createdAt`
- 正規化情報: `normalizationEngine`, `confidence`, `notes`, `needsReview`, `reviewStatus`, `lastReviewedAt`

---

## 10. バッチ運用（GitHub Actions）

| Workflow | スケジュール(UTC) | 内容 |
| --- | --- | --- |
| `realtime-register.yml` | 毎時 `0 * * * *` | `#謎チケ売ります` を register |
| `realtime-register-transfer.yml` | 毎時 `15 * * * *` | `#謎チケ譲ります` を register |
| `realtime-register-accompany.yml` | 毎時 `30 * * * *` | `#謎解き同行者募集` を register |
| `realtime-prune.yml` | 毎日 `15 0 * * *` | 古いイベントを prune |
| `x-repost-events.yml` | 1日16回 | 候補イベントを repost |

利用Secrets:

- `REALTIME_API_BASE_URL`
- `REALTIME_API_TOKEN`（`REALTIME_INTERNAL_API_TOKEN` と同値）

---

## 11. データ / 生成物

- `src/lib/json/features.json`: ナビ / トップ / sitemap / Article index の基準
- `public/dic/*.dic`: 辞書データ
- `public/data/blank25/problems.json`: BLANK25 問題定義
- `public/data/quiz-data.json`: ponpoppo クイズ定義
- `src/generated/shift-search/view-manifest.json`: レポート表示用マニフェスト
- `src/generated/shift-search/internal/*.json`: 内部表示用レポート

生成コマンド:

- `npm run shift:report:meta`
- `npm run shift:report:view-assets`

---

## 12. 開発ルール / 変更チェックリスト

1. 新規公開ページをナビに出す場合は `features.json` を更新する。
2. `features.json` の順序変更時は `Article index` 参照ページを必ず見直す。
3. 外部取得は `/api/*` 側に集約し、クライアントから直接外部サイトを叩かない。
4. 内部 API は Bearer 認可を必須にする。
5. 演出追加時は reduced-motion と cleanup を実装する。
6. Shift Search レポート更新時は生成スクリプトを実行し、`src/generated/shift-search/*` を同期する。
7. BLANK25 マニフェスト更新時は `id` 重複がないことを確認する。

---

## 13. 現行実装メモ（2026-02-27時点）

- `/prefectures` と `/graphpaper` の `Article index` が `features.json` の並びと入れ替わっているため、JSON-LDタイトル/説明が相互にずれる状態。
