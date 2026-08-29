# ルートと API

## 画面ルート

### 公開メイン領域

| ルート | 役割 | 主な実装 |
|---|---|---|
| `/` | 機能カード一覧と 3D hero | `src/app/(main)/page.tsx` |
| `/shiritori` | 最長しりとり連鎖 | `ShiritoriManager` |
| `/dice` | サイコロ展開図と 3D 表示 | `src/components/diceComponent` |
| `/alphabet` | アルファベット・数字変換 | `alphabet-converter.tsx` |
| `/prefectures` | 都道府県・県庁所在地検索 | `prefecture-search-table.tsx` |
| `/graphpaper` | 方眼紙エディタ | `graph-paper-component.tsx` |
| `/anagram` | 辞書検索 | `SearchManager` |
| `/calendar` | 謎チケカレンダー | `CalendarPageClient.tsx` |
| `/constellation` | 星座検索 | `src/lib/constellation` |
| `/shift-search` | 文字シフト検索 | `src/lib/shift-search.ts` |
| `/character-pick-search` | 登録語からの文字拾い検索 | `src/lib/character-pick-search.ts` |
| `/shift-search/reports` | 生成済みレポート一覧 | `shift-search-report-list.tsx` |
| `/shift-search/reports/[lang]/[length]` | 内部レポート表示または外部配信案内 | `shift-search-report-detail.tsx` |

`features.json` に含まれる `/` 以外の 10 ルートだけがメインカード、ヘッダーナビ、sitemap の共通対象です。Shift Search レポートは公開画面ですが、共通導線の列挙対象外です。

### BLANK25 領域

| ルート | 役割 |
|---|---|
| `/blank25` | 問題一覧 |
| `/blank25/[problemId]` | 通常プレイ / 作問モード |
| `/blank25/editor` | Basic 認証付き問題 Editor |
| `/blank25/party` | パーティ得点表示 |
| `/blank25/party/rules` | チーム戦ルール |

### secret 領域

| ルート | 役割 |
|---|---|
| `/secret/christmas` | Google 風の隠し画面 |
| `/secret/christmas/congratulations` | 隠し完了画面 |
| `/secret/ponpoppo/[productId]` | `public/data/quiz-data.json` を読むクイズ画面 |

## API 一覧

### 公開 API

| Method / path | 認証 | 役割 | Cache |
|---|---|---|---|
| `GET /api/realtime` | なし | Yahoo!リアルタイム検索結果 | CDN 60 秒 |
| `GET /api/calendar` | なし | Firestore イベントをカレンダー用に返す | CDN 300 秒 + stale 300 秒 |
| `GET /api/blank25/manifest` | なし | storage repo の manifest を検証して返す | `no-store` |

`GET /api/calendar` は既定 `query=#謎チケ売ります`、既定 28 日、最大 60 日、最大 500 件です。日付境界は `Asia/Tokyo` です。取得が上限に達した場合は response の `truncated` が `true` になり、`limit` に適用した上限（500）が入ります。`truncated` は可視性フィルタ前の件数で判定するため、未返却 event が残っている「可能性」を示すだけです。詳細は `docs/system-design/subsystems/calendar-realtime.md` を参照します。

`GET /api/realtime` は `query`、正の整数 `page`、`limit` を受けます。実効 `limit` は Yahoo 取得処理の `PAGE_SIZE=40` が上限です。

### BLANK25 Editor API

| Method / path | 認証 | 役割 |
|---|---|---|
| `GET /api/internal/blank25/editor/manifest` | Basic | Editor 用 manifest 取得 |
| `POST /api/internal/blank25/editor/publish` | Basic + Origin 確認 | create / update / delete を storage repo へ反映 |

### Realtime / X 内部 API

すべて `Authorization: Bearer <REALTIME_INTERNAL_API_TOKEN>` と HMAC 署名 header（`x-internal-timestamp` / `x-internal-nonce` / `x-internal-signature`）を要求します。検証は共通 helper `enforceInternalAuthorization()`（`src/server/internal-api/authorization.ts`）に集約しており、新規 route もこれを `await` で呼びます。署名の詳細は `docs/system-design/architecture/data-and-security.md` を参照します。

| Method / path | 役割 |
|---|---|
| `POST /api/internal/realtime/register` | Yahoo 検索結果を正規化して Firestore 登録 |
| `POST /api/internal/realtime/prune` | 古いイベントを削除 |
| `POST /api/internal/realtime/verify-post-visibility` | X Post の可視性を検証 |
| `POST /api/internal/x/repost/events` | X API で通常 Repost |
| `POST /api/internal/x/browser-post/events/prepare` | ブラウザ投稿候補を予約 |
| `POST /api/internal/x/browser-post/events/confirm` | ブラウザ投稿結果を反映 |
| `POST /api/internal/x/browser-post/weekend-ticket-summary/prepare` | 週末分の件数と本文材料を返す |
| `POST /api/internal/x/browser-post/trend-joke/prepare` | Yahoo 検索からネタ投稿材料を返す |
| `POST /api/internal/x/browser-post/observation-log/prepare` | 過去7日・向こう7日の件数とタイトル sample、観測コメント、画像 prompt を返す |

## SEO とクロール

| 対象 | 設定 |
|---|---|
| `(main)` | `index=true`、共通 OGP / Twitter card / favicon / manifest |
| ツールページ 9 件（calendar を除く） | `src/lib/seo.ts` の `generateFeatureMetadata(path)` で個別 title / description / canonical / OGP を生成（`features.json` が情報源） |
| `/calendar` | 専用 metadata と `public/img/calendar-ogp.png`（canonical のみ共通ルールに準拠） |
| Shift Search レポート | 一覧は `generatePageMetadata`、詳細は `generateMetadata` でレポート内容から動的生成 |
| `(blank25)` | `index=false`, `follow=true` |
| `(secret)` | `index=false`, `follow=true` |
| `robots.ts` | `/api/` と `/secret/` を disallow |
| `sitemap.ts` | `/`、`features.json` の path、Shift Search レポート（一覧＋言語×文字数の詳細）を列挙 |

sitemap の `lastModified` はビルド日時ではなく実際の更新日時のみ設定する（Shift Search レポートは view manifest の `generatedAt` を使用、ツールページは未設定）。

JSON-LD Article は `generateJsonLdArticle` が `mainEntityOfPage`（ページ自身の URL）、`image`、`publisher` を含めて生成します。

新しい公開ページを追加する場合は `generateFeatureMetadata`（features.json 掲載ツール）または `generatePageMetadata`（その他）で metadata を必ず定義し、`"use client"` が必要なページは calendar / shiritori / dice と同様にクライアント部分を `src/components/` へ分離して page.tsx をサーバーコンポーネントに保つこと。既存の例外はトップページ（`src/app/(main)/page.tsx` 自体が `"use client"` で、metadata は root layout に依存）のみ。
