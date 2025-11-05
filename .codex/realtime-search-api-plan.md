# Yahoo!リアルタイム検索ポスト → チケット販売カレンダー化 設計方針

## 1. 目的とスコープ

- `https://search.yahoo.co.jp/realtime/search` から取得できるチケット売買関連ポストを収集・正規化し、「いつ・どこで・何のチケットが販売／譲渡されるか」をカレンダービューで提示できるバックエンド＆管理フローを整える。
- 想定対象: ハッシュタグ（例 `#謎チケ売ります`）やキーワードを複数持つコミュニティ向け。初期は特定ワード群にフォーカスし、将来的に拡張可能な設計とする。
- スコープ: スクレイピング〜正規化〜データ保存〜API 提供〜UI 連携までのシステム構成案。Yahoo! JAPAN の利用規約・robots.txt が許容する範囲での運用を大前提とし、アクセス頻度やキャッシュ戦略を慎重に設定する。

## 2. 想定ユースケース

- オペレーターが指定した検索クエリごとに販売スケジュール（日時・枚数・価格など）を一覧化したい。
- カレンダー形式の画面で日付軸に「販売開始時間」「取引場所」「取引種別」を重畳表示し、異常（重複出品や怪しいポスト）を発見したい。
- 定期バッチまたはオンデマンドで最新データを取得し、Slack/メール等に通知する二次利用を想定。

## 3. 全体アーキテクチャ概要

- **データ取得レイヤー**: 定期ジョブ（Cron/Cloud Scheduler）→ スクレイパー（Node.js/Next.js サーバー側 or Cloud Functions）で Yahoo! リアルタイム検索結果 HTML を取得。
- **パース＆正規化レイヤー**: HTML から `__NEXT_DATA__` を抽出 → タイムライン配列を解析 → ルールベース抽出（`chrono-node` など）で「イベント（販売情報）」に変換。
- **ストレージレイヤー**: 正規化済みイベントを永続化（Firestore）。時間軸検索・全文検索に対応するため補助インデックスを考慮。
- **提供レイヤー**: Next.js API Route / Edge Function / Cloud Run で REST/GraphQL 形式の読み取り API を提供。フロントはアプリ内でカレンダー UI を構築。

```
Scheduler ──▶ Scraper (fetchYahooRealtime) ──▶ Raw Post Queue ──▶ Normalizer (Rule Engine)
            │                                  │
            │                                  └─▶ Validation + Deduplication
            ▼
     Raw Storage (optional S3/GCS for監査)
            ▼
   Event Store (Firestore / SQL) ──▶ API ──▶ Next.js UI (Calendar) / Alerts
```

## 4. データ取得戦略（スクレイピング）

- **クエリ管理**: `.env` や Firestore コレクションで対象ハッシュタグをリスト化。ジョブはクエリごとにページングを含めて取得。
- **取得手段**: 既存案どおり HTML 内の `__NEXT_DATA__` 解析が最も堅い。内部 API (`/_next/data/...`) の存在を調査し、安定していれば JSON エンドポイント利用も検討。
- **HTTP 設定**: ブラウザらしい `User-Agent`、`Accept-Language: ja-JP`、リファラ付与。短時間での連続アクセスを避け、1 クエリあたりのウェイトを設定。
- **リトライと変更検知**: タイムアウト・HTTP 4xx/5xx では指数バックオフ。HTML 構造が変化した際に検知できるよう JSON パース失敗時のアラートを整備。
- **差分取得**: 過去取得済み ID を保持してディフを取り、新規・更新のみ正規化パイプラインへ流す。
- **補完データ**: 位置情報や価格などが本文に含まれるため、前後の文脈を保持した形で正規化レイヤーに受け渡し、ルールベース解析でも誤抽出しにくくする。

## 5. 正規化戦略（ルールベース）とデータモデル

### 5.1 ルールベース抽出パイプライン

