# 既知の懸念点

この文書は、現行コードから確認できるリスクと保守上の弱点をまとめます。将来計画や作業履歴ではありません。

## 優先度: 高

### BLANK25 Editor は同時更新を上書きできる

`src/server/blank25/github.ts` は storage branch ref を `force: true` で更新し、base commit の競合を検出しません。複数 Editor が同時に publish すると、後の更新が先の manifest 変更を失わせる可能性があります。更新・削除で不要になった画像も自動削除されないため、orphan file が増えます。

### 自動 test の範囲が X 投稿 script に限られる

test framework 自体はあります。`node:test` を使う `npm run test:x-browser-posting` が `scripts/x-browser-posting/*.test.mjs` を実行し、X 文案 validator、proposal schema、patch 適用、review markdown 生成を回帰確認します。

一方 `src/` 側には test が 1 件もありません。timezone 計算、Yahoo response parsing、Firestore transaction、BLANK25 manifest 編集、生成 scripts の回帰は、lint と build と手動確認だけで担保しています。外部仕様依存の多いサブシステムほど、変更検知が遅れる可能性があります。

## 優先度: 中

### Yahoo / X 非公式 response 形式への依存

Yahoo!リアルタイム検索と X syndication endpoint は外部 response の構造に依存します。schema 契約や fixture test がなく、形式変更が収集停止・parse error・可視性 `unknown` の増加として現れます。

### 実験の baseline と評価週に取りこぼし余地がある

`x-growth-improve` は PR 作成時の `proposalBaseline` を保存し、`x-growth-maintain` は production activation 時に再集計せず、その値を `evaluationBaseline` として引き継ぎます。レビューやマージ待ちが長いと、表示する baseline が実験開始直前の状態を表さない可能性があります。

`docs/ideas/x-growth-pr-automation-final-spec.md` は activation 時に `activeAt - maturityHours` を終端として `evaluationBaseline` を再計算する仕様を記述していますが、現行実装は未対応です。仕様書と現行実装のどちらを正とするかが未確定のため、実装判断は保留しています。

また、週次レビューは `plannedEvaluateWeek` が実行週と完全一致する active PR だけを評価対象にします。該当週のレビューが失敗または未実行だった場合、翌週以降に自動で拾い直しません。

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
