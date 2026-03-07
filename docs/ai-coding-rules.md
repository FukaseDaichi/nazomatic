# AI コーディングルール（必須）

## 1. 目的

この文書は、AI が `nazomatic` リポジトリでコードや UI を追加・修正するときの必須ルールを定義する。

**この文書のルールは必ず守る。明示的な例外指示がない限り逸脱しない。迷ったら確認する。**

## 2. 適用範囲

- AI が新規作成するコード
- AI が修正する既存コード
- 特に UI 実装、UI 修正、フォーム実装、フォーム修正

対象は新規画面だけでなく、AI が触る既存画面・既存コンポーネントも含む。

## 3. 必須ルール

### 3.1 デザイン整合

- 新規 UI / UI 修正は、NAZOMATIC の既存デザインルールを必ず踏襲する。
- ベースの見た目:
  - `bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセント:
  - `purple-400`
- 明示指示がない限り、既存のダークトーン + purple アクセントから外れる新規配色・新規トーンを導入しない。
- 既存コンポーネント、既存クラス、既存の視覚トーンを優先して再利用する。

### 3.2 モバイル入力拡大防止

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

## 4. 例外

- ユーザーが明示的に例外を要求した場合のみ、例外対応を検討してよい。
- 例外対応をする場合は、どのルールを外すのかを作業前に明示する。
- 例外が明示されていない状態で判断に迷う場合は、勝手に逸脱せず確認する。

## 5. 実装前チェック

- 今回触る UI は既存のダークグラデーション + `purple-400` に揃っているか。
- 新しい配色やトーンを無断で追加していないか。
- 今回触る文字入力系コントロールは、モバイル時 `16px` 以上になっているか。
- `Input` / `Textarea` / ネイティブ input の既定 `text-sm` に依存していないか。
