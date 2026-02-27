# BLANK25 設計方針（v0.2 / 2026-02-09）

## 1. 基本方針

- 既存の NAZOMATIC（Next.js App Router / Tailwind / shadcn/ui）に **薄く追加**する。
- ゲーム性の中核は「開封戦略」と「断片情報の統合」なので、UI は極力シンプルに保つ。
- 問題追加は「`public/img/blank25` に画像追加 + `public/data/blank25/problems.json` 追記」だけで完結させる（運用コスト最小化）。

## 2. アーキテクチャ方針

### 2.1 問題マニフェスト（JSON）

- 画像一覧の列挙は行わず、`public/data/blank25/problems.json` を **単一ソース**として扱う。
  - 問題数・表示順・画像ファイル名・リンク表示名・許容回答（表記ゆれ含む）をここで定義する。
  - 問題の追加は「画像追加 + JSON 追記」で完結させる。

### 2.2 UI 構成

- 画面を「問題一覧」と「ゲーム画面」に分離する。
  - `/blank25`: 一覧（`problems.json` の `linkName` を表示）
  - `/blank25/[problemId]`: ゲーム（画像 + 5×5 パネル + 回答判定）
- ルーティングは App Router の dynamic segment を使う。
- 実体 UI は `src/components/blank25/*` に集約する。

### 2.3 状態管理

- v0 は **React local state**（`useState`, `useMemo`）で完結させる。
- 永続化が必要になったら `localStorage` を薄く追加（Zustand 等の導入は v0 では見送る）。

## 3. 重要な設計決定（推奨）

### 3.1 パネル枚数（固定）

- 25 はパネル枚数を表すため、盤面は常に 5×5（25 枚）とする。
- 各問題は「問題画像 1 枚 + その上に 25 パネルを重ねる」構造とする。

### 3.2 回答の正規化（表記ゆれ）

- JSON の `answers` に表記ゆれを複数列挙する前提で、入力側も正規化して比較する。
  - 例: 前後空白の除去、全角/半角の統一、ひらがな/カタカナの統一（`タヌキ` と `たぬき` を同一視）
- 正規化は「入力」「answers」の双方に同一処理を適用し、`Set` 化して比較する。

### 3.3 開封後の挙動

- 開封済みパネルは **戻せない**（スコア制と整合）。
- ただし誤タップ救済が必要なら「直前 1 回だけ取り消し」をオプションで検討。

## 4. UI/UX ポリシー

- モバイル優先（片手操作・大きいボタン・余計な入力を要求しない）。
- 盤面は 5×5 を崩さず、開封済みパネルは「透明・クリック不可」にする（画像が見える状態）。
- 画像上にパネルを重ねるため、レイアウトは `position: relative` + オーバーレイグリッドで実装する。

## 5. ディレクトリ案（実装時）

- `public/data/blank25/problems.json`（問題定義）
- `src/app/(blank25)/blank25/page.tsx`（問題一覧）
- `src/app/(blank25)/blank25/[problemId]/page.tsx`（ゲーム）
- `src/components/blank25/blank25-game.tsx`（盤面 + ステータス）
- `src/components/blank25/problem-list.tsx`（一覧 UI）
- `src/components/blank25/answer-form.tsx`（回答入力/判定）
- `src/components/blank25/types.ts`（Problem, GameState）

## 6. ログ/デバッグ方針

- v0 ではクライアントの `console` は極力増やさない（必要なら `debug` フラグで制御）。
- `problems.json` の読み込みに失敗した場合や `problemId` が不正な場合は、UI 上に簡潔なエラーを出す（真っ白にしない）。
