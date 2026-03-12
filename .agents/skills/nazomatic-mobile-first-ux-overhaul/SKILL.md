---
name: nazomatic-mobile-first-ux-overhaul
description: Nazomatic repository-specific UI redesign and frontend implementation skill. Use when Codex needs to review, redesign, polish, or implement pages, components, tools, dashboards, forms, or interaction flows in `nazomatic`, especially for mobile-first UX improvements, bold layout rework, visual hierarchy cleanup, or progressive-disclosure help patterns that must be coded end-to-end while preserving the existing dark gradient + `purple-400` design system and the 16px mobile text-input rule.
---

# Nazomatic Frontend Design

## Core Thesis

Nazomatic の良いUIは、謎解きツールらしい高密度さと即時理解を両立させる。対象画面ごとに 1 つの明確な方向性を決め、既存のダークグラデーション + `purple-400` を土台に、タイポグラフィ、余白、導線、説明情報の出し方まで一貫したシステムとして実装する。

常設の長文説明で画面を重くしない。必要な情報は段階的に開示し、主操作を邪魔しない。

## 1. Operating Mode

コードを書く前に、必ず次の順で整理する。

1. **Context**: 対象ルート、対象コンポーネント、主タスク、利用頻度、モバイル時の操作姿勢、情報密度を確認し、問題設定を 1〜2 行で言語化する。
2. **Direction**: Section 2 から 1 つ archetype を選び、明示する。
3. **Differentiator**: 1 つだけ記憶に残る仕掛けを決める。レイアウトの癖、強い見出し、操作フィードバック、質感、ヘルプ導線のいずれかで作る。
4. **System**: 色の役割、余白リズム、強調ルール、説明情報の扱い、状態変化の見せ方を定義する。
5. **Implementation**: 構造と状態遷移を決めてから実装する。提案だけで止めない。

**Directive:** 方向性を 1 つに絞ってコミットする。複数スタイルを無難に混ぜて平均化しない。レビュー依頼でも、明示的にレビューのみと言われていない限り実装まで進める。

## 2. Nazomatic Archetypes

以下から 1 つ選び、基調にする。どの archetype を選んでも配色は Nazomatic の既存ルールから外さない。

- **Puzzle Console**: 操作面を主役にする。区切られたパネル、状態の強い切り替え、入力と結果の近接を使う。パズルツール、エディタ、入力密度の高い画面に向く。
- **Mystery Editorial**: 見出しと導入で空気を作り、本文は読みやすく段階表示する。ルール説明、導入ページ、ストーリー性のある画面に向く。
- **Arcade Utility**: 反応速度と高い可視性を重視する。アクティブ状態、成功体験、反復操作の気持ちよさを強める。ゲーム画面や変換ツールに向く。
- **Signal Board**: ステータス、ランキング、経過、比較をスキャンしやすく整理する。レポート、スコアボード、一覧性が重要な画面に向く。
- **Quiet Laboratory**: ノイズを減らし、入力と出力の因果関係を最短で見せる。検索や分析画面など、落ち着いた集中が必要な画面に向く。

## 3. Repository Constraints

### 3.1 Design System Lock

- `docs/ai-coding-rules.md` を最初に読み、必須ルールとして扱う。
- ベースは `bg-gradient-to-b from-gray-900 to-gray-800 text-white` を守る。
- アクセントは `purple-400` を軸にする。
- 既存の `src/components/ui/*`、既存クラス、既存トーンを優先して再利用する。
- 明示指示がない限り、新しい明色テーマ、新しい基調色、新しい世界観を持ち込まない。
- generic な hero -> cards -> testimonials のようなテンプレ構成を持ち込まない。対象画面の目的に合わせて構造を組み直す。

### 3.2 Mobile Input Rule

- 文字入力系コントロールは、モバイル時フォントサイズを必ず `16px` 以上にする。
- 対象は `Input`、`Textarea`、ネイティブの text-like input（`text`、`search`、`email`、`url`、`tel`、`password`、`number` など）。
- `text-base`、`text-[16px]`、`text-base sm:text-sm` のように、画面側で明示的に上書きする。
- `src/components/ui/input.tsx` と `src/components/ui/textarea.tsx` の既定 `text-sm` に依存しない。
- 数値入力、検索入力、フィルタ入力も例外にしない。

