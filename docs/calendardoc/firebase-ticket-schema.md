# Firestore チケット販売イベント スキーマ（ルールベース版）

## 1. コレクション構成
- `realtimeEvents`: 正規化済みチケット販売イベントの保存先。  
  ドキュメント ID は `postId:ruleset-vYYYY-MM` （例 `1834567890123456789:ruleset-v2025-11`）で、ルール更新ごとにバージョンを付与。
- `rawPosts`（任意）: スクレイピング直後の生データを保持する監査用コレクション。
- `authorProfiles`（任意）: 投稿者ごとの信頼度管理やブラックリスト化に利用。

## 2. フィールド一覧（`realtimeEvents`）

| フィールド名              | 型                          | 必須 | 説明                                                                                                    |
| ------------------------- | --------------------------- | ---- | ------------------------------------------------------------------------------------------------------- |
| `postId`                  | string                      | ✅   | Yahoo!リアルタイム検索（X/Twitter）ポストの ID。                                                         |
| `postURL`                 | string                      | ✅   | ポストのパーマリンク。例 `https://x.com/.../status/...`。                                                 |
| `hashtags`                | string[]                    | ✅   | ポスト本文から抽出したハッシュタグ。                                                                    |
| `createdAt`               | Firestore Timestamp         | ✅   | ポスト公開日時（UTC）。Yahoo 側の Unix 秒を ISO8601 → Timestamp に変換。                                 |
| `authorId`                | string                      | ✅   | 投稿者の X ユーザー ID。                                                                                |
| `authorName`              | string                      | ✅   | 投稿者表示名。スクリーンネームの fallback を許容。                                                      |
| `authorImageUrl`          | string \| null              | ✅   | 投稿者アイコン URL。                                                                                    |
| `rawPostText`             | string                      | ✅   | 抽出時の本文全文（正規化根拠の保持用）。                                                                |
| `eventTime`               | Firestore Timestamp         | ✅   | 取引日時。抽出できないポストは `missing_event_time` として登録対象外。                                  |
| `eventDateResolution`     | string                      | ✅   | `exact` / `date_only` / `inferred` / `unresolved`。`chrono-node` の確度で判定。                           |
| `ticketTitle`             | string \| null              | 任意 | 公演名・チケット種別。ハッシュタグや本文からの推定。                                                     |
| `category`                | string                      | ✅   | `sell` / `buy` / `exchange` / `unknown`。                                                               |
| `price`                   | object \| null              | 任意 | `{ amount: number, currency: "JPY", perUnit?: "ticket" | "pair" }`。抽出不可の場合は `null`。             |
| `quantity`                | number \| null              | 任意 | チケット枚数。`枚`／`ペア` 判定を数値化。                                                                |
| `deliveryMethod`          | string \| null              | 任意 | 受け渡し方法（例: `現地手渡し`, `電子チケット`）。                                                       |
| `location`                | string \| null              | 任意 | 取引場所推定。地名辞書で抽出した最有力候補。                                                            |
| `sourceQuery`             | string                      | ✅   | スクレイピングに用いた検索クエリ（例 `#謎チケ売ります`）。                                               |
| `capturedAt`              | Firestore Timestamp         | ✅   | スクレイピング実行日時。                                                                                |
| `normalizationEngine`     | string                      | ✅   | 適用したルールバージョン（例 `ruleset-v2025-11`）。                                                     |
| `confidence`              | number                      | ✅   | 0.0〜1.0。日時・価格・数量などの抽出結果から計算。                                                      |
| `notes`                   | string \| null              | 任意 | 抽出根拠（マッチしたテキスト等）や補足。                                                                |
| `needsReview`             | boolean                     | ✅   | 手動レビューが必要か。`confidence < 0.6` など低信頼な抽出結果で `true`。                              |
| `reviewStatus`            | string                      | ✅   | `pending` / `approved` / `rejected`。                                                                   |
| `lastReviewedAt`          | Firestore Timestamp \| null | 任意 | レビュー最終日時。                                                                                      |
| `diagnostics`（オプション） | map                        | 任意 | 開発・監視用。`matchedDateText`, `matchedPriceText` などを格納する場合に利用。                           |

### Firestore 型メモ
- サーバーコードでは `Date` を渡しているため、Firestore SDK が自動的に `Timestamp` へ変換する。
- `price` のようなネストオブジェクトは `map` 型で保存される。
- `null` を許容するフィールドは Firestore でも `null` 値を許可する設定にしておく。

## 3. インデックス案
- 単一フィールド：`eventTime`、`sourceQuery`、`needsReview`、`confidence`。
- 複合インデックス例：
  - `sourceQuery` + `eventTime`（昇順） … カレンダービュー用。
  - `needsReview` + `confidence` … レビュー待ちの優先順位付け。
  - `category` + `eventTime`（降順） … 売り/買い別の最新投稿抽出。

## 4. ドキュメント例

```jsonc
{
  "postId": "1834567890123456789",
  "postURL": "https://x.com/sampleuser/status/1834567890123456789",
  "hashtags": ["#謎チケ売ります", "#譲渡"],
  "createdAt": "2025-11-04T12:30:05Z",
  "authorId": "1234567",
  "authorName": "サンプル太郎",
  "authorImageUrl": "https://pbs.twimg.com/profile_images/.../sample.jpg",
  "rawPostText": "11/10(月)20時 開演の〇〇ライブチケット2枚お譲りします。渋谷駅で手渡し、1枚6500円、DMください。",
  "eventTime": "2025-11-10T11:00:00Z",
  "eventDateResolution": "exact",
  "ticketTitle": "〇〇ライブ",
  "category": "sell",
  "price": { "amount": 6500, "currency": "JPY", "perUnit": "ticket" },
  "quantity": 2,
  "deliveryMethod": "現地手渡し",
  "location": "渋谷駅",
  "sourceQuery": "#謎チケ売ります",
  "capturedAt": "2025-11-05T00:30:10Z",
  "normalizationEngine": "ruleset-v2025-11",
  "confidence": 0.82,
  "notes": "matched=\"11/10(月)20時\" | price=\"6500円\" | location=\"渋谷駅\"",
  "needsReview": false,
  "reviewStatus": "approved",
  "lastReviewedAt": "2025-11-05T02:00:00Z"
}
```

## 5. 拡張ポイント
- `attachments` サブコレクションで画像・動画 URL を保持。
- `alerts` コレクションで違反・重複検知を追跡。
- `postHashes` フィールドで本文ハッシュを記録し、重複投稿を除外。
- `diagnostics` を有効化して抽出ログを保存し、ルール改善に活用。

## 6. セキュリティ／運用留意点
- 認証済みの管理者ロールのみ書き込みを許可し、閲覧ロールは `needsReview=false` かつ `confidence` が閾値以上のドキュメントに制限。
- `rawPostText` には個人情報が含まれる可能性があるため、外部公開 API では部分マスクを検討。
- 正規化ルール更新時は `normalizationEngine` のバージョンを increment。既存データの再正規化が必要なら Cloud Functions などで一括処理。
- `authorImageUr` など旧フィールドが既存データに残る場合はマイグレーションを行い、すべて `authorImageUrl` に統一する。
