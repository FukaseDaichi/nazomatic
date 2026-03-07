# Firebase 登録 API 設計（ルールベース正規化 / chrono-node 利用）

## 1. 目的
- Yahoo!リアルタイム検索から取得したポストをルールベースで解析し、Firestore（`realtimeEvents` コレクション）へ登録するバックエンド API を実装する。
- LLM には依存せず、`chrono-node` と正規表現／辞書ベースの抽出器で日時・価格・数量などを構造化する。

## 2. API 概要
- **エンドポイント**: `POST /api/internal/realtime/register`
- **認証**: サーバー間トークン（Bearer）または Firebase Authentication のカスタムクレームで限定。
- **リクエストボディ**
  ```jsonc
  {
    "query": "#謎チケ売ります",   // 必須: Yahoo 検索クエリ
    "limit": 50,                  // 任意: 取得件数（既定 20）
    "sinceId": "1834567890",      // 任意: 前回以降の新規ポストのみ取得したい場合
    "dryRun": false               // 任意: true の場合は解析結果のみ返して Firestore 保存しない
  }
  ```
- **レスポンス**
  ```jsonc
  {
    "query": "#謎チケ売ります",
    "processed": 18,
    "inserted": 12,
    "updated": 2,
    "skipped": [
      { "postId": "18345...", "reason": "already_exists" },
      { "postId": "18346...", "reason": "missing_event_time" }
    ],
    "events": [
      {
        "postId": "18345...",
        "eventTime": "2025-11-10T11:00:00Z",
        "confidence": 0.78,
        "needsReview": false
      }
    ]
  }
  ```

## 3. 処理フロー
1. **入力検証**
   - `query` は必須。`limit` は 1〜100、`sinceId` は数字文字列を想定。
   - `dryRun` が true の場合のみ Firestore 書き込みをスキップ。

2. **Yahoo! リアルタイム検索取得**
   - 既存の `fetchYahooRealtime(query, limit, sinceId)` を利用し、HTML→`__NEXT_DATA__`→タイムライン配列を抽出。
   - 取得結果には `postId`, `permalink`, `createdAt`, `user`, `displayText`, `hashtags` を含める。

3. **正規化（Rule Engine）**
   - 以下のステップをポスト単位で実施。疑似コード:
     ```ts
     import { parseDate } from "@/server/realtime/chrono";
     import { extractPrice, extractQuantity, extractCategory, extractLocation } from "@/server/realtime/rules";

     function normalizePost(post: RawPost, capturedAt: Date): NormalizedEvent | null {
       const dateResult = parseDate(post.displayText, { referenceDate: post.createdAt ?? capturedAt });
       if (!dateResult) return { ...baseFields, eventTime: null, eventDateResolution: "unresolved", needsReview: true };

       const price = extractPrice(post.displayText);
       const quantity = extractQuantity(post.displayText);
       const location = extractLocation(post.displayText);
       const category = extractCategory(post.displayText);

       const confidence = scoreConfidence({ dateResult, price, quantity, location, category });

       return {
         postId: post.id,
         postURL: post.permalink,
         hashtags: post.hashtags,
         createdAt: post.createdAt,
         authorId: post.user.id,
         authorName: post.user.name,
         authorImageUrl: post.user.profileImage,
         rawPostText: post.displayText,
         eventTime: dateResult.date,
         eventDateResolution: dateResult.resolution, // "exact" | "date_only" | "inferred"
         ticketTitle: dateResult.context?.title ?? null,
         category,
         price,
         quantity,
         deliveryMethod: extractDelivery(post.displayText),
         location,
         sourceQuery: query,
         capturedAt,
         normalizationEngine: "ruleset-v2025-11",
         confidence,
         notes: dateResult.notes,
         needsReview: confidence < 0.6 || !dateResult.hasTime,
         reviewStatus: "pending"
       };
     }
     ```

   - **日時解析 (`chrono-node`)**
     - 日本語ロケールを有効化 (`require("chrono-node").ja`)。
     - リファレンス日時: `post.createdAt`（UTC）を基準。欠落時は `capturedAt`。
     - 複数日時が抽出された場合、キーワード優先度で選択。
     - 時刻が存在しない場合は `eventDateResolution="date_only"` とし、`eventTime` には 12:00 固定で保存しつつ、後段で UI 側が特別表示。

   - **価格抽出**
     - パターン: `/([0-9]{1,3}(,[0-9]{3})*|[0-9]+)(円|yen)/i`、`/([0-9]+)k/` など。
     - 文字列から金額を数値化し、`perUnit` を `ticket` で固定。

   - **数量抽出**
     - パターン: `/([0-9]+)枚/`, `/ペア/`（⇒ 2枚と解釈）など。正規化後は数値で保持。

   - **カテゴリ分類**
     - `sellKeywords = ["譲ります", "お譲り"]`
     - `buyKeywords = ["探してます", "譲ってください"]`
     - `exchangeKeywords = ["交換"]`
     - 複数一致時は優先度ルール (`exchange > sell > buy`)。

   - **ロケーション解析**
     - 地名辞書を `Set` 化して高速検索。ヒットした最初の地名を採用。
     - 位置情報が曖昧な場合は `notes` に候補を保存。

   - **信頼度計算**
     - `score = (dateScore + priceScore + quantityScore + locationScore + categoryScore) / 5`
     - 各スコアは `0 | 0.33 | 0.66 | 1` の段階評価。`needsReview = score < 0.6`.

