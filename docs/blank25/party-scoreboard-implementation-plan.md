# BLANK25 パーティ得点表示機能 実装方針（2026-03-09）

## 1. 目的

- `/blank25` 配下に、チームまたは個人の得点をその場で管理できるローカル専用のパーティ機能を追加する。
- 得点管理だけでなく、1 位をひな壇風のステージに乗せて目立たせるエンタメ演出を入れる。
- 保存先は `localStorage` のみとし、認証・サーバー保存・別端末同期は行わない。
- この画面は PC 閲覧専用とする。

## 2. スコープ

### 2.1 対象

- 新規ページ `/blank25/party`
- `/blank25` から `/blank25/party` への導線追加
- グループ / 個人の参加者追加
- 参加者名、種別、得点の編集
- 加点 / 減点 / 直接入力による得点更新
- ランキング表示
- 1 位を中心にしたひな壇風の演出
- `localStorage` 永続化と破損データの安全な初期化

### 2.2 対象外

- 複数端末同期
- ユーザー認証
- サーバー API / DB 保存
- SNS 共有
- 複数ボード管理

## 3. 追加ルート方針

- 新規ルートは `/blank25/party` とする。
- `BLANK25` 既存のゲーム一覧とは責務が異なるため、問題一覧に混ぜず「パーティ得点表示」への専用 CTA を置く。
- ページ構成は既存と同様に `ArticleHeaderComponent` の下へクライアントコンポーネントを配置する。

想定ファイル:

- `src/app/(blank25)/blank25/party/page.tsx`
- `src/components/blank25/party-scoreboard.tsx`
- `src/components/blank25/party-podium.tsx`
- `src/components/blank25/party-storage.ts`
- `src/components/blank25/party-types.ts`
- `src/components/blank25/problem-list.tsx` の導線追加

## 4. UX コンセプト

- 見た目は NAZOMATIC 既存ルールを維持し、`bg-gradient-to-b from-gray-900 to-gray-800 text-white` をベースにする。
- アクセントは `purple-400` を主役にし、派手さは配色追加ではなくレイアウト・光・アニメーションで出す。
- 画面最上部中央は three.js ベースの 3D 表彰台を主役にする。
- 1 位は中央で一段高いひな壇、2 位と 3 位は左右で低めの台に配置する。
- 4 位以下は下段のスコアカード一覧に流し、操作性を優先する。
- 説明文は置かず、HUD 的な短いラベルに寄せる。

## 5. 画面構成案

### 5.1 ヘッダー領域

- ページタイトル
- 最小限のステータス表示
- 戻る導線

### 5.2 ひな壇ランキング領域

- `react-three/fiber` + `@react-three/drei` による 3D podium scene を表示
- 上位 3 名を podium 形式で表示
- 1 位は王冠アイコン、発光ボーダー、スコア大きめ表示
- 首位交代時のみ紙吹雪または軽いステージ演出を実行
- 同点時は `同点` バッジを出し、コピーは「単独首位」ではなく「トップ帯」に切り替える

### 5.3 下段コントロール領域

- 参加者追加フォーム
- `全員の得点を 0 にする`
- `ボードを初期化する`
- `直前の操作を取り消す`
- 種別: `グループ` / `個人`
- 名前
- 初期得点
- 追加ボタン

### 5.4 参加者一覧

- 名前
- 種別バッジ
- 現在得点
- クイック操作 `+1`, `+5`, `-1`
- 数値直接編集
- 名前編集
- 削除

一覧は常に得点順で並べるが、操作中に視認性が落ちないようカード単位で情報を完結させる。

### 5.5 履歴領域

- 最新の得点変更履歴を新しい順で表示
- `誰に`, `いくつ`, `いつ` を簡潔に見せる
- `直前の操作を取り消す` を付ける

履歴を持たせることで「得点の編集や追加」を単なる数字上書きだけで終わらせず、運用ミスを戻せるようにする。

