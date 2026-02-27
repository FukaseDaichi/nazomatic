# BLANK25 設計方針（実装準拠 v0.3 / 2026-02-27）

## 1. 基本方針

- 既存の NAZOMATIC（Next.js App Router / Tailwind / shadcn/ui）に **薄く追加**する。
- ゲーム性の中核は「開封戦略」と「断片情報の統合」なので、UI は極力シンプルに保つ。
- 問題追加は「`public/img/blank25` に画像追加 + `public/data/blank25/problems.json` 追記」で完結させる。

## 2. アーキテクチャ方針

### 2.1 問題マニフェスト（JSON）

- 画像一覧の列挙は行わず、`public/data/blank25/problems.json` を **単一ソース**として扱う。
  - 現行構造は `version` + `categories[]` + `category.problems[]`。
  - 問題数・カテゴリ順・問題順・画像ファイル名・表示名・許容回答をここで定義する。
  - 問題 ID 重複は読み込み時にエラーとする。

### 2.2 UI 構成

- 画面を「問題一覧」と「ゲーム画面」に分離する。
  - `/blank25`: 一覧（カテゴリ + 問題カード）
  - `/blank25/[problemId]`: ゲーム（画像 + 5×5 パネル + 回答判定）
- ルーティングは App Router の dynamic segment を使う。
- 実体 UI は `src/components/blank25/*` に集約する。

### 2.3 状態管理

- UI 状態は **React local state**（`useState`, `useMemo`）で管理する。
- 進行状態は `localStorage` で永続化する。
  - キー: `blank25:v1:<manifestVersion>:<problemId>`
- グローバル状態管理（Zustand 等）は導入しない。

## 3. 重要な設計決定（現行）

### 3.1 パネル枚数（固定）

- 25 はパネル枚数を表すため、盤面は常に 5×5（25 枚）とする。
- 各問題は「問題画像 1 枚 + その上に 25 パネルを重ねる」構造とする。

### 3.2 回答の正規化（表記ゆれ）

- JSON の `answers` に表記ゆれを複数列挙する前提で、入力側も正規化して比較する。
  - 現行正規化: `NFKC`、カナのひらがな統一、`trim`、`toLowerCase`、空白除去
- 正規化は「入力」「answers」の双方に同一処理を適用し、`Set` 比較する。

### 3.3 開封後の挙動

- 開封済みパネルは **戻せない**（スコア制と整合）。
- 正解後は盤面固定とし、未開封パネルは半透明表示に切り替える。

## 4. UI/UX ポリシー

- モバイル優先（片手操作・大きいボタン・余計な入力を要求しない）。
- 盤面は 5×5 を崩さず、開封済みパネルは「透明・クリック不可」にする。
- 画像上にパネルを重ねるため、レイアウトは `position: relative` + オーバーレイグリッドで実装する。
- 正解時はクリアダイアログ + 紙吹雪演出で終了を明示する。

## 5. ディレクトリ（現行）

- `public/data/blank25/problems.json`（問題定義）
- `src/app/(blank25)/blank25/page.tsx`（問題一覧）
- `src/app/(blank25)/blank25/[problemId]/page.tsx`（ゲーム）
- `src/components/blank25/blank25-game.tsx`（盤面 + ステータス）
- `src/components/blank25/problem-list.tsx`（一覧 UI）
- `src/components/blank25/manifest.ts`（マニフェスト取得/検証）
- `src/components/blank25/answer-normalize.ts`（回答正規化）
- `src/components/blank25/clear-dialog.tsx`（クリアダイアログ）
- `src/components/blank25/confetti.ts`（紙吹雪演出）
- `src/components/blank25/types.ts`（Manifest/Problem/PersistedState）

## 6. ログ/デバッグ方針

- v0 ではクライアントの `console` は極力増やさない（必要なら `debug` フラグで制御）。
- `problems.json` の読み込みに失敗した場合や `problemId` が不正な場合は、UI 上に簡潔なエラーを出す（真っ白にしない）。

## 7. スコープ外（明示）

- 作問モードは `sakumon-mode-requirements.md` で別管理し、現行通常モード実装には含めない。
- トップナビへの導線追加（`features.json` 反映）は未実装項目として管理する。
