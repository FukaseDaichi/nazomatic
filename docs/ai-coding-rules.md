# AI コーディングルール（必須）

## 1. 目的

この文書は、AI が `nazomatic` リポジトリでコードや UI を追加・修正するときの必須ルールを定義する。

**この文書のルールは必ず守る。明示的な例外指示がない限り逸脱しない。迷ったら確認する。**

## 2. 適用範囲

- AI が新規作成するコード
- AI が修正する既存コード
- 特に UI 実装、UI 修正、フォーム実装、フォーム修正

対象は新規画面だけでなく、AI が触る既存画面・既存コンポーネントも含む。

## 3. コーディング原則

- **後方互換性は維持しない。** 互換レイヤー、フォールバック、マイグレーションを追加するのではなく、不要になった実装やコードパスは削除する。
- **現在の要件を完全に満たす、最もシンプルな実装を選ぶ。** 将来を見越した過剰な抽象化、設定、間接化は避ける。
- **コンポーネントはモジュール化し、関心事を明確に分離する。**
- **全体の複雑さを減らしたり、信頼性を高めたりできる場合は、実績があり継続的にメンテナンスされているライブラリを優先する。** 明確な理由がない限り、一般的な機能を自前で再実装しない。
- **新しい実装を書いたりパッケージを追加したりする前に、既にプロジェクトで使われている依存ライブラリを活用する。** 「そのライブラリには必要な機能がない」と決めつけず、まずドキュメントや型定義を確認する。

## 4. 必須ルール

### 4.1 デザイン整合

- 新規 UI / UI 修正は、NAZOMATIC の既存デザインルールを必ず踏襲する。
- ベースの見た目:
  - `bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセント:
  - `purple-400`
- 明示指示がない限り、既存のダークトーン + purple アクセントから外れる新規配色・新規トーンを導入しない。
- 既存コンポーネント、既存クラス、既存の視覚トーンを優先して再利用する。

### 4.2 モバイル入力拡大防止

- 文字入力系コントロールは、スマートフォン操作時に拡大しないよう、モバイル時フォントサイズを必ず `16px` 以上にする。
- 対象:
  - `Input`
  - `Textarea`
  - ネイティブの text-like input
    - 例: `type="text"`, `search`, `email`, `url`, `tel`, `password`, `number`
- 許容例:
  - `text-base`
  - `text-[16px]`
- PC のみ小さくしたい場合は、モバイル 16px 以上を維持したまま切り替える。
  - 例: `text-base sm:text-sm`
- shared primitive の既定値が `text-sm` でも、そのまま使わない。
  - `src/components/ui/input.tsx`
  - `src/components/ui/textarea.tsx`
  - 上記の既定値に依存せず、画面側で必ず上書きする。

#### 実装例

良い例:

```tsx
<Input className="text-base ..." />
<Textarea className="text-base sm:text-sm ..." />
<input type="text" className="text-[16px] ..." />
```

良くない例:

```tsx
<Input className="text-sm ..." />
<Textarea className="text-sm ..." />
<input type="text" className="text-sm ..." />
```

### 4.3 ファーストビューの入場アニメーション

- ファーストビューに入る要素の入場アニメーションに framer-motion を使わない。ハイドレーションが終わるまで要素が不可視になり LCP が悪化する。
- Tailwind のキーフレームを使う。
  - `fade-up`: 下からのフェードイン。LCP 候補にならない小さい要素向け
  - `fade-down`: ヘッダーの入場
  - `rise-up`: **LCP 要素向け**。`opacity` を動かさず `transform` のみ
- ファーストビューの大きなテキスト(LCP 要素になりうるもの)には `opacity` を 0 から動かすアニメーションを付けない。ブラウザが未描画として扱い、可視化されるまで LCP が計上されない。
- いずれも `motion-reduce:animate-none` を併記する。
- スクロールで初めて現れる要素は framer-motion の `whileInView` のままでよい。

### 4.4 アイコンの参照

- `import * as LucideIcons from "lucide-react"` と `require("lucide-react")[...]` は使わない。ツリーシェイキングが効かず全アイコンがバンドルに入る。
- `features.json` の `iconName` から引くときは `src/lib/feature-icons.ts` の `getFeatureIcon(iconName)` を使う。
- `features.json` にツールを追加したら `feature-icons.ts` にも登録する。

詳細と背景は [`system-design/architecture/frontend-performance.md`](./system-design/architecture/frontend-performance.md) を参照する。

## 5. 例外

- ユーザーが明示的に例外を要求した場合のみ、例外対応を検討してよい。
- 例外対応をする場合は、どのルールを外すのかを作業前に明示する。
- 例外が明示されていない状態で判断に迷う場合は、勝手に逸脱せず確認する。

## 6. 実装前チェック

- 今回触る UI は既存のダークグラデーション + `purple-400` に揃っているか。
- 新しい配色やトーンを無断で追加していないか。
- 今回触る文字入力系コントロールは、モバイル時 `16px` 以上になっているか。
- `Input` / `Textarea` / ネイティブ input の既定 `text-sm` に依存していないか。
- ファーストビューの要素に framer-motion の入場アニメーションを付けていないか。
- LCP 要素になりうる大きなテキストに `opacity: 0` 始まりのアニメーションを付けていないか。
- lucide アイコンを名前空間 import や `require` で引いていないか。
