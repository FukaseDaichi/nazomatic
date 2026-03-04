# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint

# Shift Search レポート更新時（src/generated/shift-search/* を同期する）
npm run shift:report:meta
npm run shift:report:view-assets
```

テストフレームワークは未設定。

## Architecture

**ナゾマティック（NAZOMATIC）** — 謎解き・パズル支援ツール集。Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui (Radix UI)。

### Route Group 構成

| グループ | パス | 特徴 |
|---|---|---|
| `(main)` | `/`, `/shiritori`, `/dice`, `/alphabet`, `/prefectures`, `/graphpaper`, `/anagram`, `/calendar`, `/constellation`, `/shift-search` | 公開・検索インデックス対象 |
| `(blank25)` | `/blank25`, `/blank25/[problemId]`, `/blank25/editor` | `robots.index=false`、Editor は Basic 認証 |
| `(secret)` | `/secret/*` | `robots.index=false` |
| `api` | `/api/calendar`, `/api/realtime`, `/api/internal/*` | 内部 API は Bearer または Basic 認証 |

### Single Source of Truth: `features.json`

`src/lib/json/features.json` は以下 4 箇所で共有される。**配列順が仕様**なので変更時は慎重に。

- トップページの機能カード一覧
- ヘッダーアイコンナビ
- `sitemap.ts` の URL 列挙
- `json-ld-component.tsx` の `Article index` 参照（`features.features[index]` を直接参照）

新規公開ページをナビに出す場合は必ずここを更新する。`/blank25` や `/shift-search/reports` など一覧外のページはヘッダー導線対象外。

### 認証

- **BLANK25 Editor**: `src/middleware.ts` が `/blank25/editor/*` と `/api/internal/blank25/editor/*` を HTTP Basic 認証で保護
- **内部 API（Realtime/X）**: `Authorization: Bearer <REALTIME_INTERNAL_API_TOKEN>`

### データ層

- **Firestore** (`src/server/firebase/admin.ts`): `realtimeEvents` コレクション。Firebase 初期化は `FIREBASE_SERVICE_ACCOUNT`（JSON 文字列）または `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` のいずれか。
- **BLANK25 マニフェスト**: `public/data/blank25/problems.json` を GitHub API 経由で更新（`src/server/blank25/github.ts`）。問題 ID は全カテゴリで一意であること。

### 主要クラス・ユーティリティ

- `src/class/SearchManager.ts` — 辞書検索（アナグラム / クロスワード / 正規表現）
- `src/class/ShiritoriManager.ts` — しりとり最長連鎖探索
- `src/lib/shift-search.ts` — シフト検索アルゴリズム（英 25 / 日 45 シフト）

### デザインルール

- メインデザイン: `bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセント: `purple-400`
- ダークテーマ前提（Tailwind の `darkMode: "class"`）

### 開発チェックリスト

1. 外部取得は `/api/*` に集約し、クライアントから直接外部サイトを叩かない。
2. 内部 API の認証方式（Bearer / Basic）を変えない。
3. 演出追加時は `prefers-reduced-motion` と cleanup を実装する。
4. Shift Search レポート更新時は生成スクリプトを実行し、`src/generated/shift-search/*` を同期する。

## Environment Variables

```
NEXT_PUBLIC_BASE_URL                    # metadata / sitemap / JSON-LD（未設定時: https://nazomatic.vercel.app）

# Firestore（方式AまたはB）
FIREBASE_SERVICE_ACCOUNT                # サービスアカウント JSON 文字列（方式A）
FIREBASE_PROJECT_ID                     # （方式B）
FIREBASE_CLIENT_EMAIL                   # （方式B）
FIREBASE_PRIVATE_KEY                    # （方式B）

# 内部API認可
REALTIME_INTERNAL_API_TOKEN

# X 再投稿
X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET / X_USER_ID

# BLANK25 Editor
BLANK25_EDITOR_USER / BLANK25_EDITOR_PASSWORD
GITHUB_TOKEN / BLANK25_EDITOR_GITHUB_OWNER / BLANK25_EDITOR_GITHUB_REPO / BLANK25_EDITOR_GITHUB_BRANCH
```

## GitHub Actions（バッチ）

| Workflow | スケジュール (UTC) | 内容 |
|---|---|---|
| `realtime-register.yml` | `0 * * * *` | `#謎チケ売ります` を register |
| `realtime-register-transfer.yml` | `15 * * * *` | `#謎チケ譲ります` を register |
| `realtime-register-accompany.yml` | `30 * * * *` | `#謎解き同行者募集` を register |
| `realtime-prune.yml` | `15 0 * * *` | 古いイベントを prune |
| `x-repost-events.yml` | 1 日 16 回 | 候補イベントを repost |
