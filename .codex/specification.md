# NAZOMATIC 仕様書（2026-02-10）

本書は `c:\Users\119003\git\nazomatic` の現行コード（Next.js App Router）を前提に、実装と整合する形でまとめた仕様書です。

---

## 1. サイト概要

- 目的: 謎解き・パズル支援ツールと、イベント周辺の補助ツールを一箇所に集約する。
- 対象ユーザー: 日本語話者の謎解き参加者 / 制作者、イベント情報を追うユーザー。
- UI 方針: ダークテーマ（グレーのグラデーション背景）+ レスポンシブ。
- ナビゲーション方針: `src/lib/json/features.json` を単一ソースとして運用する（トップのカード一覧・ヘッダーアイコン・サイトマップ・JSON-LD Article がこれに依存）。

---

## 2. 設計方針（重要）

### 2.1 ルーティング / 情報設計

- 主要ツールは `src/app/(main)` 配下にページを追加する。
- シークレット領域は `src/app/(secret)` 配下に隔離し、基本的に検索エンジンに載せない（noindex + `robots.ts`）。
- `src/lib/json/features.json` は以下の単一ソース:
  - トップページのツール一覧カード
  - ヘッダーのアイコンナビ
  - `Article` JSON-LD（`src/components/common/json-ld-component.tsx`）
  - `sitemap.ts`
- 注意: `Article` は `features.features[index]` を参照するため **配列順が仕様**。並び替えや挿入は index 参照ページに影響する。

### 2.2 演出（紙吹雪）

- 紙吹雪は `canvas-confetti` を使用する（例: `src/components/blank25/confetti.ts`）。
- ポリシー:
  - `prefers-reduced-motion: reduce` の場合は演出を無効化する。
  - 固定配置の `<canvas>` を DOM に追加して z-index を制御し、`confetti.create(canvas, { resize: true, useWorker: true })` で発火する。
  - 呼び出し側は cleanup 関数を保持し、アンマウント時/再実行前に必ず掃除する（タイマー解除・`reset()`・canvas remove）。

### 2.3 外部データ取得 / セキュリティ境界

- 外部サイト取得（Yahoo リアルタイム検索など）は Route Handler（`src/app/api/*`）で行い、クライアントからは自 API を叩く。
- 書き込み系/定期実行系は内部 API（`/api/internal/*`）に集約し、`Authorization: Bearer ...` による認可を必須にする。

---

## 3. 技術スタック

- Next.js 14 / React 18 / TypeScript。
- Tailwind CSS + shadcn/ui（Radix UI）によるコンポーネント設計（`src/components/ui/*`）。
- framer-motion（アニメーション）、lucide-react（アイコン）。
- 3D 表現: `react-three/fiber` + `@react-three/drei` + `three`。
  - DOM/GL 依存の強い 3D は `next/dynamic` + `ssr:false` を使用（例: `/dice`）。
- JSON-LD: `schema-dts` + `generateJsonLdArticle`。
- 紙吹雪: `canvas-confetti`。
- 日付パース: `chrono-node`（リアルタイム投稿の日時推定）。
- サーバー DB: `firebase-admin`（Firestore）。
- 広告: Google AdSense（`localhost` または PWA standalone では非表示）。
- 画像キャプチャ（デモ用途）: `html2canvas`（現行では主要導線に必須ではない）。

---

## 4. 実行環境 / 環境変数

### 4.1 ベース URL

- `NEXT_PUBLIC_BASE_URL`: `src/app/config.ts` が参照し、metadata / sitemap / JSON-LD の URL 生成に使用。
  - 未設定時の既定値: `https://nazomatic.vercel.app`

### 4.2 Firestore（サーバー側）

`src/server/firebase/admin.ts` は以下のいずれかで初期化する。

