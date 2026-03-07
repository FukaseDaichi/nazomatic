# 謎チケカレンダー 削除済み Post 非表示化 実装計画（2026-03-08案）

## 1. 目的

- 謎チケカレンダーで、すでに削除された X Post が Firestore に残り続け、`/calendar` に表示され続ける問題を解消する。
- X syndication の `tweet-result` を使って Post の存在を定期確認し、削除済みと判定できたものはカレンダー上で非表示にする。
- Firestore のドキュメント自体は監査用に残し、表示可否だけを切り替える。

## 2. 現状整理

- `POST /api/internal/realtime/register` は Yahoo リアルタイム検索結果を `realtimeEvents` に登録するが、登録後に Post の生存確認はしていない。
- `GET /api/calendar` は `sourceQuery` と `eventTime` だけで取得しており、削除済み Post を除外する条件がない。
- `POST /api/internal/realtime/prune` は `eventTime < now - 1 day` を削除するだけなので、未来日のイベントに紐づく削除済み Post は残り続ける。
- 現行 workflow は 1 時間ごとに 3 本の register を回しており、上限ベースでは `20件 x 3本 x 24時間 = 1,440件/日` の新規流入がありうる。

## 3. 推奨方針

- 新規の内部 API `POST /api/internal/realtime/verify-post-visibility` を追加し、syndication を使った存在確認バッチを実装する。
- 判定単位は Firestore の doc ID ではなく `postId` にする。
- 1 回のバッチで「due になった Post だけ」を少量ずつ確認する増分方式にする。
- 削除判定時は doc を消さず、`isVisible=false` などのフラグを立てる。
- `/api/calendar` と `/api/internal/x/repost/events` は `isVisible=true` だけを対象にする。

## 4. 判定ポリシー

syndication の返り値は次で扱う。

- `__typename === "Tweet"`: `available`
- `__typename === "TweetTombstone"`: `deleted`
- 上記以外、HTTP 非 2xx、JSON 解析失敗、タイムアウト: `unknown`

初期運用では、**自動非表示は `deleted` のみ**を推奨する。

- 理由: syndication は非公式エンドポイントであり、一時的な失敗や仕様変化で `unknown` が出る可能性があるため。
- どうしても「結果がなければ隠す」を強く適用したい場合は、`unknown` が 3 回以上連続した Post だけ非表示にする二段階運用にする。

## 5. Firestore 追加フィールド案

`realtimeEvents` に以下を追加する。

| フィールド | 型 | 初期値 | 用途 |
| --- | --- | --- | --- |
| `isVisible` | boolean | `true` | カレンダーや repost 候補に出すかどうか |
| `hiddenReason` | string \| null | `null` | `syndication_deleted` など |
| `hiddenAt` | Timestamp \| null | `null` | 非表示化した時刻 |
| `syndicationStatus` | string | `pending` | `pending` / `available` / `deleted` / `unknown` |
| `syndicationCheckedAt` | Timestamp \| null | `null` | 最終確認時刻 |
| `syndicationNextCheckAt` | Timestamp \| null | `capturedAt + 6h` | 次回確認予定時刻 |
| `syndicationErrorCount` | number | `0` | `unknown` 連続回数の管理 |

補足:

- `register` 時に初期値を埋める。
- 同じ `postId` が ruleset 違いで複数 doc に存在しても、存在確認結果は同じなので一括更新する。
- 削除済みになった doc は `syndicationNextCheckAt = null` にして再確認対象から外す。

## 6. サーバー実装方針

### 6.1 共通 helper

新規 helper 例:

- `src/server/realtime/syndication/verifyPost.ts`

責務:

- `getToken(id)` を実装する
- `https://cdn.syndication.twimg.com/tweet-result?id=...&lang=ja&token=...` を取得する
- `available` / `deleted` / `unknown` に正規化する
- タイムアウトと例外ハンドリングを持つ

### 6.2 register API

対象:

- `src/app/api/internal/realtime/register/route.ts`

変更内容:

- Firestore 書き込み時に `isVisible=true` などの初期値を追加する
- 初回チェックを少し遅らせるため、`syndicationNextCheckAt = capturedAt + 6時間` を推奨する

### 6.3 visibility verify API

対象:

- `src/app/api/internal/realtime/verify-post-visibility/route.ts` を新設

想定リクエスト:

```json
{
  "batchSize": 100,
  "maxConcurrency": 5,
  "dryRun": false
}
```

想定処理:

1. Bearer 認証を検証する
2. `isVisible == true` かつ `syndicationNextCheckAt <= now` の doc を `limit(batchSize)` で取る
3. `postId` で重複排除する
4. syndication を `maxConcurrency=5` 程度で並列確認する
5. 結果に応じて同一 `postId` の doc をまとめて更新する

更新ルール:

- `available`
  - `syndicationStatus = "available"`
  - `syndicationCheckedAt = now`
  - `syndicationErrorCount = 0`
  - `syndicationNextCheckAt = 次回時刻`