- **目的**: LLM を使わずにポスト本文から日付・時間・数量などを抽出し、カレンダー表示に必要なイベント情報へマッピングする。
- **主なコンポーネント**
  - `DateParser`: `chrono-node` を利用して日時表現（相対表現/日本語表現含む）を ISO8601 へ変換。ポスト取得日時を基準に相対日付（「明日」等）を解決。
  - `TimeFallback`: 時刻が欠落する場合に既定値（例: `12:00`) を設定し、`eventDateResolution` を `date_only` に設定。
  - `TicketPatternMatcher`: 正規表現と辞書でイベント名（ライブ/舞台名称）、数量（`[0-9]+枚`）、価格（`[0-9,]+円`）を抽出。
  - `LocationResolver`: 地名辞書（Geolonia 日本の地名 CSV 等）と簡易スコアリングで候補地点を推定。
  - `CategoryClassifier`: 単純なキーワードベース（「譲ります」「求」等）で `sell` / `buy` / `exchange` を判定。
- **信頼度算出**: 各抽出ステップでヒットした要素数と一致度から 0〜1 のスコアを計算し、`confidence` に格納。閾値未満は `needsReview=true`。
- **再処理フロー**: ルールセットは YAML/JSON で定義し、更新時に過去データへ再適用できるようバージョニングする（例: `rulesetVersion: v2025-11-01`）。

### 5.2 エラーハンドリングとレビュー

- `chrono-node` が日時を特定できない場合は `eventTime=null` とし、`eventDateResolution="unresolved"` で保存。レビュー UI で手動補正。
- 正規表現で複数候補が出た場合は最も高いスコアを採用し、残りは `notes` に記録して参考値にする。
- 日付と時間が文中に複数存在するケース（例: 開場／開演）はヒューリスティクスで優先順位を定義（「開演」>「開場」>その他）。

### 5.3 推奨データモデル（イベント単位）

```jsonc
{
  "id": "tweet_id:normalization_version",
  "source": {
    "postId": "string",
    "query": "#謎チケ売ります",
    "capturedAt": "2025-11-05T09:00:00+09:00",
    "rawText": "string",
    "permalink": "https://..."
  },
  "event": {
    "title": "公演名/対象チケット",
    "category": "sell | buy | exchange | ambiguous",
    "eventTime": "2025-11-10T20:00:00+09:00",
    "location": "渋谷駅周辺",
    "price": { "amount": 6500, "currency": "JPY", "perUnit": "ticket" },
    "quantity": 2,
    "deliveryMethod": "現地手渡し",
    "notes": "本文の補足メモ"
  }
}
```

## 6. ストレージとインデックス戦略

- **Firestore (Native or Datastore mode)**: 柔軟な JSON ドキュメント向き。クエリは `eventTime` の範囲取得が簡単。検索性（全文・地名）は弱いため Algolia / Meilisearch など補助検索と併用するか、`eventTime+query` 複合インデックスを用意。
- **Cloud SQL (PostgreSQL/MySQL)**: カレンダー用途に強い（`event_time` にインデックス、`tsvector` で全文検索）。正規化 JSON を `jsonb` として保持する方法が有効。トランザクション制御が必要な場合はこちら。
- **BigQuery**: 長期アーカイブや BI。リアルタイム用途には遅いが集計に向く。バッチで同期する構成がよい。
- **推奨構成（初期）**: Firestore で運用スピード重視 + Cloud Storage に Raw HTML/JSON を保存（監査・再処理用）→ 必要に応じて Cloud SQL へ移行できるようリポジトリ層を抽象化。
- **インデックス案**: `collection: events` に `eventTime`、`query`, `category`, `needsReview` の複合インデックス。期間検索（週/月）とクエリフィルタを両立。
- **フィールド仕様**: Firestore で保持するフィールド詳細（`postId`, `postURL`, `hashtags`, `createdAt`, `authorId`, `authorName`, `authorImageUr`, `rawPostText`, `eventTime` など）は `.codex/firebase-ticket-schema.md` に集約。

## 7. API / バッチ設計

