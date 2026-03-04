# BLANK25 Editor 保存方式再設計案（v0.5 / 2026-03-04）

## 1. 背景と課題

現行は `/blank25/editor` の publish で GitHub に `problems.json` と画像をコミットし、デプロイ反映後にプレイ画面へ見える方式。

- 連続投稿時に `baseManifestSha` が古くなり `409` が発生しやすい
- GitHub push -> デプロイ完了まで反映待ちが長い
- 編集体験が「保存できたのに見えない」状態になりやすい

---

## 2. 採用方針（v0.5）

**D: JSON と画像を単一の専用リポジトリ（`nazomatic-storage`）で管理し、GitHub raw URL で直接配信する**

- `nazomatic-storage` リポジトリに `problems.json` と全画像ファイルを格納
- JSON / 画像を **同一コミット** で push（Git Trees API を使用）し、非アトミック更新を回避する
- publish は force: true 相当で push し、`baseManifestSha` チェックを廃止
- JSON は取得時にタイムスタンプをクエリパラメータとして付与し CDN キャッシュを迂回する
- 画像は raw URL を直接参照し、`next/image` の `unoptimized` prop を指定する

### v0.3（Firestore + Cloud Storage）との比較

| 観点                | v0.3（Firestore + Storage）    | v0.5（単一リポ + raw URL）              |
| ------------------- | ------------------------------ | --------------------------------------- |
| Firebase Blaze 必要 | 必要                           | 不要                                    |
| JSON 反映速度       | 即時                           | タイムスタンプ付き fetch で即時相当     |
| 画像 反映速度       | 即時                           | CDN キャッシュ分の遅延あり（最大 5 分） |
| JSON / 画像の整合性 | Firestore transaction で保証   | 同一コミットで保証                      |
| 同時編集の競合検知  | Firestore transaction で直列化 | なし（force push = last write wins）    |
| 実装コスト          | 中                             | 低                                      |
| 外部依存            | Firebase                       | GitHub のみ                             |
| 運用コスト          | Billing 管理が必要             | 無料（GitHub 無料枠内）                 |

---

## 3. アーキテクチャ

### 3.1 リポジトリ構成

```
nazomatic-storage（専用リポジトリ / public）
├── problems.json
├── {problemId}.webp
└── ...
```

- **パブリック** リポジトリで運用する（raw URL をトークンなしで参照するため）
- ブランチ保護ルールは無効にしておく（force push を許容するため）

### 3.2 URL 形式

```
JSON（キャッシュバスター付き）:
  https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main/problems.json?v={timestamp}

画像（直接参照）:
  https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main/img/{problemId}.webp
```

- `timestamp` は publish API が完了したタイミングの Unix ミリ秒をクライアントに返し、manifest 取得 URL の生成に使う
- 画像 URL にはクエリパラメータを付けない（CDN キャッシュを許容する）

### 3.3 書き込みフロー（publish）

1. Editor が画像 base64 / ArrayBuffer と manifest 変更内容を publish API に送る
2. API が Git Trees API で画像 blob と `problems.json` blob を同時に生成
3. 単一コミットとして main ブランチへ force push（既存 SHA を取得後に上書き）
4. `publishedAt` タイムスタンプをレスポンスに含めて返す（`baseManifestSha` チェックなし）

> **Git Trees API を使う理由**: GitHub Contents API（`PUT /repos/.../contents/...`）は 1 ファイルずつしか更新できないため、JSON と画像が別コミットになる。Trees API を使うと複数ファイルを 1 コミットで反映でき、整合性が保たれる。

### 3.4 読み取りフロー（プレイ画面）

- `GET /api/blank25/manifest` — サーバー側で raw URL（タイムスタンプ付き）を fetch して返す
  - タイムスタンプはサーバーの現在時刻を使う（毎回キャッシュを迂回）
- 画像は manifest 内の `imageUrl`（raw.githubusercontent.com、クエリパラメータなし）を `<img src>` に直接渡す
- `next/image` を使う場合は **`unoptimized` prop を必ず指定**する（Vercel 最適化クォータを消費しない）

---

## 4. API 変更案

