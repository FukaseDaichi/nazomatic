# NAZOMATIC 仕様書（実装準拠 / 2026-03-07）

本書は `nazomatic` リポジトリの現行実装を基準に整理した全体仕様です。詳細仕様は `docs/README.md` の正本一覧を参照してください。

## 1. サイト概要

- 目的: 謎解き・パズル支援ツールとイベント補助ツールを 1 サイトに集約する。
- 実装方式: Next.js App Router。
- 主対象: 日本語話者の謎解き参加者 / 制作者、チケット譲渡情報を追うユーザー。

### 1.1 デザインルール

```md
# ルール
- メインデザイン`bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセント`purple-400`
```

## 2. アーキテクチャ構成

### 2.1 Route Group 構成

- `src/app/(main)`: 公開メイン機能。
- `src/app/(blank25)`: BLANK25 領域。`robots.index=false`。
- `src/app/(secret)`: シークレット領域。`robots.index=false`。
- `src/app/api/*`: 公開 API と内部 API。

### 2.2 ドキュメントと生成物の配置

- 人間向け docs: `docs/`
- Shift Search のレポート成果物: `artifacts/shift-search/reports`
- Next.js が読む生成済み assets: `src/generated/shift-search`
- `.codex/` は tool 用の `skills` / `templates` のみ保持する。

### 2.3 単一ソース運用（`features.json`）

`src/lib/json/features.json` を以下の単一ソースとして扱う。

- トップページの機能カード一覧
- ヘッダーアイコンナビ
- `sitemap.ts` の URL 列挙
- `json-ld-component.tsx` の `Article index` 参照元

注意:

- `Article` は `features.features[index]` を直接参照するため、配列順は仕様。
- `features.json` に含まれないページ（`/blank25`, `/blank25/editor`, `/shift-search/reports` など）はヘッダー導線対象外。

### 2.4 SEO / クロール制御

- `robots.ts` で `/api/` と `/secret/` をクロール禁止。
- `(secret)` と `(blank25)` の layout で `robots.index=false` を設定。
- `sitemap.ts` は `/` と `features.json` に含まれる公開ページのみ出力する。

## 3. 技術スタック

- Next.js 14 / React 18 / TypeScript
- Tailwind CSS + shadcn/ui（Radix UI）
- framer-motion / lucide-react
- 3D: `react-three/fiber` + `@react-three/drei` + `three`
- Firebase Admin SDK（Firestore）
- 日付推定: `chrono-node`
- 画像トリミング: `react-easy-crop`

## 4. 環境変数

### 4.1 共通

- `NEXT_PUBLIC_BASE_URL`
  - 用途: metadata / sitemap / JSON-LD。
  - 未設定時既定値: `https://nazomatic.vercel.app`

### 4.2 Firestore（サーバー側）

`src/server/firebase/admin.ts` は以下いずれかで初期化する。

- 方式 A: `FIREBASE_SERVICE_ACCOUNT`（service account JSON 文字列）
- 方式 B: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

### 4.3 内部 API 認可（Realtime / X）

- `REALTIME_INTERNAL_API_TOKEN`
  - 対象: `/api/internal/realtime/register`, `/api/internal/realtime/prune`, `/api/internal/x/repost/events`
  - 形式: `Authorization: Bearer <token>`

### 4.4 X repost（利用時）

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_USER_ID`

### 4.5 BLANK25 Editor

- Basic 認証: `BLANK25_EDITOR_USER`, `BLANK25_EDITOR_PASSWORD`
- GitHub 反映: `GITHUB_TOKEN`, `BLANK25_EDITOR_GITHUB_OWNER`, `BLANK25_EDITOR_GITHUB_REPO`, `BLANK25_EDITOR_GITHUB_BRANCH`
- `BLANK25_EDITOR_GITHUB_BRANCH` 未設定時の既定値: `main`
- クライアント側画像 URL: `NEXT_PUBLIC_BLANK25_STORAGE_RAW_BASE`
  - 未設定時既定値: `https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main`

## 5. 画面構成

### 5.1 メイン領域（`(main)`）

| パス | 機能 |
| --- | --- |
| `/` | トップページ |
| `/shiritori` | しりとり最長連鎖探索 |
| `/dice` | サイコロ展開図 + 3D |
| `/alphabet` | アルファベット / 数字相互変換 |
| `/prefectures` | 都道府県 / 県庁所在地検索 |
| `/graphpaper` | 方眼紙エディタ |
| `/anagram` | 辞書検索 |
| `/calendar` | 謎チケカレンダー |
| `/constellation` | 星座検索 |
| `/shift-search` | シフト検索 |
| `/shift-search/reports` | シフト検索レポート一覧 |
| `/shift-search/reports/[lang]/[length]` | シフト検索レポート詳細 / ダウンロード案内 |

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

## 6. 主要機能要件

### 6.1 しりとり

- 改行区切り単語を読み込み、最長連鎖を探索する。
- ひらがな / カタカナを正規化して先頭末尾比較を行う。

### 6.2 アルファベット

- アルファベットと数字を相互変換する。
- 半角 / 全角英字と半角 / 全角数字を正規化して扱う。
- `-` 区切りの数列入力を A-Z に変換できる。

### 6.3 都道府県検索

- 47 都道府県の固定データを検索対象にする。
- 都道府県名ひらがな / 県庁所在地ひらがなの 2 軸で絞り込む。
- `＊` を 0 文字以上、`？` を 1 文字ワイルドカードとして扱う。

### 6.4 方眼紙

- 1〜20 行・1〜20 列のグリッドを編集できる。
- 初期値は 10x10。
- 各セルは 1 文字入力。
- キーボード移動、モバイルでのスワイプ移動、`＃` 自動埋め、セル色変更に対応する。

### 6.5 辞書検索（Anagram）

- 辞書切替: `buta.dic` / `CEFR-J.dic`
- モード: アナグラム / クロスワード / 正規表現
- 表示上限: `ANAGRAM_RESULT_MAXCOUNT = 200`

### 6.6 謎チケカレンダー

- Firestore の `realtimeEvents` を月間 42 セルのカレンダーとして表示する。
- UI 上のクエリ候補は `#謎チケ売ります`, `#謎解き同行者募集`, `#謎チケ譲ります`。
- `textFilter` で `rawPostText` をクライアント側絞り込みできる。
- イベント詳細は日別ダイアログで表示する。
- `useCalendarData` で 1 分 TTL のインメモリキャッシュを持つ。

### 6.7 星座検索

- 12 星座 / 四季の星座 / 全件タブを切り替えられる。
- 星座名ひらがな、ラテン名、略称で横断検索できる。
- かな検索はワイルドカード対応で前処理付きマッチングを行う。

### 6.8 シフト検索

- 英語 25 シフト、日本語 45 シフトを探索する。
- `includeAnagram=true` でシフト後アナグラム検索を実施する。
- 結果上限:
  - `SHIFT_EXACT_RESULT_MAXCOUNT = 1000`
  - `SHIFT_ANAGRAM_RESULT_MAXCOUNT = 3000`
  - `SHIFT_TOTAL_RESULT_MAXCOUNT = 5000`
- レポート一覧 / 詳細ページを持つ。
- レポート表示の外部分離しきい値は `3000` 行。

### 6.9 BLANK25 プレイ

- 通常モード: パネルを開封しながら回答する。スコアは `25 - 開封数`。
- 作問モード: `?mode=sakumon`。`draft -> locked -> solved` の状態遷移を持つ。
- 回答正規化:
  - Unicode 正規化 `NFKC`
  - カタカナをひらがなへ統一
  - 空白除去
  - 英字小文字化
- 保存キー:
  - 通常: `blank25:v1:<manifestVersion>:<problemId>`
  - 作問: `blank25:sakumon:v1:<manifestVersion>:<problemId>`

### 6.10 BLANK25 Editor

- 画像アップロード + トリミング + 回答入力で `nazomatic-storage` リポジトリを更新する。
- `react-easy-crop` による 1:1 トリミング、5x5 ルーラー表示に対応する。
- create / update / delete を `Git Trees API` 経由で同一コミットとして反映する。
- publish レスポンスに更新後 `manifest` を含め、Editor はそれを直接 state に反映する。

## 7. API 要件

### 7.1 公開 API

#### `GET /api/realtime`

- Yahoo リアルタイム検索ページの `__NEXT_DATA__` を解析して返す。
- パラメータ: `query`, `page`, `limit`
- デフォルト query: `#謎チケ売ります`
- `limit` の上限: `40`（`PAGE_SIZE`）
- キャッシュ: `revalidate=60` / `Cache-Control: public, max-age=0, s-maxage=60`

#### `GET /api/calendar`

- Firestore `realtimeEvents` を `eventTime` 範囲で取得する。
- パラメータ: `query`, `from`, `to`, `rangeDays`
- デフォルト:
  - `query = #謎チケ売ります`
  - `rangeDays = 28`
- 上限: `rangeDays <= 60`, `MAX_RESULTS = 500`
- クエリ条件:
  - `eventTime >= from`
  - `eventTime < to+1day` または `from + rangeDays`
  - `sourceQuery == query`
- キャッシュ: `Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=300`

#### `GET /api/blank25/manifest`

- `nazomatic-storage` の raw URL（タイムスタンプ付き）から `problems.json` を取得して返す。
- サーバー / クライアントともに `Cache-Control: no-store`

### 7.2 内部 API（Realtime / X）

#### `POST /api/internal/realtime/register`

- Bearer 認証必須。
- リクエスト:
  - `query: string` 必須
  - `limit?: number` 既定 `20`、受理上限 `100`
  - `sinceId?: string` 数字文字列
  - `dryRun?: boolean`
- Yahoo 取得時の実 fetch 件数は `min(limit, 40)`。
- `missing_event_time`, `event_time_in_past`, `already_exists` を `skipped.reason` に使う。
- Firestore の doc ID は `${postId}:${RULESET_VERSION}`。
- 現行実装では duplicate は更新せず `skipped` 扱いで、`updated` は常に `0`。

#### `POST /api/internal/realtime/prune`

- Bearer 認証必須。
- リクエスト:
  - `cutoffDays?: number` 既定 `1`、上限 `30`
  - `dryRun?: boolean`
- `eventTime < cutoffDate` を対象に 500 件単位で削除する。
- 最大 20 バッチまで処理する。

#### `POST /api/internal/x/repost/events`

- Bearer 認証必須。
- リクエスト:
  - `hashtag: string` 必須
  - `dryRun?: boolean`
- 候補抽出条件:
  - `capturedAt >= now - 24h`
  - `lastReviewedAt == null`
  - `hashtags array-contains hashtag variant`
  - `capturedAt desc`
  - 最大 `50` 件確認
- 候補なしは `204 No Content` + `X-Repost-Reason: no_candidate`
- `dryRun=false` のときのみ X API へ repost し、`lastReviewedAt` を更新する

### 7.3 BLANK25 Editor API（Basic 認証）

`middleware.ts` で以下を保護する。

- `/blank25/editor/:path*`
- `/api/internal/blank25/editor/:path*`

追加制約:

- 更新系 API（`POST`, `PUT`, `PATCH`, `DELETE`）は `Origin` が異なる場合 `403`

#### `GET /api/internal/blank25/editor/manifest`

- `nazomatic-storage` の raw URL（タイムスタンプ付き）から `problems.json` を取得して返す。
- `dynamic = "force-dynamic"`
- `Cache-Control: no-store`

#### `POST /api/internal/blank25/editor/publish`

- `mode: create | update | delete`
- `problemId`: update / delete で必須
- `categoryId`, `linkName`, `answers`: create / update で必須
- `image?: { base64, contentType }`
  - create では必須
  - update では任意
  - 対応 MIME: `image/webp`, `image/png`, `image/jpeg`
- `force: true` で GitHub branch を更新するため、競合検知はしない

## 8. データ要件

### 8.1 Firestore（`realtimeEvents`）

- 主要フィールド:
  - `postId`, `postURL`, `hashtags`, `rawPostText`
  - `authorId`, `authorName`, `authorImageUrl`
  - `eventTime`, `eventDateResolution`, `ticketTitle`, `category`
  - `price`, `quantity`, `deliveryMethod`, `location`
  - `sourceQuery`, `capturedAt`, `createdAt`
  - `normalizationEngine`, `confidence`, `notes`, `needsReview`, `reviewStatus`, `lastReviewedAt`

### 8.2 BLANK25 マニフェスト

- 取得元: `nazomatic-storage` リポジトリの `problems.json`
- 画像: 同リポジトリの `img/` 以下
- 構造: `version`, `categories[]`, `category.problems[]`
- 問題 ID は全カテゴリで一意

### 8.3 Shift Search レポート

- 元成果物:
  - `artifacts/shift-search/reports/shift-search-report-manifest.json`
  - `artifacts/shift-search/reports/shift-search-report-index.md`
  - `artifacts/shift-search/reports/{jp|en}/shift-search-*-len-*.md`
- Next.js 用生成物:
  - `src/generated/shift-search/view-manifest.json`
  - `src/generated/shift-search/internal/{lang}-{length}.json`

## 9. バッチ運用（GitHub Actions）

| Workflow | スケジュール (UTC) | 内容 |
| --- | --- | --- |
| `realtime-register.yml` | 毎時 `0 * * * *` | `#謎チケ売ります` を register |
| `realtime-register-transfer.yml` | 毎時 `15 * * * *` | `#謎チケ譲ります` を register |
| `realtime-register-accompany.yml` | 毎時 `30 * * * *` | `#謎解き同行者募集` を register |
| `realtime-prune.yml` | 毎日 `15 0 * * *` | 古いイベントを prune |
| `x-repost-events.yml` | 1 日 16 回 | 候補イベントを repost |

利用 Secrets:

- `REALTIME_API_BASE_URL`
- `REALTIME_API_TOKEN`（`REALTIME_INTERNAL_API_TOKEN` と同値）

## 10. 開発ルール / 変更チェックリスト

1. 新規公開ページをナビに出す場合は `features.json` を更新する。
2. `features.json` の順序変更時は `Article index` 参照ページを必ず見直す。
3. 外部取得は `/api/*` 側に集約し、クライアントから直接外部サイトを叩かない。
4. 内部 API の認証方式（Bearer / Basic）と `middleware.ts` の保護範囲を維持する。
5. Shift Search レポート更新時は `npm run shift:report:meta` と `npm run shift:report:view-assets` を実行し、`src/generated/shift-search/*` を同期する。
6. BLANK25 マニフェスト更新時は `id` 重複がないことを確認する。
7. docs 更新時は `docs/README.md` の正本一覧も必要に応じて見直す。