- **Ingestion API**: `POST /internal/realtime/fetch` で対象クエリを受け取りスクレイパーを即時起動（認証必須）。普段は Cloud Scheduler → Cloud Run ジョブ or Next.js Route Handler（`/api/internal/realtime/fetch`）。
- **Normalization Worker**: Pub/Sub キュー (`raw_posts`) → Cloud Functions / Cloud Run jobs がトリガー。メッセージには `postId`, `rawText`, `capturedAt` などを格納し、`chrono-node` ベースのルールエンジンで正規化した結果を Firestore へ保存。
- **Calendar API**: `GET /api/calendar?from=2025-11-01&to=2025-11-30&query=#謎チケ売ります`。レスポンスは日付ごと配列 or ICS 生成。`revalidate` or Redis キャッシュで 15〜30 分程度の TTL を持たせる。
- **Admin UI**: Next.js 内で `/secret/christmas/congratulations` のようなセクションに管理画面を追加。レビュー／補正機能を提供。
- **Firebase 登録 API 詳細**: 実装仕様は `.codex/firebase-registration-api.md` に記載。

## 8. カレンダー表示と UX 留意点

- 表示コンポーネントはフロントで既存の `FullCalendar` や `@mantine/dates` 等を利用。イベントカラーは `category` と `confidence` で分岐。
- 同日時の複数イベントはスタック表示・バッジ数で集約。「詳細を見る」で元ポストへのリンクと正規化情報を表示。
- `confidence < threshold` や `needsReview=true` のイベントには警告アイコン。レビュー後のフラグ更新は API 経由で反映。
- 過去イベントの保持期間・アーカイブ方針（例: 90 日でアーカイブ）を UI にも明示。

## 9. 運用・監視・セキュリティ

- **監視**: 取得件数が急減した場合や正規化エラー率が上がった場合に Slack 通知。Cloud Monitoring アラート or Sentry を導入。
- **ログ**: Raw ポスト ID と正規化結果の突合を残す。PII を含む可能性があるためアクセス権限を限定。
- **レート制御**: 1 クエリあたり 1〜5 分間隔での取得を想定。急激なアクセスは Yahoo からのブロックの恐れがあるためバックオフとキャッシュを実装。
- **法務対応**: Yahoo! JAPAN 利用規約・robots.txt・スクレイピングガイドラインを確認し、必要に応じて事前承諾を取る。ポスト転載の扱い（著作権）や個人情報の匿名化（連絡先マスク）を検討。

## 10. リスクと緩和策

- **構造変更**: HTML/JSON 構造変化への脆弱性 → スキーマバリデーションとモニタリング、サンプル保存で迅速に再解析。
- **抽出誤り**: 日付・価格などの誤検出 → 信頼度スコアと根拠（マッチしたテキスト範囲）を保存し、低信頼イベントは手動レビュー。
- **保守コスト**: ルールセットのメンテナンス負荷 → ルールを設定ファイル化し、ユニットテストで regressions を防ぐ。
- **データ品質**: スパムや bot 投稿 → 機械学習/ルールでのスコアリング、悪質アカウントのブラックリスト化。
- **可用性**: Yahoo 側ブロック時 → 代替ソース（X の公式 API, 他の掲示板）やスクリーンショット保存による後日処理を検討。

## 11. 次アクション（2025-11 時点の提案）

1. Yahoo! リアルタイム検索 HTML 構造の最新調査とサンプルデータ収集（スクリーンショット・HTML 保存）。
2. 正規化要件を確定（最低限の項目・フォーマット・信頼度定義）し、`chrono-node` と正規表現ルールの初版＋評価指標を策定。
3. Firestore/Cloud SQL どちらに寄せるか PoC（1 週間分のデータでカレンダー API レイテンシを比較）。
4. ルール抽出パイプラインの PoC（`chrono-node` 日付解析 + 正規表現マッチング）を実装し、1 日あたりの処理件数と正確性を測定。
5. カレンダー UI のモックアップ作成と API スキーマを合意。レビュー運用（手動補正フロー）の設計も合わせて詰める。
