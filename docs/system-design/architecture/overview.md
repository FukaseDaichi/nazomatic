# 全体アーキテクチャ

## 技術構成

| 領域 | 実装 |
|---|---|
| Web アプリ | Next.js 15.5 App Router、React 19、TypeScript |
| UI | Tailwind CSS、shadcn/ui、Radix UI、lucide-react、framer-motion |
| 3D | three、`@react-three/fiber`、`@react-three/drei` |
| サーバー | Next.js Route Handler、Firebase Admin SDK |
| 外部連携 | Yahoo!リアルタイム検索、GitHub API、X syndication endpoint |
| 生成処理 | Node.js scripts、`artifacts/shift-search/reports`、`src/generated/shift-search` |

`package.json` の依存バージョンと scripts を実行時の正本とします。

## 実行境界

### ブラウザ

- `(main)` の公開ツールは React UI とクライアント内ロジックを中心に動く。
- 辞書は `public/dic/*.dic` を同一 origin から取得する。
- カレンダーと BLANK25 manifest は `/api/*` を経由する。
- BLANK25 のゲーム状態とパーティ得点は `localStorage` に保存する。

### Next.js サーバー

- `src/app/api` が公開 API と内部 API を提供する。
- `src/server` が Firebase Admin、GitHub、Yahoo、X などのサーバー専用処理を持つ。
- 外部サービスの credential はサーバー環境変数だけで読む。

### GitHub Actions

- Realtime 収集、古いイベント削除、Post 可視性検証を定期実行する。
- 定期実行 Actions はサイトの内部 API を Bearer token 付きで呼ぶだけで、処理本体は Route Handler 側に置く。

## 主なディレクトリ

| パス | 責務 |
|---|---|
| `src/app/(main)` | index 対象の公開画面 |
| `src/app/(blank25)` | noindex の BLANK25 画面 |
| `src/app/(secret)` | noindex の隠し画面 |
| `src/app/api` | 公開 API と内部 API |
| `src/components` | UI と機能コンポーネント |
| `src/lib` / `src/class` | ブラウザでも使えるロジックと静的データ |
| `src/server` | サーバー専用外部連携と永続化 |
| `src/types` | API・Firestore データ型 |
| `public` | 辞書、画像、manifest などの静的配信物 |
| `scripts` | Shift Search 生成、内部 API 署名、セキュリティ回帰確認 |
| `artifacts/shift-search/reports` | Shift Search レポート元成果物 |
| `src/generated/shift-search` | Next.js が import する表示用 JSON |

## UI の共通設計

- `(main)` と `(blank25)` は `bg-gradient-to-b from-gray-900 to-gray-800 text-white` を基調とする。
- 主アクセントは `purple-400`。
- 公開ツールは `ArticleHeaderComponent`、PC ヘッダーは `HeaderComponent` を使う。
- text-like input は iOS の自動拡大を避けるため、モバイル時 16px 以上にする。shared `Input` / `Textarea` の既定 `text-sm` はこの条件を満たさないため、利用側で上書きする。

## 公開導線の正本

`src/lib/json/features.json` の配列が次を同時に決めます。

- トップページのカード
- PC ヘッダーのアイコンナビ
- sitemap の公開 URL（Shift Search レポートは view manifest から別途追加）
- 各公開ページの JSON-LD Article 情報
- 各ツールページの metadata（`src/lib/seo.ts` の `generateFeatureMetadata` が title / description / canonical / OGP を生成。calendar のみ専用 metadata）

JSON-LD は各 page が `Article path="/dice"` のように path で参照します。path は `src/lib/features.ts` の `FeaturePath` 型で制約され、typo や削除済み path は compile error になります。`FEATURE_PATHS` は module 読み込み時に `features.json` と突き合わせ、差分があれば例外を投げます。配列順の変更は JSON-LD に影響しません。
