# NAZOMATIC 開発ガイド

## 位置づけ

この文書は、開発時に必要なセットアップ、コマンド、環境変数、生成手順、検証方針をまとめます。システム構造は `docs/system-design.md`、サブシステム詳細は各設計書を参照します。

## セットアップ

```bash
npm install
npm run dev
```

開発サーバーは既定で `http://localhost:3000` です。

## コマンド

| コマンド | 用途 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | production build |
| `npm run start` | production server を起動 |
| `npm run lint` | ESLint |
| `npm run shift:report:meta` | Shift Search レポート元成果物から manifest / index を生成 |
| `npm run shift:report:view-assets` | Shift Search レポート表示用 JSON を `src/generated/shift-search` に生成 |

テストフレームワークは未設定です。変更内容に応じて `npm run lint`、`npm run build`、ブラウザでの手動確認を使い分けます。

## 環境変数

### 共通

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | metadata、sitemap、JSON-LD の base URL | `https://nazomatic.vercel.app` |

### Firestore 設定

`src/server/firebase/admin.ts` は以下いずれかで Firebase Admin SDK を初期化します。

| 方式 | 変数 |
|---|---|
| サービスアカウント JSON | `FIREBASE_SERVICE_ACCOUNT` |
| 個別指定 | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |

どちらも未設定の場合は `initializeApp()` の既定認証に委ねます。

### 内部 API

| 変数 | 用途 |
|---|---|
| `REALTIME_INTERNAL_API_TOKEN` | `/api/internal/realtime/*` と `/api/internal/x/repost/events` の Bearer 認証 |

GitHub Actions では `REALTIME_API_TOKEN` secret として同じ値を渡します。

### X 再投稿

| 変数 | 用途 |
|---|---|
| `X_API_KEY` | X API OAuth 1.0a consumer key |
| `X_API_SECRET` | X API OAuth 1.0a consumer secret |
| `X_ACCESS_TOKEN` | X API access token |
| `X_ACCESS_TOKEN_SECRET` | X API access token secret |
| `X_USER_ID` | 再投稿を行う X user id |

### BLANK25 Editor / storage 設定

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `BLANK25_EDITOR_USER` | Editor Basic 認証ユーザー | なし |
| `BLANK25_EDITOR_PASSWORD` | Editor Basic 認証パスワード | なし |
| `GITHUB_TOKEN` | `nazomatic-storage` へ commit する GitHub token | なし |
| `BLANK25_EDITOR_GITHUB_OWNER` | storage repo owner | なし |
| `BLANK25_EDITOR_GITHUB_REPO` | storage repo name | なし |
| `BLANK25_EDITOR_GITHUB_BRANCH` | storage repo branch | `main` |
| `NEXT_PUBLIC_BLANK25_STORAGE_RAW_BASE` | BLANK25 画像配信用 raw URL base | `https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main` |

`BLANK25_EDITOR_GITHUB_REPO` は `nazomatic-storage` を指す前提です。

## GitHub Actions 運用

| Workflow | 起動 | 対象 API |
|---|---|---|
| `realtime-register.yml` | 毎時 0 分 | `POST /api/internal/realtime/register`、`#謎チケ売ります` |
| `realtime-register-transfer.yml` | 毎時 15 分 | `POST /api/internal/realtime/register`、`#謎チケ譲ります` |
| `realtime-register-accompany.yml` | 毎時 30 分 | `POST /api/internal/realtime/register`、`#謎解き同行者募集` |
| `realtime-verify-post-visibility.yml` | 毎時 45 分 | `POST /api/internal/realtime/verify-post-visibility` |
| `realtime-prune.yml` | 毎日 00:15 UTC | `POST /api/internal/realtime/prune` |
| `x-repost-events.yml` | 手動実行のみ | `POST /api/internal/x/repost/events` |

`x-repost-events.yml` の自動 schedule は、X 投稿 credits の都合でコメントアウトされています。

## Shift Search レポート更新

Shift Search のレポートは、元成果物と Next.js 表示用 assets が分かれています。

1. `artifacts/shift-search/reports/{jp|en}` に Markdown レポートを配置する。
2. 必要に応じて `artifacts/shift-search/reports/shift-search-external-links.json` を更新する。
3. `npm run shift:report:meta` を実行する。
4. `npm run shift:report:view-assets` を実行する。
5. `artifacts/shift-search/reports/*` と `src/generated/shift-search/*` の差分を確認する。

詳細は `docs/shift-search/design.md` を参照します。

## ドキュメント更新方針

- ドキュメントは日本語で書きます。
- `AGENTS.md` は例外的に英語の短いエージェント向け実行ルールとして管理します。
- 実装と矛盾した場合は、ソースコードを正としてドキュメントを修正します。
- サブシステムの詳細は以下に集約します。
  - BLANK25: `docs/blank25/design.md`
  - 謎チケカレンダー / Realtime: `docs/calendar-realtime/design.md`
  - Shift Search: `docs/shift-search/design.md`
- 新しい設計書を追加した場合は `docs/README.md` も更新します。

## 変更時チェック

- 新規公開ページをメイン導線に出す場合は `src/lib/json/features.json` を更新したか。
- `features.json` の順序変更時に JSON-LD の index 参照影響を確認したか。
- 外部取得をクライアントから直接行わず `/api/*` 側に置いたか。
- 内部 API の Bearer 認証、BLANK25 Editor の Basic 認証を維持したか。
- UI / フォーム変更時に `docs/ai-coding-rules.md` を満たしているか。
- Shift Search レポート更新時に `src/generated/shift-search/*` を同期したか。