4. **Firestore 書き込み**
   - `dryRun` false の場合のみ実行。
   - 既存ドキュメント判定は `postId` で実施。存在すればフィールド更新、なければ新規追加。
   - バッチ書き込み（`WriteBatch`）で 500 件単位にコミット。
   - 書き込み前に `eventTime` が `null` のイベントは `skipped`（理由 `missing_event_time`）に計上し、Firestore へは保存しない。レビュー対象にしたい場合は別キューで管理。

5. **レスポンス構築**
   - 実際に書き込んだ件数・スキップ理由を集計。
   - `events` 配列には保存対象となったイベントのみを含める（`eventTime` は常に ISO8601 文字列）。
   - `dryRun=true` の場合は `inserted`/`updated` を 0 とし、保存予定イベントのみを返却。

## 4. Firestore / Cloud Functions 実装イメージ
```ts
// src/app/api/internal/realtime/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchYahooRealtime } from "@/server/realtime/fetchYahooRealtime";
import { normalizePost } from "@/server/realtime/rules/normalizePost";
import { firestore } from "@/server/firebase/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, limit = 20, sinceId, dryRun = false } = validate(body);

  const capturedAt = new Date();
  const rawPosts = await fetchYahooRealtime({ query, limit, sinceId });

  const events = [];
  const skipped = [];
  const batch = firestore.batch();

  for (const raw of rawPosts) {
    const normalized = normalizePost(raw, capturedAt, query);
    if (!normalized || !normalized.eventTime) {
      skipped.push({ postId: raw.id, reason: "no_event_time" });
      continue;
    }

    events.push({
      postId: normalized.postId,
      eventTime: normalized.eventTime,
      confidence: normalized.confidence,
      needsReview: normalized.needsReview
    });

    if (dryRun) continue;

    const ref = firestore.collection("realtimeEvents").doc(`${normalized.postId}:ruleset-v2025-11`);
    batch.set(ref, normalized, { merge: true });
  }

  if (!dryRun && events.length > 0) {
    await batch.commit();
  }

  return NextResponse.json({
    query,
    processed: rawPosts.length,
    inserted: dryRun ? 0 : events.length,
    updated: 0, // 実装では既存判定して更新件数をカウント
    skipped,
    events
  });
}
```
- `normalizePost` は `chrono-node` ベースの日付抽出、正規表現抽出、スコアリングをまとめたユーティリティ。
- 既存ドキュメントとの比較により `inserted` / `updated` を分岐させる処理を追加する。

## 5. テスト戦略
- **ユニットテスト**
  - `parseDate` ユーティリティ: 「11/10(月)20時」「明日夜」「本日昼」「11月上旬」などのケースをカバー。
  - `extractPrice`/`extractQuantity`: 価格表記（半角/全角、カンマ区切り、k 表記）をテスト。
  - `normalizePost`: 正常系と `needsReview` になるケース、ロケーション曖昧ケース。
- **インテグレーションテスト**
  - Next.js Route に対する `supertest` で `POST /api/internal/realtime/register` を呼び出し、Firestore Emulator を利用して書き込み結果を検証。
- **シミュレーション**
  - スクリプトで過去 7 日間のサンプルを処理し、`confidence` 分布とレビュー必要件数を確認。

## 6. 運用ポイント
- ルールセット JSON を `src/server/realtime/rulesets/v2025-11.json` のように管理し、変更時はバージョンを increment。
- `chrono-node` はタイムゾーンの扱いに注意。基準は UTC で保存し、JST はフロントで変換。
- Firestore への書き込み量に応じてバッチサイズを調整（1 回のバッチ最大 500 件）。
- 失敗したポストは `skipped` と同時に Pub/Sub `realtimeEvents.review` に publish し、手動確認キューとして残せるようにする。
