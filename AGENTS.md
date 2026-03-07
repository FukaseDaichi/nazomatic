# NAZOMATIC Agent Rules

- `docs/ai-coding-rules.md` を、このリポジトリの AI 実装ルールの正本として扱うこと。
- UI 実装、UI 修正、フォーム実装、フォーム修正では、この文書を最優先で守ること。
- 必須ルール 1: NAZOMATIC の既存デザインルールを厳守すること。
  - ベース: `bg-gradient-to-b from-gray-900 to-gray-800 text-white`
  - アクセント: `purple-400`
  - 明示指示がない限り、別トーンの新規配色を導入しないこと。
- 必須ルール 2: 文字入力系コントロールは、モバイル時フォントサイズを必ず `16px` 以上にすること。
  - 対象: `Input`, `Textarea`, ネイティブの text-like input
  - 許容例: `text-base`, `text-[16px]`, `text-base sm:text-sm`
  - `src/components/ui/input.tsx` と `src/components/ui/textarea.tsx` の既定 `text-sm` に依存しないこと。
- 明示的な例外指示がない限り、上記ルールから逸脱しないこと。迷ったら確認すること。