- 方式A: `FIREBASE_SERVICE_ACCOUNT`（service account JSON を文字列で格納）
- 方式B: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_PRIVATE_KEY` は `\\n` を実改行に復元して使用する

### 4.3 内部 API トークン（必須）

- `REALTIME_INTERNAL_API_TOKEN`
  - 対象: `/api/internal/realtime/register`, `/api/internal/realtime/prune`, `/api/internal/x/repost/events`
  - 形式: `Authorization: Bearer <token>`

### 4.4 X（Twitter）再投稿（任意 / 有効化時のみ必須）

`/api/internal/x/repost/events` 実行に必要:

- `X_API_KEY`, `X_API_SECRET`
- `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`
- `X_USER_ID`

---

## 5. ルーティング（公開ページ）

`src/app/(main)` 配下（通常レイアウト）。

| パス | 概要 | 主な実装 |
| --- | --- | --- |
| `/` | トップ（ツール一覧カード） | `src/app/(main)/page.tsx`, `src/lib/json/features.json` |
| `/shiritori` | しりとり最長連鎖支援 | `ShiritoriResultComponent`, `hiragana.json` |
| `/dice` | サイコロ展開図 + 3D 表示 | `DiceNets`, `DiceComponent`（dynamic import） |
| `/alphabet` | アルファベット ⇔ 数字変換 | `AlphabetConverter` |
| `/prefectures` | 都道府県検索 | `PrefectureSearchTableComponent` |
| `/graphpaper` | 方眼紙エディタ | `GraphPaperComponent` |
| `/anagram` | アナグラム / クロスワード検索 | `AnagramSearch`, `public/dic/*.dic` |
| `/calendar` | イベントカレンダー | `CalendarPageClient`, `/api/calendar` |
| `/constellation` | 星座検索 | `ConstellationSearchTable` |
| `/blank25` | BLANK25（問題一覧） | `Blank25ProblemList`, `public/data/blank25/problems.json` |
| `/blank25/[problemId]` | BLANK25（問題プレイ） | `Blank25Game` |

補足:

- ナビゲーション/サイトマップ/JSON-LD Article は `features.json` に含まれるページのみが対象。
  - 現状 `features.json` には `/blank25` が入っていないため、ナビゲーション/サイトマップ/Article の対象外。

---

## 6. ルーティング（シークレット）

`src/app/(secret)` はレイアウトが別で、基本的に検索エンジン非公開。

| パス | 概要 | 主な実装 |
| --- | --- | --- |
| `/secret/christmas` | Google 風 UI（音声入力の仕掛け） | Web Speech API（`SpeechRecognition`） |
| `/secret/christmas/congratulations` | 演出ページ（雪・モーション） | framer-motion |
| `/secret/ponpoppo/[productId]` | クイズ（商品当て） | `public/data/quiz-data.json`, `QuizFloatingCard` |

- `robots.ts` は `/secret/` と `/api/` をクロール禁止にしている。
- `(secret)` 側の layout は `robots.index=false` を設定している。

---

## 7. 機能仕様（追加・更新分の要点）

### 7.1 イベントカレンダー（`/calendar`）

- UI（クライアント）:
  - 42セル（月表示）+ 投稿イベントのバッジ表示。
  - ハッシュタグ（クエリ）を選択できる。
  - `useCalendarData` が `/api/calendar` を取得し、1分TTLのメモリキャッシュを持つ（同一パラメータの多重取得を抑制）。
- API（サーバー）: `GET /api/calendar`
  - Firestore `realtimeEvents` を `eventTime` 範囲で検索し、`sourceQuery` で絞り込み可能。
  - レスポンスは `src/types/calendar.ts` の `CalendarApiResponse`。

### 7.2 星座検索（`/constellation`）

- タブ（黄道十二星座/季節/全件）で絞り込み。
- かな/英字（ラテン名・略号）で検索できるテーブル UI。
- データは `src/lib/constellation/*` を参照。

### 7.3 BLANK25（`/blank25`）

- データ:
  - 問題マニフェスト: `public/data/blank25/problems.json`（`version` + `problems[]`）
  - 画像: `public/img/blank25/*`
- プレイ:
  - 25枚のパネルを開いて手がかりを見るタイプの問題。
  - 判定入力は正規化（かな→ひらがな、空白除去）して `answers[]` と照合。
  - スコアは「残りパネル数（= 25 - 開いた枚数）」。
  - 進行状態は `localStorage` に保存（キー: `blank25:v1:<manifestVersion>:<problemId>`）。
- クリア演出:
  - クリアダイアログ表示中に `canvas-confetti` を発火（`fireBlank25Confetti`）。
  - `prefers-reduced-motion` の場合は演出しない。

---

## 8. API 仕様（リアルタイム系）

### 8.1 公開 API

- `GET /api/realtime`
  - Yahoo リアルタイム検索（HTML内 `__NEXT_DATA__`）を取得して JSON に正規化して返す。
  - パラメータ: `query`, `page`, `limit`

### 8.2 内部 API（要 Bearer トークン）

- `POST /api/internal/realtime/register`
  - Yahoo リアルタイム検索の投稿を取得し、ルールで `NormalizedRealtimeEvent` に正規化して Firestore `realtimeEvents` に保存する。
  - docId は `postId:rulesetVersion`（例: `ruleset-v2025-11`）で重複登録を回避する。
  - `dryRun: true` で保存せずにサマリーのみ返せる。
- `POST /api/internal/realtime/prune`
  - `eventTime` が cutoff より前のドキュメントをバッチ削除する（dry-run対応）。
- `POST /api/internal/x/repost/events`
  - `realtimeEvents` から候補（未レビュー等）を選び、X API で再投稿する（dry-run対応）。

---

## 9. 運用（GitHub Actions）

`.github/workflows/*` で内部 API を定期実行する。

- `realtime-register.yml`（毎時）: register（クエリ指定）
- `realtime-register-transfer.yml`（毎時）: transfer 系クエリで register
- `realtime-register-accompany.yml`（毎時）: accompany 系クエリで register
- `realtime-prune.yml`（毎日）: prune
- `x-repost-events.yml`（複数回/日）: repost

GitHub Secrets（リポジトリ側）:

- `REALTIME_API_BASE_URL`: デプロイ済みアプリのベース URL
- `REALTIME_API_TOKEN`: `REALTIME_INTERNAL_API_TOKEN` と同値

---

## 10. データ / アセット一覧

- `src/lib/json/features.json`: ナビゲーション/トップカード/JSON-LD/サイトマップの単一ソース。
- `src/lib/json/hiragana.json`: しりとり支援の文字リスト。
- `public/dic/*.dic`: 辞書（アナグラム/クロスワード用）。
- `public/data/blank25/problems.json`: BLANK25 マニフェスト。
- `public/data/quiz-data.json`: ponpoppo クイズデータ。
- `public/img/secret/*`: シークレット用アセット。
- `public/og-image.png`, `public/favicons/*`: OGP/アイコン類。

---

## 11. 開発メモ（追加時のチェックリスト）

1. ルート追加: `src/app/(main)/<route>/page.tsx`
2. ナビに出す: `src/lib/json/features.json` に追加（順序は `Article index` と整合させる）
3. SEO: 必要なら `Article index` で JSON-LD を出す（またはページ固有 JSON-LD）
4. 演出: 紙吹雪などは `canvas-confetti` に統一し、reduced-motion と cleanup を必須にする

