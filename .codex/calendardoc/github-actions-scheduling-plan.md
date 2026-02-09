# GitHub Actions スケジューリング実装方針（Realtime Register / Prune）

## 1. ゴール

- `/api/internal/realtime/register` を 1 時間ごとに自動実行し、最新ポストを取り込み。
- `/api/internal/realtime/prune` を 1 日ごとに自動実行し、古いイベント（`eventTime` が 1 日以上前）を削除。
- GitHub Actions 上で安定して動作させるため、環境変数管理・失敗時リトライ・通知なども考慮。

## 2. アーキテクチャ概要

- **スケジューラ**: GitHub Actions の `workflow_dispatch` + `schedule (cron)` を利用。
- **ワークフロー構成案**
  - `realtime-register.yml`: 毎時実行。`curl` or `node` script を動かして API を叩く。
  - `realtime-prune.yml`: 毎日実行。上記同様に API を叩く。
- **認証方法**: API は内部利用前提のため Bearer トークンまたは特定ヘッダーを付与する。GitHub Actions の Secrets に設定 (`REALTIME_API_TOKEN` など)。
- **ホスト**: デプロイ先（例: Vercel）のエンドポイントを `REALTIME_API_BASE_URL` として Secrets に保持し、ワークフローから参照。

## 3. 詳細設計

### 3.1 シークレット・環境変数

- `REALTIME_API_BASE_URL`: `https://<project>.vercel.app` など。
- `REALTIME_API_TOKEN`: 内部 API にアクセスできるトークン（Next.js Route 側で検証）。

### 3.2 Register ワークフロー

- トリガー: `schedule: cron: "0 * * * *"`（毎時 00 分）。
- ジョブ: Ubuntu runner
  1. `curl -X POST "$REALTIME_API_BASE_URL/api/internal/realtime/register" -H "Authorization: Bearer $REALTIME_API_TOKEN" -H "Content-Type: application/json" -d '{"query":"#謎チケ売ります","limit":40,"dryRun":false}'`
- `timeout-minutes` で上限（例 5 分）を設定。
- 再実行戦略: GitHub Actions 標準の再試行またはワークフロー内で簡易リトライ。

### 3.3 Prune ワークフロー

- トリガー: `schedule: cron: "0 0 * * *"`（毎日 0:00 UTC）。
- ジョブ内容: `curl -X POST "$REALTIME_API_BASE_URL/api/internal/realtime/prune" -H ... -d '{"cutoffDays":1,"dryRun":false}'`
- 成功時ログで削除件数を表示。

### 3.4 Next.js Route 側の対応

- 認証: `Authorization` ヘッダーを検証し、GitHub Actions からのアクセスのみ許可。
- レート制御: Register API でクエリ/limit を固定 or 引数で受ける。
- dry-run オプション: GitHub Actions から false を指定。

### 3.5 テスト・検証

- GitHub Actions で手動 `workflow_dispatch` を追加し、Secrets 設定後に動作確認。
- Vercel 側のログ・Firestore のデータ更新を確認。
- 長期稼働前に 24h / 1week 程度モニタリング。

### 3.6 エラーハンドリング

- curl の exit code 確認。失敗時に GitHub Actions を失敗扱いにし、通知。
- API 側で 503 等を返す場合は `--retry` オプションを使用。
- 再実行や fallback（例: register が失敗しても prune は実行）を独立ワークフローで保証。

## 4. 今後の拡張余地

- API 応答の JSON を解析し、GitHub Actions の step summary に簡易レポートを表示。
- Slack / Teams などへの通知。
- register 対象のクエリを複数処理する場合、GitHub Actions からクエリ配列を順次送信。
- 成功ログを BigQuery や Firestore へ格納。
