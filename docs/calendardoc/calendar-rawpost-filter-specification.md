# Calendar rawPostText フィルター仕様書（実装準拠 / 2026-03-07）

## 1. 対象

- 画面: `CalendarPageClient`
- 対象フィールド: `rawPostText`
- 目的: クライアント側で自由入力の部分一致フィルターを行う

## 2. フィルター仕様

- state:
  - `textFilter`
  - `normalizedFilter = textFilter.trim().toLowerCase()`
- 絞り込み条件:
  - `normalizedFilter === ""` のとき全件表示
  - それ以外は `event.rawPostText.toLowerCase().includes(normalizedFilter)` に一致したものだけ残す

## 3. データフロー

1. `/api/calendar` から `events` を取得する
2. `filteredEvents` を `useMemo` で生成する
3. `groupEventsByDate` と `eventMap` は `filteredEvents` を入力にして再計算する
4. カレンダーセルと詳細ダイアログはフィルタ済みデータだけを参照する

## 4. UI 仕様

- 操作バー内に入力欄を置く
- placeholder: `テキスト絞込`
- `aria-label`: `テキスト絞込`
- `Search` アイコン付きの 1 行 UI とする

## 5. 選択状態との整合

- フィルター変更後、現在の `selectedDateKey` または `selectedEventId` が残存データに存在しない場合は:
  - ダイアログを閉じる
  - `selectedDateKey = null`
  - `selectedEventId = null`

## 6. 非機能要件

- フィルターはクライアント内で完結し、API 呼び出し条件は変えない
- `useMemo` で不要な再計算を抑制する

## 7. 受け入れ条件

- 空文字では全イベントが表示される
- 一致文字列では該当イベントだけが残る
- 一致なしでも UI が崩れない
- 表示中イベントがフィルター対象外になった場合、詳細ダイアログは閉じる