### 3.3 Progressive Disclosure

- 1 行で済む補助文だけを常設する。
- 2 行以上の使い方説明、例示、注意点、ルール説明は tooltip、popover、accordion、help panel などへ退避する。
- 参考実装として `src/components/graphpaper/graph-paper-component.tsx` と `src/components/calendar/HelpTooltip.tsx` を確認する。
- `@/components/ui/tooltip` を使う場合、既定の明色スタイルをそのまま使わず、Nazomatic のダークトーンへ `className` で寄せる。
- モバイルでは touch、PC では hover / focus で到達できるようにする。
- `aria-label`、十分なタップ領域、見切れにくい `max-w` と配置を設計する。

### 3.4 Composition and Hierarchy

- 画面を「導入」「主操作」「補助情報」の 3 層で整理する。
- モバイル起点でレイアウトを組み、横スクロールを避ける。
- 主操作を 1 つ決め、二次アクションはまとまりとして整理する。
- 強弱は大きさ、余白、コントラスト、密度差で作る。なんでも同じ重さで並べない。
- 余白は `4 / 8 / 12 / 16 / 24 / 32` を基準に揃える。
- 長い画面では sticky action や固定フィルタを検討し、指の移動量を減らす。
- 空状態、エラー状態、ローディング、成功状態も同じトーンで設計する。

### 3.5 Motion and Feedback

- モーションは状態変化、階層、操作可能性を伝える目的でのみ使う。
- `150ms` から `250ms` 程度の短い遷移を基本にする。
- 紫の glow、opacity、translate を控えめに使い、 generic なバウンスや装飾アニメーションを避ける。
- hover、focus、pressed、disabled の差がダークテーマ上で確実に見えるようにする。

### 3.6 Typography and Copy

- 文字サイズ、weight、tracking、case で 3〜5 段階の hierarchy を作る。
- 新しいフォント導入は慎重に行い、既存の空気を壊すなら見送る。まずはサイズとウェイト設計で差を作る。
- マイクロコピーは短く、行動を促し、曖昧な説明文を減らす。
- 説明を増やすより、操作と結果の対応を明快にする。

## 4. Execution Workflow

1. `docs/ai-coding-rules.md` を確認する。
2. 対象ルートまたは対象コンポーネントから関連ファイルを特定する。必要なら `src/app` と `src/components` を横断する。
3. 次の観点で現状を診断する。
   - 情報設計
   - 認知負荷
   - 操作導線
   - 視覚階層
   - モバイル到達性
   - アクセシビリティ
   - エラー / 空状態
4. archetype と differentiator を 1〜2 行で宣言する。
5. 残す情報、削る情報、段階表示へ移す情報を決める。
6. 最小限のトークン設計を決める。surface の役割、accent の比率、余白、radius、shadow / glow を揃える。
7. コードを実装する。既存コンポーネントの再利用を優先し、必要な場合だけ新規スタイルを追加する。
8. 変更した入力系コントロールが `16px` 以上になっていることを確認する。
9. tooltip / help UI が touch と keyboard の両方で使えることを確認する。
10. モバイル、タブレット、PC の順に見て、破綻を潰す。

## 5. Output Contract

作業結果では次を短く明示する。

- **Direction**: 選んだ archetype と differentiator
- **Key Issues**: 主要課題 3 件まで
- **Implementation**: 実際に変更した要点
- **Verification**: レスポンシブ、入力 16px、help UI、アクセシビリティの確認結果

## 6. Finish Checklist

- 選んだ archetype が全体の見た目と導線に反映されているか。
- differentiator が実装されているか。説明だけで終わっていないか。
- ダークグラデーション + `purple-400` のルールを守っているか。
- 触った text input / textarea / text-like input がモバイル時 `16px` 以上か。
- 長い説明文を常設せず、段階表示へ移せているか。
- モバイルでも主操作が迷わず届く位置にあるか。
- 既存 UI から浮く generic scaffolding が残っていないか。
