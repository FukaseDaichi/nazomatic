# BLANK25 TODO / 未確定事項（2026-02-09）

## 未確定（先に決めたい）

1. **`problems.json` の仕様**
   - フィールド（`linkName`, `imageFile`, `answers`）
   - 並び順のルール（JSON の順を表示順）
2. **表記ゆれの扱い**
   - `answers` にすべて列挙する
3. **正解後の UX**
   - そのまま盤面固定 + スコア表示 + 次の問題へ導線

## 実装タスク（順序案）

1. `public/data/blank25/problems.json` を作成（問題定義 + 複数回答/表記ゆれ）
2. `/blank25` に問題リンク一覧を実装（クリックで問題を選択）
3. `/blank25/[problemId]` と `Blank25Game` UI を実装（画像上に 5×5、残り枚数）
4. 回答入力 + 正誤判定（`answers` と照合 + 正規化）を実装
5. リセット・永続化（localStorage）を追加
6. `features.json` に導線追加、必要なら `Article` の index/JSON-LD を整合
