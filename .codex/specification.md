# NAZOMATIC 要件定義書（実装準拠 / 2026-03-04）

本書は `nazomatic` リポジトリの現行実装（Next.js App Router）を基準に整理した要件定義書です。

---

## 1. サイト概要

- 目的: 謎解き・パズル支援ツールとイベント補助ツールを 1 サイトに集約する。
- 主対象: 日本語話者の謎解き参加者 / 制作者、イベント情報を追うユーザー。
- 実装方式: Next.js App Router（Route Group で領域分離）。

### 1.1 デザインルール

```md
# ルール
- メインデザイン`bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセント`purple-400`
```

---

## 2. アーキテクチャ方針

### 2.1 Route Group 構成

- `src/app/(main)`: 公開メイン機能。
- `src/app/(blank25)`: BLANK25 領域（`robots.index=false`）。
- `src/app/(secret)`: シークレット領域（`robots.index=false`）。
- `src/app/api/*`: 公開 / 内部 API。

### 2.2 単一ソース運用（`features.json`）

`src/lib/json/features.json` を以下の単一ソースとして扱う。

- トップページの機能カード一覧
- ヘッダーアイコンナビ
- `sitemap.ts` の URL 列挙
- `json-ld-component.tsx` の `Article index` 参照元

注意:

- `Article` は `features.features[index]` を直接参照するため、配列順は仕様。
- `features.json` に含まれないページ（`/blank25`, `/blank25/editor`, `/shift-search/reports` など）はヘッダー導線対象外。

### 2.3 SEO / クロール制御

- `robots.ts` で `/api/` と `/secret/` をクロール禁止。
- `(secret)` と `(blank25)` の layout で `robots.index=false` を設定。
- `sitemap.ts` は `/` + `features.json` のパスのみ出力。

---

## 3. 技術スタック

- Next.js 14 / React 18 / TypeScript
- Tailwind CSS + shadcn/ui（Radix UI）
- framer-motion / lucide-react
- 3D: `react-three/fiber` + `@react-three/drei` + `three`
- JSON-LD: `schema-dts`
- Firebase Admin SDK（Firestore）
- 日時推定: `chrono-node`
- 画像トリミング: `react-easy-crop`

---

## 4. 環境変数

### 4.1 共通

- `NEXT_PUBLIC_BASE_URL`
  - 用途: metadata / sitemap / JSON-LD。
  - 未設定時既定値: `https://nazomatic.vercel.app`

### 4.2 Firestore（サーバー側）

`src/server/firebase/admin.ts` は以下いずれかで初期化。

- 方式 A: `FIREBASE_SERVICE_ACCOUNT`（service account JSON 文字列）
- 方式 B: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

### 4.3 内部 API 認可（Realtime/X）

- `REALTIME_INTERNAL_API_TOKEN`
  - 対象: `/api/internal/realtime/register`, `/api/internal/realtime/prune`, `/api/internal/x/repost/events`
  - 形式: `Authorization: Bearer <token>`

### 4.4 X 再投稿機能（利用時）

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_USER_ID`

### 4.5 BLANK25 Editor（必須）

- Basic 認証: `BLANK25_EDITOR_USER`, `BLANK25_EDITOR_PASSWORD`
- GitHub 反映: `GITHUB_TOKEN`, `BLANK25_EDITOR_GITHUB_OWNER`, `BLANK25_EDITOR_GITHUB_REPO`（`nazomatic-storage` を指定）, `BLANK25_EDITOR_GITHUB_BRANCH`
- クライアント側画像 URL: `NEXT_PUBLIC_BLANK25_STORAGE_RAW_BASE`（例: `https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main`）

---

## 5. 画面要件

### 5.1 メイン領域（`(main)`）

| パス | 機能 |
| --- | --- |
| `/` | トップページ |
| `/shiritori` | しりとり最長連鎖探索 |
| `/dice` | サイコロ展開図 + 3D |
| `/alphabet` | アルファベット変換 |
| `/prefectures` | 都道府県検索 |
| `/graphpaper` | 方眼紙エディタ |
| `/anagram` | 辞書検索 |
| `/calendar` | 謎チケカレンダー |
| `/constellation` | 星座検索 |
| `/shift-search` | シフト検索 |
| `/shift-search/reports` | シフト検索レポート一覧 |
| `/shift-search/reports/[lang]/[length]` | シフト検索レポート詳細 |

### 5.2 BLANK25 領域（`(blank25)`）

| パス | 機能 |
| --- | --- |
| `/blank25` | 問題一覧 |
| `/blank25/[problemId]` | ゲーム（通常 / 作問モード） |
| `/blank25/editor` | 管理用アップロード編集画面（Basic 認証） |

### 5.3 シークレット領域（`(secret)`）

| パス | 機能 |
| --- | --- |
| `/secret/christmas` | Google 風 UI + 音声入力 |
| `/secret/christmas/congratulations` | 演出ページ |
| `/secret/ponpoppo/[productId]` | クイズ表示 |

---

## 6. 主要機能要件

### 6.1 しりとり

- 改行区切り単語を読み込み、最長連鎖を探索。
- ひらがな / カタカナは正規化して先頭末尾比較。

### 6.2 辞書検索（Anagram）

- 辞書切替: `buta.dic` / `CEFR-J.dic`。
- モード: アナグラム / クロスワード / 正規表現。
- 表示上限: `ANAGRAM_RESULT_MAXCOUNT = 200`。

### 6.3 シフト検索

- 英語 25 シフト、日本語 45 シフトを探索。
- `includeAnagram=true` でシフト後アナグラム検索を実施。
- 結果上限: exact 1000 / anagram 3000 / total 5000。

### 6.4 謎チケカレンダー

- Firestore の `realtimeEvents` を表示。
- `query` / `from` / `to` / `rangeDays` 指定に対応。
- クライアント側 `useCalendarData` で 1 分 TTL キャッシュ。

### 6.5 BLANK25 プレイ

- 通常モード: パネルを開封しながら回答（スコア: `25 - 開封数`）。
- 作問モード: 隠しパネル配置を作成してロック後に回答（スコア: `表示数`）。
- 回答正規化: かな統一 + 空白除去。
- 保存キー:
  - 通常: `blank25:v1:<manifestVersion>:<problemId>`
  - 作問: `blank25:sakumon:v1:<manifestVersion>:<problemId>`

### 6.6 BLANK25 Editor

- 画像アップロード + トリミング + 回答入力で `nazomatic-storage` リポジトリを更新。
- `react-easy-crop` による 1:1 トリミング、5x5 ルーラー表示。
- Git Trees API 経由で `problems.json` と画像を `nazomatic-storage` へ同一コミットで反映。
- publish レスポンスに更新後 `manifest` を含め、Editor はそれを直接 state に反映（再取得不要）。

---

## 7. API 要件

### 7.1 公開 API

- `GET /api/realtime`
  - Yahoo リアルタイム検索ページの `__NEXT_DATA__` を解析。
  - パラメータ: `query`, `page`, `limit`。

- `GET /api/calendar`
  - Firestore `realtimeEvents` を `eventTime` 範囲で取得。
  - パラメータ: `query`, `from`, `to`, `rangeDays`。
  - 上限: `rangeDays<=60`, `MAX_RESULTS=500`。

- `GET /api/blank25/manifest`
  - `nazomatic-storage` の raw URL（タイムスタンプ付き）をサーバー fetch して返す。

### 7.2 内部 API（Realtime/X）

- `POST /api/internal/realtime/register`（Bearer 必須）
- `POST /api/internal/realtime/prune`（Bearer 必須）
- `POST /api/internal/x/repost/events`（Bearer 必須）

### 7.3 BLANK25 Editor API（Basic 認証）

- `GET /api/internal/blank25/editor/manifest`
  - `nazomatic-storage` の raw URL（タイムスタンプ付き）から `problems.json` を取得して返す。

- `POST /api/internal/blank25/editor/publish`
  - `create | update | delete` に応じてマニフェスト更新・画像反映。
  - Git Trees API で JSON + 画像を同一コミットとして `force: true` で push。
  - 競合検知なし（last write wins）。
  - 応答に更新後の `manifest` を含む。

---

## 8. データ要件

### 8.1 Firestore（`realtimeEvents`）

- 投稿: `postId`, `postURL`, `hashtags`, `rawPostText`
- 投稿者: `authorId`, `authorName`, `authorImageUrl`
- イベント: `eventTime`, `eventDateResolution`, `ticketTitle`, `category`, `price`, `quantity`, `deliveryMethod`, `location`
- 収集: `sourceQuery`, `capturedAt`, `createdAt`
- 正規化: `normalizationEngine`, `confidence`, `notes`, `needsReview`, `reviewStatus`, `lastReviewedAt`

### 8.2 BLANK25 マニフェスト

- ファイル: `nazomatic-storage` リポジトリの `problems.json`（`BLANK25_EDITOR_GITHUB_BRANCH` ブランチ）
- 画像: 同リポジトリの `img/` 以下
- 構造: `version`, `categories[]`, `category.problems[]`
- 問題 ID は全カテゴリで一意。

---

## 9. バッチ運用（GitHub Actions）

| Workflow | スケジュール(UTC) | 内容 |
| --- | --- | --- |
| `realtime-register.yml` | 毎時 `0 * * * *` | `#謎チケ売ります` を register |
| `realtime-register-transfer.yml` | 毎時 `15 * * * *` | `#謎チケ譲ります` を register |
| `realtime-register-accompany.yml` | 毎時 `30 * * * *` | `#謎解き同行者募集` を register |
| `realtime-prune.yml` | 毎日 `15 0 * * *` | 古いイベントを prune |
| `x-repost-events.yml` | 1 日 16 回 | 候補イベントを repost |

利用 Secrets:

- `REALTIME_API_BASE_URL`
- `REALTIME_API_TOKEN`（`REALTIME_INTERNAL_API_TOKEN` と同値）

---

## 10. 開発ルール / 変更チェックリスト

1. 新規公開ページをナビに出す場合は `features.json` を更新する。
2. `features.json` の順序変更時は `Article index` 参照ページを必ず見直す。
3. 外部取得は `/api/*` 側に集約し、クライアントから直接外部サイトを叩かない。
4. 内部 API は認証方式（Bearer / Basic）を維持する。
5. 演出追加時は `prefers-reduced-motion` と cleanup を実装する。
6. Shift Search レポート更新時は生成スクリプトを実行し、`src/generated/shift-search/*` を同期する。
7. BLANK25 マニフェスト更新時は `id` 重複がないことを確認する。
