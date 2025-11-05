# Firestore チケット販売イベント スキーマ

## 1. コレクション構成

- `realtimeEvents`: 正規化済みのチケット販売イベントを格納。
- ドキュメント ID: `postId:normalization` 形式（例 `1834567890123456789`）
- `rawPosts`: スクレイピング直後の生データ（監査・再処理用）。
- `authorProfiles`: 信頼度やブラックリスト判定に利用する投稿者メタ情報。

## 2. フィールド一覧（`realtimeEvents`）

| フィールド名     | 型                  | 必須 | 説明                                                                                           |
| ---------------- | ------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `postId`         | string              | ✅   | Yahoo!リアルタイム検索（X/Twitter）ポストの ID。                                               |
| `postURL`        | string              | ✅   | ポストのパーマリンク。例 `https://x.com/.../status/...`。                                      |
| `hashtags`       | string[]            | ✅   | ポスト本文から抽出したハッシュタグ。                                                           |
| `createdAt`      | Firestore Timestamp | ✅   | ポストが公開された日時（UTC）。                                                                |
| `authorId`       | string              | ✅   | 投稿者の X ユーザー ID。                                                                       |
| `authorName`     | string              | ✅   | 投稿者表示名。                                                                                 |
| `authorImageUr`  | string              | ✅   | 投稿者アイコン URL。プロジェクト既存命名に合わせて末尾 `l` を省いた表記。                      |
| `rawPostText`    | string              | ✅   | スクレイピング時点の本文全文。                                                                 |
| `title`          | string              | ✅   | 画面に表示するタイトル。イベント名等                                                           |
| `eventTime`      | Firestore Timestamp | ✅   | 正規化で特定した取引（販売/譲渡）日時。未確定の場合は `null` を許容し `needsReview` と紐付け。 |
| `ticketTitle`    | string              | 任意 | 公演名・チケット種別。                                                                         |
| `category`       | string              | ✅   | `sell` / `buy` / `exchange` / `unknown`。                                                      |
| `price`          | string              | 任意 | 金額。9,000 円等                                                                               |
| `quantity`       | number              | 任意 | チケット枚数。                                                                                 |
| `deliveryMethod` | string              | 任意 | 例: `現地手渡し`, `電子チケット`。                                                             |
| `location`       | string              | 任意 | 取引場所。                                                                                     |
| `sourceQuery`    | string              | ✅   | スクレイピングに用いた検索クエリ（例 `#謎チケ売ります`）。                                     |
| `capturedAt`     | Firestore Timestamp | ✅   | スクレイピング実施日時。                                                                       |
| `notes`          | string              | 任意 | 補足やレビューコメント。                                                                       |
