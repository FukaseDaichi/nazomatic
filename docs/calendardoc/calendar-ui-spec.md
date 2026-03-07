# 謎チケカレンダー UI 仕様（実装準拠 / 2026-03-07）

## 1. 概要

- 対象画面: `/calendar`
- 実装コンポーネント: `src/components/calendar/CalendarPageClient.tsx`
- 表示対象: Firestore `realtimeEvents` を `/api/calendar` 経由で取得したイベント

## 2. 現在の画面構成

### 2.1 ヘッダ

- タイトル: `謎チケカレンダー`
- Help tooltip で注意事項を表示
- 月見出し表示
- 最終更新時刻表示
- 読み込み中 / 失敗状態のバッジ表示

### 2.2 操作バー

- 前月 / 次月ボタン
- `今日` ボタン
- クエリ切替ドロップダウン
  - `#謎チケ売ります`
  - `#謎解き同行者募集`
  - `#謎チケ譲ります`
- `rawPostText` に対するテキスト絞り込み
- 再読み込みボタン

### 2.3 カレンダー本体

- 7 列 x 6 行の 42 セル固定グリッド
- 表示期間は `startOfWeek(startOfMonth(focusDate))` から 42 日
- 各セルの表示:
  - 日付
  - 当日ハイライト
  - イベント件数バッジ
  - 先頭 3 件までのイベントボタン
  - 4 件目以降は `+N 件`
- イベントボタン押下で詳細ダイアログを開く

### 2.4 詳細ダイアログ

- 日付単位でイベント一覧を表示する
- 同日の別イベントへ切り替え可能
- `selectedEventId` を持ち、現在のイベントを切り替える
- `eventMap` から詳細情報を参照する

## 3. データ取得とキャッシュ

### 3.1 クライアント

- hook: `src/hooks/useCalendarData.ts`
- キャッシュ方式: module-scoped `Map`
- TTL: 1 分
- キャッシュキー: `JSON.stringify({ query, from, to, rangeDays })`
- `refresh()` は強制再取得を行う

### 3.2 サーバー API

- endpoint: `GET /api/calendar`
- runtime: `nodejs`
- `dynamic = "force-dynamic"`
- `Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=300`
- 上限:
  - `rangeDays <= 60`
  - `MAX_RESULTS = 500`

## 4. 検索・絞り込み仕様

- サーバー側:
  - `query` は `sourceQuery` に一致するイベントを返す
  - `from` / `to` で `eventTime` 範囲を絞る
- クライアント側:
  - `textFilter` は `rawPostText.toLowerCase().includes(...)` で絞る

## 5. UI / UX の実装ルール

- モバイル優先。日セルは `min-h-[90px]`、デスクトップは `min-h-[110px]`
- 1 日内のイベントは時刻順サマリ表示
- `needsReview=true` のイベントはアンバー系で強調する
- 最新取得から 1 時間超なら stale 表示を赤系に切り替える

## 6. 現状の制約

- 週表示 / 月表示の切替は未実装。月間 42 セル表示のみ
- `navigator.share`、Web Push、オフライン永続化は未実装
- API 結果は 500 件で打ち切る
