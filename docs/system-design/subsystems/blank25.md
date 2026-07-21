# BLANK25

## 概要

BLANK25 は 5 × 5 の画像パネルを開きながら答えを推測するゲームです。通常プレイ、作問モード、パーティ得点表示、チーム戦ルール、問題 Editor を持ちます。`(blank25)` 全体は noindex です。

## 問題データ

問題の正本は外部 public repository `nazomatic-storage` です。

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

- manifest は `problems.json`、画像は `img/*`。
- problem id は全カテゴリで一意。
- Editor の自動採番は `blank25-001` 形式。
- 回答は 1 件以上で、判定時はカナをひらがな化して空白を除く。
- 公開 manifest API と Editor manifest API は raw GitHub を `no-store` で読む。

## Editor 書き込み

`POST /api/internal/blank25/editor/publish` は manifest と必要な画像を GitHub Git Trees API で単一 commit にします。

| mode | 入力 | 処理 |
|---|---|---|
| `create` | category、linkName、answers、image | 新 id と画像名を採番して追加 |
| `update` | problemId、category、linkName、answers、任意 image | manifest を更新し、画像指定時は差し替え |
| `delete` | problemId | manifest から削除 |

画像は WebP、PNG、JPEG を受け、拡張子を `webp`、`png`、`jpg` に正規化します。更新前画像や削除対象画像は repository から自動削除しません。

branch ref は新 commit へ `force: true` で更新します。同時編集の競合検出はありません。

## 認証

`src/middleware.ts` が `/blank25/editor/:path*` と `/api/internal/blank25/editor/:path*` を Basic 認証します。mutation method では、Origin header がある場合だけ request origin と一致することを確認します。

## ゲーム状態

通常プレイと作問モードは別 key で `localStorage` に保存します。manifest version を key に含めるため、manifest version が変わると別状態として扱われます。

通常プレイは開封パネル、履歴、開始・回答時刻、正誤、score を持ちます。作問モードは phase、隠しパネル、lock・開始・回答時刻、正誤、score を持ちます。

## パーティ得点

`party-scoreboard.tsx` が参加者、score 加減算、log、ranking、首位演出、GM timer をブラウザ内で管理します。現行 key は `blank25:party-score:v2:default` で、旧 v1 key から読み替えます。

## 配信 URL

画像 URL は `NEXT_PUBLIC_BLANK25_STORAGE_RAW_BASE` を基点にします。未設定時は `https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main` です。Next.js Image は `raw.githubusercontent.com/**` を許可します。
