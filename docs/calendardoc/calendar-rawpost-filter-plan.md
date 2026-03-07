# CalendarPageClient rawPostText フィルター実装方針

## 目的
`CalendarPageClient` 上に簡易テキストフィルターを追加し、`rawPostText` に指定文字列が含まれるイベントのみをカレンダーと詳細モーダルに表示する。これにより、特定のワードや同行条件などを素早く絞り込めるようにする。

## 実装ステップ
1. **状態管理の追加**
   - `const [textFilter, setTextFilter] = useState("");` を追加し、空文字のときはフィルター無効扱いにする。
   - `useMemo` で `normalizedFilter = textFilter.trim().toLowerCase()` を計算し、フィルター文字列の大小区別を吸収する。

2. **データフィルタリング層**
   - 既存の `data?.events ?? []` から `filteredEvents` を `useMemo` で生成。
   - `rawPostText` を `toLowerCase()` し `normalizedFilter` を含むかを確認。空文字なら全件返却。
   - `groupEventsByDate` と `eventMap` はこの `filteredEvents` を入力にして再計算し、UI 全体がフィルタ済みデータを参照するようにする。

3. **UI コントロールの追加**
   - 既存のクエリ選択／更新ボタンの右側にテキスト入力欄を配置。`@/components/ui/input` と `lucide-react` の `Search` アイコンを再利用し、モバイルでも 1 行に収まるよう `flex-wrap` と幅制限クラスで調整。
   - プレースホルダは例: `"テキストで絞り込み"`。クリアしやすいよう `value` を state にバインドし `onChange` で更新。

4. **選択状態との整合**
   - `useEffect` を追加し、`filteredEvents` から現在の `selectedEventId` が見つからない場合は `selectedDateKey`/`selectedEventId` を `null` に戻し、モーダルを閉じる。これでフィルター変更時の不整合やエラーを防ぐ。

5. **アクセシビリティとパフォーマンス**
   - 入力欄に `aria-label` を追加し、スクリーンリーダー対応。
   - フィルターはフロントのみで完結するため API 呼び出し回数は変わらない。`useMemo` に `textFilter` と `data?.events` を依存させ、不要な再計算を避ける。

## テスト観点
- 空文字 → 全イベント表示。
- 存在する語句でフィルター → 該当日セルのみイベントが残ることを手動確認。
- 該当なし → カレンダーが空セルになるが UI は崩れない。
- フィルター適用中にイベントを選択し、フィルター文字列を変更してイベントが条件を満たさなくなった場合、モーダルが閉じること。