- `deleted`
  - `syndicationStatus = "deleted"`
  - `isVisible = false`
  - `hiddenReason = "syndication_deleted"`
  - `hiddenAt = now`
  - `syndicationCheckedAt = now`
  - `syndicationNextCheckAt = null`
- `unknown`
  - `syndicationStatus = "unknown"`
  - `syndicationCheckedAt = now`
  - `syndicationErrorCount += 1`
  - `syndicationNextCheckAt = backoff 後`
  - `isVisible` は維持する

推奨レスポンス:

```json
{
  "dryRun": false,
  "processedPostIds": 87,
  "available": 82,
  "deleted": 3,
  "unknown": 2,
  "updatedDocs": 90
}
```

### 6.4 calendar API

対象:

- `src/app/api/calendar/route.ts`

変更内容:

- Firestore query に `where("isVisible", "==", true)` を追加する
- これにより UI 側は変更なしでも削除済み Post が見えなくなる

### 6.5 x repost API

対象:

- `src/app/api/internal/x/repost/events/route.ts`

変更内容:

- repost 候補選定にも `isVisible == true` を追加する
- すでに削除された Post を repost 対象に拾わないようにする

## 7. 次回チェック時刻の決め方

全件を毎回確認しないため、`syndicationNextCheckAt` を使って再確認頻度を分ける。

| 条件 | 次回チェック |
| --- | --- |
| 新規登録直後 | `capturedAt + 6h` |
| `eventTime` まで 3 日以内 | `12h` 後 |
| `eventTime` まで 4〜14 日 | `24h` 後 |
| `eventTime` まで 15 日以上 | `72h` 後 |
| `unknown` 発生 | `6h` 後、以後は `12h -> 24h` と backoff |

これで、近い日程のイベントは厚めに、遠い日程のイベントは薄めに確認できる。

## 8. GitHub Actions 運用案

新規 workflow:

- `.github/workflows/realtime-verify-post-visibility.yml`

推奨 schedule:

- `45 * * * *`

理由:

- 既存 register が `0分`, `15分`, `30分` に走るので、`45分` に寄せると運用上わかりやすい
- 1 時間ごとに due 分だけ処理すれば、長い 1 回の全件バッチを避けられる

想定 payload:

```json
{
  "batchSize": 100,
  "maxConcurrency": 5,
  "dryRun": false
}
```

workflow 方針:

- 既存と同じ `REALTIME_API_BASE_URL`, `REALTIME_API_TOKEN` を使う
- `workflow_dispatch` を残し、初回 backfill や dry run を手動実行できるようにする
- timeout は既存に合わせて 10 分で十分

## 9. 「全部のツイートを調べると重い」への回答

結論:

- **毎回フルスキャン前提にはしない方がよい**
- ただし、現行規模なら「限定バッチを毎時回す」設計で十分まかなえる可能性が高い

根拠:

- 現行の register workflow の理論上限は `1,440件/日`
- verify を毎時 `100件` 回すだけで `2,400件/日` を確認できる
- さらに `eventTime` が遠いものは `24h〜72h` ごとに確認すればよいので、実運用ではこの上限より軽くなる
- `postId` 単位で重複排除すれば、ruleset 更新で doc が増えても API コール数は抑えられる

したがって、初回 backfill を除けば「GitHub Actions の定期バッチで十分回る」見込みが高い。  
ただし syndication の応答速度や制限は読みにくいため、**正しさを全件完走に依存しない増分方式**にしておくのが安全。

## 10. 初回導入手順

1. helper と Firestore 追加フィールドを実装する
2. `register`, `calendar`, `x-repost` に visibility 条件を組み込む
3. `verify-post-visibility` API を `dryRun=true` で手動検証する
4. GitHub Actions を `workflow_dispatch` で数回回し、処理件数と応答時間を確認する
5. 問題なければ定期 schedule を有効化する
6. 初回 backlog が多い場合だけ `batchSize` を増やした手動実行を複数回行う

## 11. 必要なインデックス案

Firestore では少なくとも以下の複合インデックス追加を想定する。

- `realtimeEvents`: `sourceQuery asc`, `isVisible asc`, `eventTime asc`
- `realtimeEvents`: `isVisible asc`, `syndicationNextCheckAt asc`
- `realtimeEvents`: `hashtags array-contains`, `isVisible asc`, `lastReviewedAt asc`, `capturedAt desc`

実際の index 定義は Firestore のエラーメッセージに合わせて微調整する。

## 12. 受け入れ条件

- syndication で `TweetTombstone` になった Post は次回 `/api/calendar` 取得結果から消える
- `unknown` の一時失敗だけでは即座に非表示にならない
- `x-repost-events` が削除済み Post を候補にしない
- 1 回の verify バッチが GitHub Actions の timeout 内で完了する
- 既存 UI の見た目を変えずに、削除済み Post の残留問題を解消できる

