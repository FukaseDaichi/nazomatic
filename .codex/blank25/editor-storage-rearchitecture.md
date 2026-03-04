# BLANK25 Editor 保存方式再設計案（v0.3 / 2026-03-04）

## 1. 背景と課題

現行は `/blank25/editor` の publish で GitHub に `problems.json` と画像をコミットし、デプロイ反映後にプレイ画面へ見える方式。

- 連続投稿時に `baseManifestSha` が古くなり `409` が発生しやすい
- GitHub push -> デプロイ完了まで反映待ちが長い
- 編集体験が「保存できたのに見えない」状態になりやすい

## 2. 先に結論

- `json だけ Firebase + 画像は Git` は非推奨
- 採用案は **C: Firestore (JSON) + Firebase Cloud Storage (画像)** に固定
- GitHub 上の BLANK25 画像は 0 枚運用（配信元にしない）
- GitHub へのバックアップ/ミラーは実施しない

理由:

- 画像を Git に残すと、デプロイ待ちと整合性ズレ（manifest 更新済みだが画像未反映）が残る
- データと画像の更新先を分けると、障害時の切り分けと再実行が難しくなる

## 3. 方式比較

| 案                                               | 反映速度             | 連続投稿耐性 | 実装コスト | コメント                                         |
| ------------------------------------------------ | -------------------- | ------------ | ---------- | ------------------------------------------------ |
| A. 現行 GitHub 方式 + 自動リトライ               | 遅い（デプロイ待ち） | 中           | 低         | とりあえずは改善するが本質課題は残る             |
| B. JSON: Firestore / 画像: GitHub                | 中                   | 中           | 中         | 画像反映だけデプロイ待ちになり整合性が崩れやすい |
| C. JSON: Firestore / 画像: Cloud Storage（採用） | 速い（即時）         | 高           | 中         | 連続投稿と即時反映を両立し、運用を一本化できる   |

## 4. 採用アーキテクチャ（C）

### 4.1 保存先

- Firestore
  - `blank25Manifests/current`
  - `blank25Mutations/{mutationId}`（冪等化と監査）
  - `blank25Meta/counters`（`nextProblemNumber`）
- Cloud Storage
  - `blank25/{uuid}.webp`（新規・既存移行後の全画像）
  - manifest には `imageUrl`（直リンク URL）を保持
  - 既存 `public/img/blank25/*` は最終的に参照しない

### 4.2 書き込みフロー（create/update/delete）

1. クライアントが `mutationId`（UUID）を生成して publish API に送る
2. API が `blank25Mutations/{mutationId}` を確認
3. 既に適用済みなら前回結果をそのまま返す（多重送信対策）
4. 画像ありなら先に Cloud Storage へアップロード
5. Firestore transaction で manifest を更新
6. `mutation` ドキュメントに結果（`problemId`, `revision`）を保存
7. レスポンス返却

補足:

- transaction が自動再試行されるため、同時更新でもサーバー側で直列化される
- UI 側は `409` ベース運用から、基本的に「成功 or バリデーションエラー」中心へ移行できる

### 4.3 読み取りフロー（プレイ画面）

- `/data/blank25/problems.json` 直読みを廃止
- `GET /api/blank25/manifest`（公開 API）から Firestore の current manifest を返す
- 画像は Cloud Storage の直リンク URL をそのまま `src` に使う（GitHub 経由なし）
- 必要なら `next.config.js` の `images.remotePatterns` に配信ドメインを追加

## 5. API 変更案

- 既存 `GET /api/internal/blank25/editor/manifest`
  - 返却を GitHub 由来から Firestore 由来へ置換
- 既存 `POST /api/internal/blank25/editor/publish`
  - リクエストへ `mutationId` 追加
  - `baseManifestSha` は廃止、代わりに `revision`（任意）を利用
- 新規 `GET /api/blank25/manifest`
  - プレイ画面向けの公開 manifest 取得 API

## 6. 無料運用の成立条件（2026-03-04 時点）

### 6.1 先に結論

- 「**従量課金が発生しない運用**」は可能
- ただし「**Spark（支払い方法未登録）だけで完結**」は不可
- Cloud Storage for Firebase は 2026-02-02 以降に段階適用され、遅くとも 2026-10-30 までに Blaze へのアップグレードが必要

### 6.2 無料で抑えるための条件

- Firebase プロジェクトを Blaze に上げる（Billing 連携は必要）
- Firestore を無料枠内に維持
  - 1 GiB
  - 50K reads/day
  - 20K writes/day
  - 20K deletes/day
- Cloud Storage を無料枠内に維持
  - `*.appspot.com` legacy bucket: 5 GB stored, 1 GB/day download, 20K uploads/day, 50K downloads/day
  - `*.firebasestorage.app` / 追加 bucket: 5 GB-month, 100 GB/month download, 5K uploads/month, 50K downloads/month（対象リージョン制約あり）
- 予算アラートを `$1`, `$5`, `$10` に設定し、上限通知で即検知

### 6.3 BLANK25 での実務的な目安

- 1画像あたり 200KB とすると:
  - 1 GB/day なら約 5,000 表示/日
  - 100 GB/month なら約 500,000 表示/月
- ただし bucket 種別によって「転送量」ではなく「ダウンロード回数」が先に上限に達する可能性がある

## 7. 実装ステップ（段階移行）

### Phase 1: 即効改善（1-2日）

- editor publish に `mutationId` を追加
- 同一 `mutationId` の多重送信を無害化
- 保存完了後の再読み込みを Firestore に切替

### Phase 2: 本移行（2-4日）

- manifest 保存先を Firestore へ全面移行
- 既存画像を含め、画像保存先を Cloud Storage へ全面移行
- プレイ画面の manifest 取得を API 経由へ変更

### Phase 3: 旧資産整理（1日）

- `public/img/blank25/*` の参照コードを完全撤去
- `imageFile` 依存を廃止し `imageUrl` に統一
- GitHub 連携コード（BLANK25向け）を削除

## 8. 影響ファイル（想定）

- `src/app/api/internal/blank25/editor/manifest/route.ts`
- `src/app/api/internal/blank25/editor/publish/route.ts`
- `src/server/blank25/*`（GitHub依存ロジックの撤去）
- `src/components/blank25/manifest.ts`（公開 API 取得へ変更）
- `src/components/blank25/blank25-game.tsx`（`imageUrl` 対応）
- `src/components/blank25/problem-list.tsx`（`imageUrl` 対応）
- `src/server/firebase/admin.ts`（Storage 初期化を追加）

## 9. この件への回答

- 「jsonだけFirebase、画像は別Git」はおすすめしない
- 反映速度と整合性を優先するなら、JSON/画像を同じ Firebase 系に寄せるのが実運用で安定
- C案（Firestore + Cloud Storage）で進めるのが最も実用的
- 既存画像も全件 Cloud Storage 管理へ移し、GitHub 画像/バックアップ運用は行わない
