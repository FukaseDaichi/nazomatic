# BLANK25 Editor 保存方式設計書（実装準拠 / 2026-03-07）

## 1. 概要

- BLANK25 Editor の publish は `nazomatic-storage` リポジトリに対して行う。
- `problems.json` と画像を Git Trees API で同一コミットとして反映する。
- プレイ画面は GitHub raw URL を参照して最新 manifest / 画像を表示する。

## 2. 採用構成

- 保存先: `nazomatic-storage`
- 配信元: `raw.githubusercontent.com`
- publish: `force: true`
- manifest 取得: タイムスタンプ付き raw URL で CDN キャッシュを回避
- 画像配信: raw URL を直接参照し、画像キャッシュは許容する

### 2.1 旧方式との差分

- `baseManifestSha` による競合検知は廃止
- GitHub push 後の Next.js 再デプロイ待ちは不要
- JSON と画像の非アトミック更新を回避

## 3. リポジトリ設計

```text
nazomatic-storage
├── problems.json
└── img/
    ├── {problemId}.webp
    └── ...
```

- public リポジトリ前提
- branch は `BLANK25_EDITOR_GITHUB_BRANCH` で指定、未設定時は `main`

## 4. URL 設計

```text
manifest:
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/problems.json?v={timestamp}

image:
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/img/{problemId}.webp
```

- `owner`, `repo`, `branch` は `BLANK25_EDITOR_GITHUB_*` から解決する
- クライアント側画像 URL は `NEXT_PUBLIC_BLANK25_STORAGE_RAW_BASE` を基準に生成する

## 5. 読み書きフロー

### 5.1 publish

1. Editor が base64 画像と変更内容を publish API に送る
2. API が最新 `problems.json` を raw URL から取得する
3. 変更を manifest に反映する
4. Git Trees API で `problems.json` と画像 blob を 1 コミットにまとめる
5. branch を `force: true` で更新する
6. 更新後 manifest をレスポンスで返す

### 5.2 play / editor read

- 公開画面: `GET /api/blank25/manifest`
- Editor 管理画面: `GET /api/internal/blank25/editor/manifest`
- どちらも raw URL の `problems.json` を取得する

## 6. API 境界

- `src/server/blank25/github.ts`
  - `loadBlank25StorageConfig`
  - `fetchManifestFromRaw`
  - `buildStorageImagePath`
  - `commitFilesToBlank25Branch`
- `src/app/api/internal/blank25/editor/publish/route.ts`
- `src/app/api/internal/blank25/editor/manifest/route.ts`
- `src/app/api/blank25/manifest/route.ts`

## 7. 既知の制約

### 7.1 画像キャッシュ

- `raw.githubusercontent.com` の画像は CDN キャッシュされるため、更新直後は古い画像が最大 5 分程度見えることがある。

### 7.2 競合制御

- `force: true` のため last write wins。
- 同時編集時は後勝ちになる。

### 7.3 孤立画像

- 問題更新・削除時に旧画像ファイルが残ることがある。

### 7.4 public リポジトリ前提

- raw URL を匿名参照するため `nazomatic-storage` は public 前提。
