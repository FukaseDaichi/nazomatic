# データ、外部連携、セキュリティ

## データの正本

| データ | 正本 | 読み書き |
|---|---|---|
| 公開機能一覧 | `src/lib/json/features.json` | トップ、ヘッダー、sitemap、JSON-LD が読む |
| 日本語・英語辞書 | `public/dic/buta.dic`, `public/dic/CEFR-J.dic` | ブラウザの `SearchManager` が fetch / cache |
| 星座 | `src/lib/json/constellations-data.json` | 星座検索が読む |
| Realtime イベント | Firestore `realtimeEvents` | 内部 API が書き、カレンダーが読む |
| 内部 API の nonce | Firestore `internalApiNonces` | 内部 API 認証が replay 検出用に書く |
| BLANK25 問題 | `nazomatic-storage` の `problems.json`, `img/*` | API が raw 読み込み、Editor が GitHub API 書き込み |
| BLANK25 プレイ状態 | ブラウザ `localStorage` | ゲーム画面だけが読む・書く |
| BLANK25 パーティ状態 | ブラウザ `localStorage` | パーティ画面だけが読む・書く |
| Shift Search 元成果物 | `artifacts/shift-search/reports` | 生成 scripts の入力 |
| Shift Search 表示データ | `src/generated/shift-search` | Next.js のレポート画面が import |

## Realtime イベント

Firestore document id は `{postId}:{RULESET_VERSION}` です。主要フィールドは次のまとまりを持ちます。

- 原文識別: `postId`, `postURL`, `hashtags`, `rawPostText`, author fields
- 取得情報: `createdAt`, `capturedAt`, `sourceQuery`
- 正規化結果: `eventTime`, `ticketTitle`, `category`, `price`, `quantity`, `deliveryMethod`, `location`
- 品質: `normalizationEngine`, `confidence`, `notes`, `needsReview`, `reviewStatus`
- 可視性: `isVisible`, `hiddenReason`, `hiddenAt`, `syndication*`

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
| Firestore | `src/server/firebase/admin.ts` と Route Handler | イベント |
| GitHub API / raw GitHub | `src/server/blank25/github.ts` | BLANK25 storage 読み書き |
| X syndication endpoint | `src/server/realtime/syndication/verifyPost.ts` | 元 Post の可視性確認 |

クライアントコンポーネントは外部データストアへ直接書き込みません。辞書やアプリ同梱 JSON など同一 origin の静的データは例外です。

## 認証境界

| 対象 | 方式 | 未設定時 |
|---|---|---|
| `/blank25/editor/*` | HTTP Basic | 503 |
| `/api/internal/blank25/editor/*` | middleware と Route Handler の両方で HTTP Basic | 503 |
| BLANK25 mutation | Basic に加え、Origin がある場合は同一 origin を要求。cross-site Fetch metadata も拒否 | 不正・空・null Origin / cross-site は 403 |
| `/api/internal/realtime/*` | Bearer token | 500 |

Basic credential は `BLANK25_EDITOR_USER` / `BLANK25_EDITOR_PASSWORD`、Bearer token は `REALTIME_INTERNAL_API_TOKEN` から読みます。

Bearer 認証は `src/server/internal-api/authorization.ts` の `enforceInternalAuthorization()` に集約し、Realtime の全 Route Handler がこれを呼びます。header 比較は `timingSafeEqual` による定数時間比較です。認証仕様を変える場合はこの module だけを変更します。Editor API は `src/server/blank25/authorization.ts` で Basic credential を定数時間比較し、外部データ操作前に検証します。middleware の文字列比較だけには依存しません。

### 内部 API の request 署名

token 一致だけでは、漏洩した request をそのまま再送できてしまいます。そのため Bearer token に加えて、以下を要求します。

| header | 内容 |
|---|---|
| `x-internal-timestamp` | request 発行時刻（UNIX 秒） |
| `x-internal-nonce` | 16-64 文字の hex 乱数 |
| `x-internal-signature` | `v1=<HMAC-SHA256 hex>` |

署名対象は `v1\n{METHOD}\n{PATH}\n{TIMESTAMP}\n{NONCE}\n{SHA256(body)}` です（`src/server/internal-api/signature.ts`）。PATH は query を含みます。HMAC key は `INTERNAL_API_SIGNING_SECRET`、未設定時は `REALTIME_INTERNAL_API_TOKEN` です。

- **有効期限**: timestamp が現在時刻から ±300 秒を超えると 401。
- **改竄検知**: method / path / body いずれかが変わると署名が一致せず 401。
- **replay 制御**: nonce を Firestore の `internalApiNonces` へ `create()` で一度だけ記録します。同じ nonce の再送は 401。document は `expiresAt` を持ち、best-effort で削除します（Firestore の TTL policy を `expiresAt` に設定するとより確実です）。

retry する client は、必ず timestamp と nonce を作り直します。同一 request の単純再送は replay として拒否されます。

`INTERNAL_API_ALLOW_UNSIGNED=true` を設定すると、署名 header が 1 つも無い request を受理します。移行時の緊急用であり、通常運用では設定しません。

## 秘密情報

- Firebase、GitHub credential はサーバー環境変数に置く。
- `.env*.local`、`local*`、`logs/` は `.gitignore` の対象。
- `NEXT_PUBLIC_*` には公開されてよい URL だけを置く。

## HTTP保護と依存監査

`next.config.js` で nosniff、フレーム埋め込み拒否、object-src / base-uri、Referrer-Policy を設定します。画像最適化の外部取得先は `raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/**` に限定します。独自storageを使う場合は環境変数だけでなくallowlistの変更も必要です。ponpoppoは同梱JSONを読み、Hostヘッダーから外部URLを構築しません。

継続監査は `.github/workflows/security-checks.yml` と Dependabot を使用します。残存するビルド依存のDoS指摘、CI閾値、本番で必要な運用対策は [セキュリティ調査](../../maintenance/security-assessment-2026-10.md) を参照します。
