# BLANK25 設計方針（実装準拠 v1.0 / 2026-03-03）

## 1. 基本方針

- 既存の NAZOMATIC（Next.js App Router / Tailwind / shadcn/ui）へ薄く追加する。
- ゲーム体験の中心は「見える情報量の制御」と「回答推理」に置く。
- 問題データは `public/data/blank25/problems.json` を単一ソースとする。

## 2. デザイン方針

```md
# ルール
- メインデザイン`bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセント`purple-400`
```

- 通常モードは `purple` 系を主要アクセントに使用。
- 作問モードは `emerald` 系で状態差を明確化。
- 情報密度が高い箇所でもタップ領域を確保する（モバイル優先）。

## 3. アーキテクチャ方針

### 3.1 問題マニフェスト

- `public/data/blank25/problems.json` を参照し、カテゴリ階層をそのまま UI に反映する。
- 問題 ID は全カテゴリで一意とし、読み込み時に重複を検出する。

### 3.2 画面分離

- `/blank25`: 問題一覧
- `/blank25/[problemId]`: プレイ画面（通常 / 作問モード）
- `/blank25/editor`: 管理画面（Basic 認証）

### 3.3 状態管理

- UI 状態は React local state（`useState`, `useMemo`, `useCallback`）を使用。
- 進行状態は localStorage に永続化。
  - 通常: `blank25:v1:<manifestVersion>:<problemId>`
  - 作問: `blank25:sakumon:v1:<manifestVersion>:<problemId>`

## 4. 重要な設計決定

### 4.1 盤面固定

- 盤面は常に 5x5（25 枚）固定。
- 画像 1 枚に対してオーバーレイパネルを重ねる。

### 4.2 回答正規化

- 入力と `answers` に同一の正規化ロジックを適用して判定。
- `NFKC`、かな統一、空白除去、小文字化を行う。

### 4.3 Editor 反映フロー

- Editor API は GitHub API 経由で `problems.json` と画像を同一コミットで反映。
- `baseManifestSha` と fast-forward 失敗の両面で競合検知を行う。

## 5. 主要ディレクトリ

- `public/data/blank25/problems.json`
- `public/img/blank25/*`
- `src/app/(blank25)/blank25/page.tsx`
- `src/app/(blank25)/blank25/[problemId]/page.tsx`
- `src/app/(blank25)/blank25/editor/page.tsx`
- `src/app/api/internal/blank25/editor/manifest/route.ts`
- `src/app/api/internal/blank25/editor/publish/route.ts`
- `src/components/blank25/*`
- `src/server/blank25/*`

## 6. 運用方針

- 問題追加・更新は原則 Editor から実施する。
- 既存データの互換性（`problemId` / localStorage キー）を壊さない。
- `robots.index=false` を維持し、BLANK25 領域は検索流入を抑制する。
