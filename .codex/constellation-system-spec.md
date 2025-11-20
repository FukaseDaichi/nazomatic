# 星座システム仕様（2025-11-19）

## 1. 目的と背景
- 既存の `PrefectureSearchTableComponent` に近い検索テーブル UI を踏襲し、星座データを高速にフィルタリングできるツールを新設する。
- 初期表示は 12 星座（黄道十二宮）を対象とし、タブ切り替えで春夏秋冬・88 星座ビューへ拡張できるようにする。
- ひらがなでのあいまい検索とワイルドカード（？／＊）を利用した部分一致検索を提供し、星座名を覚えていないユーザーでも目的の星座に到達できるようにする。

## 2. 想定ユーザーと利用シナリオ
- ナゾトキ／謎制作時に星座名や季節を素早く確認したい参加者。
- 12 星座占い等の題材を扱う制作者が読み仮名を確認したいケース。
- 88 星座全体を俯瞰して季節分類を整理したい学習用途。

## 3. 表示モードとデータスコープ
| タブ ID | ラベル | デフォルト? | 含めるレコード | メモ |
| --- | --- | --- | --- | --- |
| `zodiac` | 12星座 | ✅ | 黄道十二宮 12 件のみ | アプリ初期表示。
| `spring` | 春の星座 |  | 88 星座のうち春象限（RA 6h〜12h）の代表 15〜20 件 | 数はデータで調整可能。視認しやすい主要星座を優先。
| `summer` | 夏の星座 |  | 同上（RA 12h〜18h）|
| `autumn` | 秋の星座 |  | 同上（RA 18h〜24h）|
| `winter` | 冬の星座 |  | 同上（RA 0h〜6h）|
| `all` | 88星座 |  | 国際天文学連合 (IAU) が定義する 88 星座すべて | ボリューム多いため仮想スクロールやページングは不要、テーブルスクロールのみで可。

- 星座データは `src/lib/data/constellations.ts`（想定）に配列で保持。1 レコード構造:
  ```ts
  type Constellation = {
    id: string;          // スネークケース英字、key 用
    nameJa: string;      // 星座名（例: "おひつじ座"）
    nameKana: string;    // ひらがな（例: "おひつじざ"）
    latinName: string;   // ラテン名（例: "Aries"）
    abbreviation: string;// IAU 略称（例: "Ari"）
    season: "spring" | "summer" | "autumn" | "winter";
    isZodiac: boolean;
    visibleMonths: [number, number]; // 観測しやすい月の範囲（例: [3, 5]）
    description?: string; // 短いメモ（任意）
  };
  ```
- 88 星座データは静的 JSON から生成してもよいが、手作業で 12 星座データを優先して整備し、段階的に追加する運用を想定。

## 4. UI / UX 要件
- コンポーネント名案: `ConstellationSearchTable`。`"use client"` 宣言を付与し、都道府県システムと同じレイアウトスタイルを流用。
- 構成:
  1. 見出し: 「星座システム」。`<h1>` + Tailwind で中央寄せ（prefecture と統一）。
  2. タブ: shadcn/ui の `Tabs` またはボタン群で 5 種切り替え。タブのアクティブ状態は `useState` 管理。
  3. 検索フォーム: 1 つ目は「星座名ひらがな」入力。必要に応じて 2 つ目の補助検索（英語/略称）を将来的に追加できるようスペースを確保。
  4. 注意テキスト: 「＊=0文字以上, ？=1文字」など prefecture と同じコピーを再利用。
  5. テーブル: shadcn `Table` で下記列を持つ。
     - 季節 (sm 以上で表示)
     - 星座名（和名）
     - ひらがな (sm 以上)
     - ラテン名 / 略称
     - 観測しやすい時期（月範囲を `3〜5月` 形式で表示)
- レスポンシブ: モバイルでは列を削減（季節/ひらがな列を非表示）。スクロールは `overflow-x-auto`。
- 状態表示: フィルタ結果が 0 件のとき `TableRow` を 1 行だけ表示し「該当なし」を案内。

## 5. フィルタリング仕様
- `constellations` 配列をタブと検索の 2 段階でフィルタ。
  1. タブ: 選択中タブに応じて `isZodiac` / `season` / 全件絞り込み。
  2. 検索: `nameKana` を対象に `matchSearch` を実行。
- `matchSearch` 実装要件:
  - 空文字は true。
  - 入力値の全角 `＊` `？` を半角へ置換し、`*`→`.*`, `?`→`.` に変換。
  - ^$ で囲み、大文字小文字無視（`i` フラグ）。
  - try/catch で正規表現エラーを握りつぶし false を返す。
  - ひらがな正規化: 半角カナ・カタカナを `toHiragana`（`kana-conv` 等）で変換してからテストすると、ユーザー体験向上。prefecture 実装では行っていないが、本システムでは追加実装を推奨。
- 将来的な英語検索用に `latinName` も同アルゴリズムで検索対象に含められるよう関数を抽象化しておく。

## 6. ステートとハンドラ
```tsx
const [activeTab, setActiveTab] = useState<ConstellationTab>("zodiac");
const [kanaSearch, setKanaSearch] = useState("");
const tabbedConstellations = useMemo(() => filterByTab(constellations, activeTab), [activeTab]);
const filtered = useMemo(() => tabbedConstellations.filter((item) => matchSearch(item.nameKanaNorm, kanaSearchNorm)), [tabbedConstellations, kanaSearchNorm]);
```
- `nameKanaNorm` はデータ作成時に正規化済み文字列を保持しておき、レンダリング時に再計算しない。
- 88 星座が対象でもパフォーマンス問題は小さいが、`useMemo` で無駄な再計算を抑制。

## 7. アクセシビリティとコピー
- タブは `role="tablist"` を持つコンポーネントを使用、キーボード操作で切替可能にする。
- テーブル見出しは `<TableHead scope="col">` を徹底。
- ひらがな検索欄には `aria-label` を付与。
- 注意文言は `prefecture` コンポーネントと同じスタイル (`text-xs text-gray-400 text-center`) を再利用し、統一感を持たせる。

## 8. データ更新フロー
1. `.codex/constellation-system-spec.md`（本書）を元に初期 12 星座データを定義。
2. 88 星座リストは CSV/JSON からスクリプトで生成し、`scripts/seed-constellations.ts` で TypeScript 配列を出力する仕組みを用意すると保守が楽。
3. 四季タブの所属判定ルールを `season` フィールドで手動設定し、後続で調整可能にしておく。

## 9. リリース後チェックリスト
- `features.json` に星座システムのメタ情報（タイトル、説明、slug `constellation` 等）を追加。
- `/app/(main)/constellation/page.tsx` を作成し、`ConstellationSearchTable` を読み込む。
- Unit テスト: `matchSearch` のワイルドカード・全角半角混在ケースを 5 パターン以上用意。
- 88 星座データの校正: IAU 略称とラテン名のタイポをチェック。必要なら簡易スクリプトでバリデーション。

## 10. 既存都道府県システムとの差分まとめ
- 同一: クライアントコンポーネント構造、検索 UI、テーブルスタイル、ワイルドカード説明コピー。
- 追加: タブ UI、季節・英名表示列、データ量増加を踏まえた `useMemo` 最適化、カナ正規化。
- 削除/変更: 県庁所在地列は存在しないため、星座固有情報（ラテン名・観測時期）に置き換え。
