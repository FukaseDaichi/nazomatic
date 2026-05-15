# BLANK25 設計書

## 位置づけ

この文書は、BLANK25 本体、作問モード、パーティ得点表示、チーム戦ルール説明、Editor、外部 storage 連携をまとめた設計書です。実装の正本は `src/app/(blank25)`、`src/components/blank25`、`src/server/blank25`、関連 API です。

## 概要

BLANK25 は 5 x 5 の 25 パネル画像を使う推理ゲームです。通常プレイではパネルを開けながら答えを推測し、作問モードでは任意の隠しパネル構成を作って出題できます。問題データはアプリ内に持たず、外部の `nazomatic-storage` リポジトリで管理します。

`src/app/(blank25)/layout.tsx` は `robots.index=false` です。検索インデックス対象にはしません。

## ルート

| ルート | 実装 | 役割 |
|---|---|---|
| `/blank25` | `src/app/(blank25)/blank25/page.tsx` | 問題一覧 |
| `/blank25/[problemId]` | `src/app/(blank25)/blank25/[problemId]/page.tsx` | 通常プレイ / 作問モード |
| `/blank25/editor` | `src/app/(blank25)/blank25/editor/page.tsx` | 問題の作成・更新・削除 |
| `/blank25/party` | `src/app/(blank25)/blank25/party/page.tsx` | パーティ得点表示 |
| `/blank25/party/rules` | `src/app/(blank25)/blank25/party/rules/page.tsx` | チーム戦ルール説明 |

## 問題マニフェスト

問題データは `Blank25Manifest` として扱います。

```ts
type Blank25Manifest = {
  version: number;
  categories: Array<{
    id: string;
    name: string;
    description: string;
    color: string;
    problems: Array<{
      id: string;
      linkName: string;
      imageFile: string;
      answers: string[];
    }>;
  }>;
};
```

制約:

- `problem.id` は全カテゴリで一意にする。
- Editor の新規作成 ID は `blank25-001` 形式で採番する。
- 画像は storage repo の `img/{imageFile}` に置く。
- 回答は 1 件以上必要。
- 回答判定ではカナをひらがな化し、空白を除去する。

## storage 連携

| 項目 | 内容 |
|---|---|
| storage repo | `nazomatic-storage` |
| manifest | `problems.json` |
| 画像 | `img/*` |
| 読み込み | `raw.githubusercontent.com` 経由、cache を使わない |
| 書き込み | GitHub Git Trees API で manifest と画像を単一 commit にする |

`NEXT_PUBLIC_BLANK25_STORAGE_RAW_BASE` が未設定の場合、画像 URL は `https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main/img/{imageFile}` になります。

## API 設計

| エンドポイント | 認証 | 役割 |
|---|---|---|
| `GET /api/blank25/manifest` | なし | storage repo の manifest を取得・検証して返す |
| `GET /api/internal/blank25/editor/manifest` | Basic | Editor 用に manifest を取得する |
| `POST /api/internal/blank25/editor/publish` | Basic | 問題の作成・更新・削除を storage repo に反映する |

Editor API は `src/middleware.ts` で Basic 認証されます。mutation method は Origin も確認します。

## Editor の publish モード

| mode | 必須項目 | 挙動 |
|---|---|---|
| `create` | `categoryId`, `linkName`, `answers`, `image` | 新 ID を採番し、画像と manifest を commit |
| `update` | `problemId`, `categoryId`, `linkName`, `answers` | 既存問題を更新。画像がある場合は差し替え |
| `delete` | `problemId` | manifest から問題を削除。既存画像は自動削除しない |

対応画像形式は `image/webp`、`image/png`、`image/jpeg` です。ファイル拡張子は `webp`、`png`、`jpg` に変換します。

## ゲーム状態

通常モードと作問モードは別の `localStorage` key に保存します。

| モード | key |
|---|---|
| 通常プレイ | `blank25:v1:{manifestVersion}:{problemId}` |
| 作問モード | `blank25:sakumon:v1:{manifestVersion}:{problemId}` |

通常モードは開封パネル、開封履歴、開始時刻、解答時刻、正誤、スコアを保持します。作問モードは phase、隠しパネル、ロック時刻、開始時刻、解答時刻、正誤、スコアを保持します。

## パーティ得点表示

`/blank25/party` はチームや個人のスコアをブラウザ内で管理する補助ツールです。

| 項目 | 内容 |
|---|---|
| 実装 | `src/components/blank25/party-scoreboard.tsx` |
| 永続化 | `localStorage` |
| 現行 key | `blank25:party-score:v2:default` |
| 旧 key | `blank25:party-score:v1:default` |
| 主な機能 | 参加者管理、スコア加減算、ログ、ランキング、首位演出、GM タイマー |

## チーム戦ルール説明

`/blank25/party/rules` はチーム戦の説明ページです。実装は `src/components/blank25/team-battle-*` に分かれています。

主な構成:

- ルール説明
- 攻め度メーター
- ラウンド進行
- 全滅リトライシミュレーター
- 説明用 25 パネル盤面

## セキュリティと制約

- `(blank25)` は noindex。
- Editor と Editor API は Basic 認証必須。
- Editor の publish は GitHub ref を `force: true` で更新するため、同時編集の競合検出は行わない。
- 削除・更新で不要になった画像は自動削除しない。
- storage repo は raw URL で配信できる public repo 前提。
