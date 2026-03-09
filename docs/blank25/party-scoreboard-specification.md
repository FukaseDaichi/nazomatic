# BLANK25 パーティ得点表示仕様書（実装準拠 / 2026-03-09）

## 1. 目的

- `/blank25/party` で、BLANK25 のチーム戦や個人戦の得点をローカル管理する。
- 上位 3 組を 3D ステージとひな壇カードで強調し、得点管理を観戦用 UI としても成立させる。
- 保存先は `localStorage` のみとし、認証・サーバー保存・端末間同期は持たない。

## 2. スコープ

### 2.1 対象

- ルート `/blank25/party`
- `/blank25` 一覧ページからの導線カード
- 参加者の追加、名前変更、種別変更、アイコン設定
- 得点の加減点、直接入力、Undo
- 上位 3 組の 3D 表彰台表示
- GM タイマー
- `localStorage` 永続化、旧バージョン保存データの移行、破損データの初期化

### 2.2 対象外

- 複数端末同期
- ユーザー認証
- サーバー API / DB 保存
- SNS 共有
- 複数ボード切替
- 得点の自動集計ルール

## 3. ルートと実装ファイル

- ページ: `src/app/(blank25)/blank25/party/page.tsx`
- 本体: `src/components/blank25/party-scoreboard.tsx`
- ひな壇カード: `src/components/blank25/party-podium.tsx`
- 3D ステージ: `src/components/blank25/party-podium-scene.tsx`
- 参加者アバター: `src/components/blank25/party-avatar.tsx`
- 保存処理: `src/components/blank25/party-storage.ts`
- 型定義: `src/components/blank25/party-types.ts`
- 導線追加: `src/components/blank25/problem-list.tsx`

## 4. 画面仕様

### 4.1 表示条件

- `window.matchMedia("(min-width: 1024px)")` を用いて PC 表示のみ本体を描画する。
- 1024px 未満では「PC 専用ステージ」カードと `/blank25` への戻り導線のみを表示する。
- 初回 hydrate 前はローディングカードを表示する。

### 4.2 上段ステージ領域

- 左上に `/blank25` へ戻るボタンを置く。
- 右上に `GMタイマー` ボタンと `PC 専用` バッジを置く。
- 中央に `@react-three/fiber` / `@react-three/drei` ベースの 3D 表彰台を表示する。
- 3D ステージ下に上位 3 組の情報カードを表示する。
- 参加者数、トップ得点、単独トップ / 同点数、最終更新時刻、ステータスメッセージをヘッダー内に表示する。

### 4.3 参加者一覧

- 参加者は得点順でカード表示する。
- 各カードには以下を表示する。
  - 順位
  - 種別バッジ
  - 同点バッジ
  - アバターまたはモノグラム
  - 名前編集入力
  - 種別切替
  - 現在得点
  - `-1`, `+1`, `+5`
  - 直接入力と `反映`
  - 削除ボタン

### 4.4 スコアログ

- 得点変更履歴は新しい順に最大 10 件表示する。
- 各ログには `加減点` / `直接編集`、参加者名、`from -> to`、差分値、時刻を表示する。
- 参加者情報が引けないログは、参加者名を `削除済みの参加者` と表示する。

### 4.5 操作デッキ

- 下段に参加者追加フォームと一括操作ボタンを配置する。
- 追加フォーム項目:
  - 種別トグル
  - アイコン設定
  - 名前
  - 初期得点
  - `追加`
- 一括操作:
  - `1つ戻す`
  - `全員 0 点`
  - `初期化`
- `全員 0 点` と `初期化`、参加者削除は確認ダイアログを経由する。

## 5. 振る舞い

### 5.1 参加者管理

- 参加者種別は `group` / `person`。
- 名前は trim 後の値を使い、大小文字を無視した重複を禁止する。
- 参加者追加後は名前、初期得点、追加用アイコン入力を初期化する。
- 名前変更と種別変更は参加者レコードだけを更新し、スコアイベントには記録しない。

### 5.2 アイコン

- 参加者ごとに任意の画像アイコンを設定できる。
- 画像はクライアント側で 192x192 にクロップ相当の縮尺変換を行い、`image/webp` へ再エンコードする。
- 出力 Data URL が `280_000` 文字を超える画像はエラー扱いにする。
- アイコン未設定時は名前先頭 2 文字のモノグラムを表示する。

### 5.3 得点更新

- `+1`, `+5`, `-1` は `delta` イベントとして記録する。
- 直接入力は `set` イベントとして記録する。
- 得点は `coerceBlank25PartyScore` で有限数かつ整数へ丸める。
- `1つ戻す` は最後のスコアイベント 1 件だけを逆適用する。
- 参加者削除時はその参加者に紐づくスコアイベントも削除する。
- `全員 0 点` は参加者を残したまま全得点を 0 にし、イベント履歴を全消去する。
- `初期化` は参加者、履歴、追加フォーム状態、`localStorage` をまとめて消去する。

### 5.4 ランキング

- 並び順は `score` 降順、`createdAt` 昇順、最後に `name.localeCompare("ja")`。
- 同点者は同順位として扱い、`1, 2, 2, 4` のように順位を導出する。
- 上位 3 組を `slot 1..3` に割り当て、3D ステージとひな壇カードに反映する。

### 5.5 首位演出

- hydrate 完了後、単独首位が前回から別参加者へ変わったときだけ `fireBlank25Confetti()` を実行する。
- 同点トップ時は単独首位判定を行わない。
- 紙吹雪処理は `prefers-reduced-motion: reduce` を尊重する。

## 6. GM タイマー

- タイマーは別ダイアログで開く。
- 初期値は 3 分。
- プリセットは `30秒`, `1分`, `3分`, `5分`。
- 手入力で `分` / `秒` を設定でき、最大は `99:59`。
- 操作は `開始`, `一時停止`, `リセット`。
- 終了時は音や自動遷移は行わず、ステータスメッセージに `GMタイマーが終了しました。` を表示する。

## 7. 永続化仕様

### 7.1 `localStorage` キー

- 現行キー: `blank25:party-score:v2:default`
- 旧キー: `blank25:party-score:v1:default`

### 7.2 永続化スキーマ

```ts
type Blank25PartyParticipant = {
  id: string;
  name: string;
  kind: "group" | "person";
  score: number;
  iconDataUrl: string | null;
  createdAt: number;
  updatedAt: number;
};

type Blank25PartyScoreEvent = {
  id: string;
  participantId: string;
  mode: "delta" | "set";
  delta: number;
  fromScore: number;
  toScore: number;
  createdAt: number;
};

type Blank25PartyPersistedStateV2 = {
  version: 2;
  updatedAt: number;
  participants: Blank25PartyParticipant[];
  events: Blank25PartyScoreEvent[];
};
```

### 7.3 読み込みと移行

- 読み込み時はまず `v2`、なければ `v1` を参照する。
- `v1` データは `iconDataUrl: null` を補完して `v2` 形式へ移行する。
- JSON 破損、型不正、`version` 不一致時は `v1` / `v2` の両キーを削除し、空状態へ戻す。
- 破損データから復旧した場合は UI に初期化メッセージを出す。

### 7.4 保存

- hydrate 完了後、状態変更ごとに `v2` キーへ保存する。
- 保存成功時は旧 `v1` キーを削除する。
- 保存失敗時は `保存に失敗しました。` のステータスメッセージを表示する。

## 8. 制約

- デスクトップ専用 UI であり、モバイル向け編集画面は提供しない。
- ボードは 1 つ固定で、複数ボードの切替 UI はない。
- 履歴は最大 10 件だけを表示するが、永続化上は全イベントを保持する。
