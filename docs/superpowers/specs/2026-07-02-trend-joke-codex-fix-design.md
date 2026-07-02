# トレンドネタ投稿 最小修理(codex復旧+実イベント名織り込み) 設計

日付: 2026-07-02
対象: `scripts/x-browser-post-trend-joke.mjs`, `src/server/x-browser-posting/trend-joke-post.ts`, `docs/x-browser-posting/trend-joke-post.md`

## 背景

- 目的は「もっとバズり、フォロワーが伸びる面白い投稿」。現状はフォロワー約20人、通常投稿はインプレッション数十〜数百・いいね0〜3で、実質的に配信されていない。
- 調査の結果、Codex CLI の更新で `codex exec` から `--ask-for-approval` フラグが削除され、**codex provider が全実行で失敗**していることが判明した(保持中の実行ログ10世代すべてで失敗→fallback)。
- その結果、全投稿が固定25候補のfallbackプールの輪番になっており、検索で取得済みの実イベント名(生きた材料)が一切本文に使われていない。
- フォロワーが少ない単発投稿が見られる経路は「イベント名検索」「主催者のエゴサ→RT」が中心。実イベント名を含まない現状の投稿は、この露出面を全く持たない。

## 決定事項

- 人のポストへの返信・言及による対人路線は**封印**(ユーザー判断。既存の「人に触れない」方針を維持)。
- 改善は最小修理(案A)のみ: codex復旧+プロンプト強化。
- provider連続失敗カウンタによる可視化は**不採用**(ユーザー判断)。
- 人格のメンヘラ自虐を核に維持し、温度で散らす方針(2026-06-27改訂)は不変。

## スコープ

1. **codex呼び出し修正**: `scripts/x-browser-post-trend-joke.mjs` の `runCodexTrendJokeProvider` から `"--ask-for-approval", "never"` の2引数を削除する。現行 `codex exec` は非対話実行が既定でありフラグ自体が不要。`--sandbox read-only`・`--ephemeral`・`--output-schema`・`--output-last-message`・`--cd` は現行CLIに存在するため維持する。コード中の使用箇所はこの1箇所のみ(リポジトリ全体をgrepで確認済み)。
2. **プロンプト強化(server側)**: `buildTrendJokeCopyPrompt` の条件に以下を追加する。
   - イベント名サンプルに実在の公演名として自然なものがあれば、**1つだけ**選んで本文に織り込む。語感への憧れ・反応として褒め寄りに限定し、批評はしない。
   - サンプルリストにない名前は使わない(捏造禁止の具体化)。
   - 「〜募集」「〜繋がりたい」などハッシュタグ的文言はイベント名として扱わない(抽出器のノイズはLLM側でフィルタする)。
   - 自然な公演名が1つもなければ、従来どおりイベント名なしで書く。
   - RTや拡散を求める文言は入れない(拾われるのは副産物)。
3. **CLI側プロンプト追記(直近履歴ヒント)**: `buildTrendJokeProviderPrompt` に、ローカル履歴 `local/x-browser-posting/trend-joke-history.json` の直近3件の `shape` と `endingText` を渡し、「これらと違う感情の温度・違うオチにする」という指示を追記する。呼び出し側で履歴を読み込んで引数に通す。機械的な履歴ガード(完全一致・末尾被り・bigram類似)は従来どおり最終防衛として維持する。
4. **ドキュメント更新**: `docs/x-browser-posting/trend-joke-post.md` の codex 起動記述(455行付近)から `--ask-for-approval never` を削除し、プロンプト方針(実イベント名1つ織り込み・直近履歴ヒント)を「文案生成」節に反映する。
5. **検証**: 下記「検証」参照。

## 非スコープ

- 対人インタラクション(返信・引用・メンション)の自動化。
- メトリクス収集CLI、アンケート投稿、画像投稿、週次シリーズ企画、ハッシュタグ解禁。
- title extractor(抽出器)自体の精度改良。
- provider連続失敗カウンタ。
- validator ルールの変更(既存ルールはそのまま)。

## 設計詳細

### codex引数(修正後)

```
codex exec [--model <model>] --cd <cwd> --sandbox read-only --ephemeral \
  --output-schema <schema.json> --output-last-message <output.json> -
```

プロンプトはstdinで渡す(現行と同じ)。エラーハンドリング・リトライ(`X_BROWSER_POST_TREND_JOKE_PROVIDER_ATTEMPTS`)・fallback降格の流れは変更しない。

### プロンプト追加条件の配置

- server側 `buildTrendJokeCopyPrompt`(`trend-joke-post.ts` 804行付近)の「条件:」ブロックにイベント名織り込み指示を追加する。既存の「実在イベント名に触れる場合も…捏造しない」の行を、上記スコープ2の具体指示に置き換え・拡張する。
- CLI側 `buildTrendJokeProviderPrompt`(`x-browser-post-trend-joke.mjs` 516行付近)に履歴ヒント節を追加する。履歴が読めない場合(初回・破損)はヒントなしで従来どおり動作する。

### 影響しない不変条件

- prepare API のリクエスト/レスポンス形式は不変(copyPrompt の中身の文言だけ変わる)。
- Firestore read/write 0、投稿本文のDB非保存、ローカルstate/履歴の仕様は不変。
- validator は server / CLI 両実装とも変更しない。
- fallback候補プール(25候補・10温度)は変更しない。

## 検証

- `npm run lint` と `npx tsc --noEmit` がクリーンであること。
- dry-run(`npm run x:browser-post:trend-joke -- --copy-provider codex`、`--execute`なし)で:
  - codex が exit 0 で文案を返すこと(現行の失敗が解消)。
  - サンプルに自然な公演名がある場合、本文に織り込まれること(目視)。
  - validator と履歴ガードを通過すること。
- codex を意図的に失敗させ(存在しないmodel指定等)、fallback候補への降格が従来どおり動くこと。
- 履歴ファイルがない/壊れている状態の dry-run で、履歴ヒントなしのプロンプトが組まれ実行が継続すること。

## リスク

- イベント名の捏造・批評の抑止はプロンプト担保であり、コードでは検査しない(既存方針と同じ)。現在は unattended 運用で人間確認が挟まらないため、**修正後の最初の数投稿はログの生成文を目視確認する**ことを推奨する。
- 抽出サンプルには公演名でないノイズ(募集文言等)が混ざるため、LLM側フィルタが誤ってノイズを公演名として扱う可能性が残る。目視確認期間で品質を見る。
