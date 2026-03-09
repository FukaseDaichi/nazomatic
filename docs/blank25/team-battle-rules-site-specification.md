# BLANK25 チーム戦ルール説明ページ仕様書（実装準拠 / 2026-03-09）

## 1. 目的

- `/blank25/party/rules` で、BLANK25 を使ったチーム戦の遊び方を 1 ページで説明する。
- 文章だけでなく、盤面ギミックと短いコピーで「どこまで隠すか」の駆け引きを伝える。
- ルール理解後に `/blank25` と `/blank25/party` へすぐ遷移できる導線をまとめる。

## 2. スコープ

### 2.1 対象

- ルート `/blank25/party/rules`
- `/blank25` 一覧ページからの導線カード
- ヒーロー、攻め度メーター、ラウンド進行、全滅時リトライ、CTA セクション
- Tooltip を使った補足説明

### 2.2 対象外

- チーム戦そのものの自動進行
- 得点管理の自動保存
- チーム編成、ターン進行、制限時間のサーバー保存
- 実問題データとの同期
- `/blank25/party` からの導線

## 3. ルートと実装ファイル

- ページ: `src/app/(blank25)/blank25/party/rules/page.tsx`
- 本体: `src/components/blank25/team-battle-rules.tsx`
- 攻め度メーター: `src/components/blank25/team-battle-chicken-meter.tsx`
- ラウンド進行: `src/components/blank25/team-battle-round-flow.tsx`
- 全滅シミュレーター: `src/components/blank25/team-battle-retry-simulator.tsx`
- 説明用盤面ロジック: `src/components/blank25/team-battle-board.ts`
- 説明用盤面 UI: `src/components/blank25/team-battle-tutorial-image-board.tsx`
- 導線追加: `src/components/blank25/problem-list.tsx`

## 4. ページ構成

### 4.1 ヒーロー

- 見出しは `その 1 枚、残す？`
- サブコピーは「味方が解けるギリギリを狙ってパネルを HIDE する」流れを短く説明する。
- バッジは以下 4 つを表示する。
  - `2人以上でチーム戦`
  - `正解 = HIDE 数`
  - `不正解 = 0 点`
  - `全滅したら再作問`
- CTA は 2 本。
  - `/blank25` への `問題を選んで作問する`
  - `/blank25/party` への `得点ボードをひらく`

### 4.2 攻め度メーター

- `hiddenCount` をローカル state で保持する。
- 初期値は `9`。
- `-` / `+` ボタンとプリセット `5`, `9`, `13`, `17` を用意する。
- `score` は説明ページ内では `hiddenCount` と同値で表示する。
- 25 マスの説明用盤面と、攻め度ラベル、プログレスバー、短い解説文を同期表示する。
- 攻め度ラベルは `まだ浅め` / `ちょうど勝負圏` / `高得点狙い` / `超高得点帯` の 4 段階。

### 4.3 ラウンド進行

- 4 ステップで説明する。
  - チーム分け
  - 出題者決定
  - 制限時間で作問
  - 味方が回答
- Step 3 の補足 Tooltip では「作問モードは盤面をロックしてから判定に進む」と説明する。
- カード末尾に、全滅時はもう 1 回やり直す旨の補足ブロックを置く。

### 4.4 全滅リトライシミュレーター

- シーン切替は `1回目の作問` / `全チーム失敗` / `やり直し盤` の 3 つ。
- 1 回目は `HIDE 15`、やり直し盤は `HIDE 10` を使う固定デモとする。
- 前回見えていたパネルを `FIX`、やり直しで新たに開いたパネルを `NEW` として盤面上で可視化する。
- 右側カードに各シーンの要約と `Fixed`, `HIDE`, `Open` 数を表示する。

### 4.5 CTA セクション

- ページ末尾に `Ready To Play` セクションを置く。
- `/blank25` と `/blank25/party` へのカード型リンクを再掲する。

## 5. 説明用盤面仕様

- 盤面は固定 25 マス。
- 説明用画像は `https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main/img/1.png` を使う。
- 隠し順は `TEAM_BATTLE_PANEL_ORDER` の固定配列を使う。
- `getTeamBattleHiddenPanels(count)` はこの配列の先頭から `count` 件を返す。
- `getTeamBattleOpenPanels(hiddenPanels)` は補集合を返す。
- 説明ページの盤面は実ゲーム状態や API に依存しない。

## 6. コピーとルール表現

- 本ページのコピーは一貫して `HIDE` を中心語として使う。
- 正解時得点の説明は `HIDE 数`、不正解時は `0 点` で統一する。
- 本ページは説明用 UI であり、ページ内で得点保存や判定処理は行わない。

## 7. 実装整合メモ

- ルール説明ページの文言は `正解 = HIDE 数` で実装されている。
- 一方、現行の `/blank25/[problemId]?mode=sakumon` 本体は正解時スコアを `表示数` で計算する。
- つまり、2026-03-09 時点では説明ページのコピーとゲーム本体の採点定義はコード上で未統一である。
- 本仕様書は、ルール説明ページの実装と BLANK25 本体の現行仕様差分をそのまま記録する。

## 8. 制約

- 盤面デモはすべてローカル state で完結する。
- 入力フォームは持たない。
- モバイルでは縦積みレイアウトを優先し、盤面は正方形を維持する。
- ページのメタタイトルは `BLANK25 チーム戦ルール`。