| エンドポイント                              | 変更内容                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /api/internal/blank25/editor/manifest` | `nazomatic-storage` の raw URL（タイムスタンプ付き）から `problems.json` を fetch して返す              |
| `POST /api/internal/blank25/editor/publish` | `baseManifestSha` を廃止。Git Trees API で JSON + 画像を同一コミットで force push。`publishedAt` を返す |
| `GET /api/blank25/manifest`（新規）         | 公開 API。raw URL（タイムスタンプ付き）をサーバー fetch して返す                                        |

---

## 5. 実装ステップ

### Phase 1: ストレージリポジトリ準備

- `nazomatic-storage` リポジトリを作成（public）
- 既存の `public/data/blank25/problems.json` を移行
- 既存の `public/img/blank25/*` を移行
- 環境変数を追加: `BLANK25_STORAGE_GITHUB_REPO`（既存の `BLANK25_EDITOR_GITHUB_REPO` は nazomatic 本体用として維持）

### Phase 2: publish API の書き換え

- `src/server/blank25/github.ts` を `nazomatic-storage` リポジトリ対応に改修
- `baseManifestSha` ロジックを削除
- Contents API → Git Trees API（blob 作成 → tree 作成 → commit → ref 更新）に変更
- レスポンスに `publishedAt` を追加

### Phase 3: 読み取りパスの変更

- `GET /api/blank25/manifest` を新規実装（タイムスタンプ付き raw URL fetch）
- プレイ画面 / 問題一覧の manifest 取得を `/api/blank25/manifest` に切替
- `imageUrl` を `nazomatic-storage` の raw URL に統一
- `next/image` コンポーネントに `unoptimized` prop を追加

### Phase 4: 旧資産の整理

- `public/data/blank25/problems.json` の参照コードを撤去
- `public/img/blank25/*` の参照コードを撤去
- Vercel デプロイへの BLANK25 コンテンツ依存を完全に切り離す

---

## 6. 影響ファイル（想定）

- `src/app/api/internal/blank25/editor/manifest/route.ts`
- `src/app/api/internal/blank25/editor/publish/route.ts`
- `src/app/api/blank25/manifest/route.ts`（新規）
- `src/server/blank25/github.ts`（Trees API 対応・ストレージリポジトリ向け改修）
- `src/components/blank25/manifest.ts`（API 取得先変更）
- `src/components/blank25/blank25-game.tsx`（`imageUrl` 対応・`unoptimized` prop 追加）
- `src/components/blank25/problem-list.tsx`（`imageUrl` 対応・`unoptimized` prop 追加）

---

## 7. 既知の問題点

### 7.1 画像の CDN キャッシュ（最大 5 分）

`raw.githubusercontent.com` の画像は CDN でキャッシュされるため、push 直後は最大 5 分程度古い画像が表示される可能性がある。`problems.json` はタイムスタンプで迂回するが、画像は意図的にキャッシュを許容する方針とする。問題 ID に紐づく画像は一度 publish すると通常は変わらないため、実運用での影響は小さい。

### 7.2 last write wins（競合データロスト）

`baseManifestSha` チェックを廃止するため、2 つの publish が重なった場合は後からの push が前の変更を上書きする。同時編集者が複数いる運用では変更が黙って消える。1 人管理が前提であれば許容できる。

### 7.3 画像削除・リネームの管理

問題を更新・削除した際に旧画像ファイルが `nazomatic-storage` に残り続ける。孤立ファイルを削除する仕組みがないと Git オブジェクトが増える。publish フロー内での旧ファイル削除（Trees API に削除エントリを含める）か、定期的な手動整理が必要。

### 7.4 GitHub 利用規約上のリスク

`raw.githubusercontent.com` は大規模コンテンツ配信用の CDN ではない。アクセス数が増えると 429 や IP 制限が発生し得る。小規模運用では問題ないが、スケールアップ時は Cloud Storage / CDN への移行を再検討する。

### 7.5 パブリックリポジトリ必須

raw URL をトークンなしで参照するには `nazomatic-storage` がパブリックである必要がある。BLANK25 の未公開問題や画像を一時的に非公開にしたい場合は対応できない。

### 7.6 Git Trees API の実装コスト

Trees API は Contents API より手順が多い（blob 作成 → tree 作成 → commit 作成 → ref 更新の 4 ステップ）。ただし同一コミットで複数ファイルを扱える唯一の方法であり、整合性確保のために必須とする。

---

## 8. 結論

- Firebase Blaze プランを使わずに運用できる
- JSON と画像を同一リポジトリ・同一コミットで管理することで、v0.4 の非アトミック問題を解消する
- JSON はタイムスタンプ付き fetch で即時相当の反映、画像は CDN キャッシュを許容する
- 1 人管理 / 小規模アクセスの前提であれば実用的
- アクセスが増えた場合は GitHub raw 配信から Cloud Storage / CDN への移行を再検討する
