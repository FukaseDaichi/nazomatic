# データ、外部連携、セキュリティ

## データの正本

| データ | 正本 | 読み書き |
|---|---|---|
| 公開機能一覧 | `src/lib/json/features.json` | トップ、ヘッダー、sitemap、JSON-LD が読む |
| 日本語・英語辞書 | `public/dic/buta.dic`, `public/dic/CEFR-J.dic` | ブラウザの `SearchManager` が fetch / cache |
| 星座 | `src/lib/json/constellations-data.json` | 星座検索が読む |
| Realtime イベント | Firestore `realtimeEvents` | 内部 API が書き、カレンダーと投稿支援が読む |
| X ブラウザ投稿アカウント状態 | Firestore `xBrowserPostingAccounts` | 個別イベント投稿の lease / rate limit |
| BLANK25 問題 | `nazomatic-storage` の `problems.json`, `img/*` | API が raw 読み込み、Editor が GitHub API 書き込み |
| BLANK25 プレイ状態 | ブラウザ `localStorage` | ゲーム画面だけが読む・書く |
| BLANK25 パーティ状態 | ブラウザ `localStorage` | パーティ画面だけが読む・書く |
| Shift Search 元成果物 | `artifacts/shift-search/reports` | 生成 scripts の入力 |
| Shift Search 表示データ | `src/generated/shift-search` | Next.js のレポート画面が import |
| X ローカル投稿状態 | `local/x-browser-posting` | ローカル CLI だけが読む・書く |
| X 実行ログ | `logs/{automationId}` | ローカル CLI が世代管理 |

## Realtime イベント

Firestore document id は `{postId}:{RULESET_VERSION}` です。主要フィールドは次のまとまりを持ちます。

- 原文識別: `postId`, `postURL`, `hashtags`, `rawPostText`, author fields
- 取得情報: `createdAt`, `capturedAt`, `sourceQuery`
- 正規化結果: `eventTime`, `ticketTitle`, `category`, `price`, `quantity`, `deliveryMethod`, `location`
- 品質: `normalizationEngine`, `confidence`, `notes`, `needsReview`, `reviewStatus`
- 可視性: `isVisible`, `hiddenReason`, `hiddenAt`, `syndication*`
- 投稿処理: `lastReviewedAt`, `xBrowserPost`

公開カレンダーは `isRealtimeEventVisible()` が true の document だけを返します。

## BLANK25 ローカル状態

| 用途 | key |
|---|---|
| 通常プレイ | `blank25:v1:{manifestVersion}:{problemId}` |
| 作問モード | `blank25:sakumon:v1:{manifestVersion}:{problemId}` |
| パーティ得点 | `blank25:party-score:v2:default` |
| 旧パーティ得点 | `blank25:party-score:v1:default` |

## 外部サービス境界

| 外部先 | 呼び出し元 | 用途 |
|---|---|---|
| Yahoo!リアルタイム検索 | `src/server/realtime/fetchYahooRealtime.ts` | Post 取得 |
| Firestore | `src/server/firebase/admin.ts` と Route Handler | イベント、投稿状態 |
| GitHub API / raw GitHub | `src/server/blank25/github.ts` | BLANK25 storage 読み書き |
| X API v2 | `api/internal/x/repost/events` | 通常 Repost |
| X syndication endpoint | `src/server/realtime/syndication/verifyPost.ts` | 元 Post の可視性確認 |
| x.com | ローカル Playwright / CDP | ブラウザ投稿 |

クライアントコンポーネントは外部データストアへ直接書き込みません。辞書やアプリ同梱 JSON など同一 origin の静的データは例外です。

## 認証境界

| 対象 | 方式 | 未設定時 |
|---|---|---|
| `/blank25/editor/*` | HTTP Basic | 503 |
| `/api/internal/blank25/editor/*` | HTTP Basic | 503 |
| BLANK25 mutation | Basic に加え、Origin がある場合は同一 origin を要求 | 異なる Origin は 403 |
| `/api/internal/realtime/*` | Bearer token | 500 |
| `/api/internal/x/*` | Bearer token | 500 |

Basic credential は `BLANK25_EDITOR_USER` / `BLANK25_EDITOR_PASSWORD`、Bearer token は `REALTIME_INTERNAL_API_TOKEN` から読みます。

Bearer 認証は `src/server/internal-api/authorization.ts` の `enforceInternalAuthorization()` に集約し、Realtime / X の全 Route Handler がこれを呼びます。header 比較は `timingSafeEqual` による定数時間比較です。認証仕様を変える場合はこの module だけを変更します。

## 秘密情報

- Firebase、GitHub、X API credential はサーバー環境変数に置く。
- X の Cookie、storage state、Chrome profile は `local/` に置き、環境変数へ内容そのものを保存しない。
- `.env*.local`、`local*`、`logs/` は `.gitignore` の対象。
- `NEXT_PUBLIC_*` には公開されてよい URL だけを置く。
