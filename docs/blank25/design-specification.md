# BLANK25 設計書（実装準拠 / 2026-03-07）

## 1. 目的

- NAZOMATIC 内で 5x5 盤面の画像推理ゲーム BLANK25 を提供する。
- 問題データは `nazomatic-storage` の `problems.json` を単一ソースとする。
- 通常プレイと作問モードを同じ画面基盤で扱う。

## 2. UI 設計

```md
# ルール
- メインデザイン`bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセント`purple-400`
```

- 通常モードは `purple` 系を主要アクセントに使用する。
- 作問モードは `emerald` 系で状態差を明確化する。
- 情報密度が高い箇所でもタップ領域を確保し、モバイル優先で設計する。

## 3. アーキテクチャ設計

### 3.1 問題マニフェスト

- `GET /api/blank25/manifest` 経由で `nazomatic-storage` の `problems.json` を取得する。
- カテゴリ階層をそのまま UI に反映する。
- 問題 ID は全カテゴリで一意とし、読み込み時に重複を検出する。

### 3.2 画面分離

- `/blank25`: 問題一覧
- `/blank25/[problemId]`: プレイ画面（通常 / 作問モード）
- `/blank25/editor`: 管理画面（Basic 認証）

### 3.3 状態管理

- UI 状態は React local state を使う。
- 進行状態は localStorage に永続化する。
  - 通常: `blank25:v1:<manifestVersion>:<problemId>`
  - 作問: `blank25:sakumon:v1:<manifestVersion>:<problemId>`

## 4. 主要設計決定

### 4.1 盤面

- 盤面は常に 5x5 固定とする。
- 画像 1 枚に対してオーバーレイパネルを重ねる。

### 4.2 回答判定

- 入力と `answers` に同一の正規化ロジックを適用して判定する。
- `NFKC`、かな統一、空白除去、小文字化を行う。
- Editor 側の回答保存では trim 後の完全一致で重複排除する。

### 4.3 Editor 反映

- Editor API は `nazomatic-storage` に対して `problems.json` と画像を同一コミットで反映する。
- `force: true` で branch を更新し、競合検知は行わない。
- publish レスポンスに更新後の `manifest` を含め、Editor は再取得なしで UI を更新する。

## 5. 実装境界

- 主要画面:
  - `src/app/(blank25)/blank25/page.tsx`
  - `src/app/(blank25)/blank25/[problemId]/page.tsx`
  - `src/app/(blank25)/blank25/editor/page.tsx`
- API:
  - `src/app/api/blank25/manifest/route.ts`
  - `src/app/api/internal/blank25/editor/manifest/route.ts`
  - `src/app/api/internal/blank25/editor/publish/route.ts`
- コンポーネント / サーバー処理:
  - `src/components/blank25/*`
  - `src/server/blank25/*`

## 6. 運用設計

- 問題追加・更新は原則 Editor から実施する。
- `problemId` と localStorage キーの互換性を壊さない。
- `robots.index=false` を維持し、BLANK25 領域は検索流入を抑制する。
