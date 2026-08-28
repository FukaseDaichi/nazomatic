# 既知の懸念点

この文書は、現行コードから確認できるリスクと保守上の弱点をまとめます。将来計画や作業履歴ではありません。

## 優先度: 高

### BLANK25 Editor は同時更新を上書きできる

`src/server/blank25/github.ts` は storage branch ref を `force: true` で更新し、base commit の競合を検出しません。複数 Editor が同時に publish すると、後の更新が先の manifest 変更を失わせる可能性があります。更新・削除で不要になった画像も自動削除されないため、orphan file が増えます。

### 自動 test の範囲が X 投稿 script に限られる

`src/` 側には test が 1 件もありません。timezone 計算、Yahoo response parsing、Firestore transaction、BLANK25 manifest 編集、生成 scripts の回帰は、lint と build と手動確認だけで担保しています。外部仕様依存の多いサブシステムほど、変更検知が遅れる可能性があります。

## 優先度: 中

### Yahoo / X 非公式 response 形式への依存

Yahoo!リアルタイム検索と X syndication endpoint は外部 response の構造に依存します。schema 契約や fixture test がなく、形式変更が収集停止・parse error・可視性 `unknown` の増加として現れます。

### 72時間の自動 keep は改善効果を判定しない

`x-growth-maintain` は production activation から72時間、`x-growth:revert` または `x-growth:needs-attention` が付かなければ変更を自動 keep します。これは明示的な運用問題が報告されなかったことだけを表し、表示数・反応・フォロワー増加などの改善効果を証明しません。問題がGitHub labelへ反映されなければ自動 keepされるため、異常を見つけた人が72時間以内に `x-growth:revert` を付ける運用に依存します。

### テレメトリ不足で保留した実験は自動再評価されない

`x-growth-maintain` は production deployment を確認してもテレメトリが不足していると `x-growth:needs-attention` を付けます。同 label の PR は次回以降の activation 対象から除外されるため、計測が後から十分になっても、人間が原因を確認して label を外すまで自動再評価されません。

## 優先度: 低

### Shift Search の external report が未解決

現行 `src/generated/shift-search/view-manifest.json` では external 4 件すべてが `unresolvedExternal` です。詳細 page は raw GitHub Markdown の取得導線を出せますが、アプリ内閲覧または専用外部配信 URL はありません。

### 依存関係に整理余地が残る

以下は現行 `src/` / `scripts/` / 設定ファイルから直接の import を確認できませんが、間接的な役割があるため保留しています。

- `@react-spring/three`、`@use-gesture/react`: 直接 import はありませんが、使用中の `@react-three/drei` の直接依存です。どちらにせよ install されるため、top-level 記載は必須ではなく冗長です。
- `shadcn-ui`: CLI のみで import しません。`components.json` があるため component 追加用と推測できますが、`dependencies` ではなく `devDependencies` が適切です。upstream では package 名が `shadcn` に変わっています。
- `@shadcn/ui`: 上記 CLI の旧 package で、`devDependencies` に残っています。初期 install の残存とみられます。

### local rate state の日次キーが UTC 日付

`local/x-browser-posting/rate-state.json` の日次キーは UTC 日付で管理され、投稿 CLI の Asia/Tokyo 運用日と最大9時間ずれる。現行の投稿数は1日10件未満で hard limit 30件に近くないため影響は小さいが、日次上限を増やす前に JST 基準へ統一する。
