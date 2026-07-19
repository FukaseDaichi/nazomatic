# 全体アーキテクチャ

## 技術構成

| 領域 | 実装 |
|---|---|
| Web アプリ | Next.js 14 App Router、React 18、TypeScript |
| UI | Tailwind CSS、shadcn/ui、Radix UI、lucide-react、framer-motion |
| 3D | three、`@react-three/fiber`、`@react-three/drei` |
| サーバー | Next.js Route Handler、Firebase Admin SDK |
| 外部連携 | Yahoo!リアルタイム検索、GitHub API、X API、X syndication endpoint |
| ローカル自動化 | Node.js、Playwright、Chrome DevTools Protocol、任意の Codex CLI |
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
- X API 再投稿は workflow_dispatch のみで起動する。
- Actions はサイトの内部 API を Bearer token 付きで呼ぶだけで、処理本体は Route Handler 側に置く。

### ローカル PC

- X ブラウザ投稿 CLI は、ログイン済み専用 Chrome profile と Playwright / CDP を使う。
- Cookie や profile は `local/`、実行ログは `logs/` に置き、Git 管理しない。
- 候補予約や集計は内部 API、X 画面操作と投稿前確認はローカル CLI が担当する。

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
| `scripts` | Shift Search 生成と X ローカル自動化 |
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
- sitemap の公開 URL
- 各公開ページの JSON-LD Article 情報

JSON-LD は各 page が `Article index={n}` をハードコードして参照します。配列順を変える場合は、全 page の index も同時に確認します。