## 6. データ設計

### 6.1 `localStorage` キー

- `blank25:party-score:v1:default`

`default` を末尾に含めておき、将来的に複数ボードへ拡張する余地だけは残す。

### 6.2 永続化スキーマ

```ts
type Blank25PartyPersistedStateV1 = {
  version: 1;
  updatedAt: number;
  participants: Blank25PartyParticipant[];
  events: Blank25PartyScoreEvent[];
};

type Blank25PartyParticipant = {
  id: string;
  name: string;
  kind: "group" | "person";
  score: number;
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
```

### 6.3 保存方針

- React state を正本にし、変更のたびに `localStorage` へ保存する。
- 初回表示時は `useEffect` で hydrate する。
- JSON 破損時、`version` 不一致時、型不正時は既存 `BLANK25` と同じ考え方で復元を諦めて初期状態へ戻す。
- ランキングは保存せず、`participants` から毎回導出する。

## 7. ランキングと演出ルール

### 7.1 並び順

- 基本並び順は `score` 降順
- 同点時は `createdAt` 昇順
- 表示順位は導出値とし、同点者には `同点` バッジを出す

### 7.2 首位演出

- 前回の単独首位と今回の単独首位が変わったときだけ演出を出す
- 演出は既存の `fireBlank25Confetti` を再利用する
- `prefers-reduced-motion: reduce` は尊重する

### 7.3 ひな壇 UI

- 1 位: 中央、最大サイズ、`purple-400` リング、スコア強調
- 2 位: 左、やや低い台
- 3 位: 右、やや低い台
- 4 位以下: 下段カードリスト

派手さは必要だが、新規配色を増やさず `gray` + `purple` の中でスポットライト風の陰影を付ける。

## 8. 状態更新ルール

- `+1`, `+5`, `-1` は `delta` イベントとして記録する
- 直接入力による得点更新は `set` イベントとして記録する
- 名前変更と種別変更は participant 更新のみで履歴には含めない
- 参加者削除時は確認ダイアログを出し、関連イベントも同時に削除する
- `直前の操作を取り消す` は最後の `events` を逆適用する

## 9. 実装上の注意

### 9.1 PC 専用

- `min-width: 1024px` 未満では PC 専用メッセージのみ表示する
- 主要レイアウトはデスクトップ前提で密度高く構成する
- 上段に大きな 3D ステージ、下段に操作系を寄せる

### 9.2 既存 UI ルール

- ベースは `bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセントは `purple-400`
- 新しい配色トーンは持ち込まない
- 既存の `Card`, `Button`, `Input`, `Dialog`, `Tooltip` を優先して再利用する

### 9.3 実装責務

- 画面ロジックは `party-scoreboard.tsx`
- podium 表示は `party-podium.tsx`
- `localStorage` の parse / validate / load / save は `party-storage.ts`
- 型定義は `party-types.ts`

## 10. 段階的な実装手順

1. `/blank25/party` の新規ページと一覧導線を追加する。
2. `party-types.ts` と `party-storage.ts` を作り、永続化基盤を固める。
3. 参加者追加フォームと参加者一覧を実装する。
4. 加点 / 減点 / 直接編集 / 削除 / Undo を実装する。
5. 上位 3 名のひな壇 UI と首位演出を追加する。
6. 空状態、同点、データ破損、リロード復元を QA する。

## 11. 受け入れ条件

1. `/blank25/party` でグループまたは個人を追加できる。
2. 参加者名、種別、得点を後から編集できる。
3. クイック加点 / 減点と直接入力の両方で得点更新できる。
4. 得点更新後にランキングが即時反映される。
5. 1 位がひな壇風 UI で目立って表示される。
6. 首位交代時に過剰でない演出が入る。
7. リロード後に `localStorage` から状態復元できる。
8. スマホで入力時にブラウザ拡大が発生しない。
