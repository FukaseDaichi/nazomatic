# トップページ パフォーマンス改善計画

2026-08-02 に本番 `https://nazomatic.vercel.app/` へ Lighthouse CLI 13.4.1(モバイル設定・4x CPU スロットル・ヘッドレス Chrome)で計測した結果に基づく改善案。現行仕様ではなく、未着手の検討メモ。

## 計測結果サマリー

- パフォーマンススコア: **43 点** / アクセシビリティ: 94 点
- 内訳:

| 指標 | 実測値 | 評価(good 基準) |
|---|---|---|
| TTFB | 40ms | 良好(< 800ms) |
| FCP | 1.2s | 良好(< 1.8s) |
| LCP | 9.9s | 不良(< 2.5s) |
| TBT | 2,060ms | 不良(< 200ms) |
| CLS | 0 | 良好(< 0.1) |
| Speed Index | 5.3s | 不良(< 3.4s) |
| TTI | 12.8s | 不良 |

サーバー応答と CLS に問題はなく、原因はクライアント JS の実行に集中している。bootup-time 4.8 秒のうち約 4.05 秒が Three.js 背景を含む 1 チャンクの実行時間。

## 修正 1: ヒーローテキストの入場アニメーションを CSS 化する(最優先)

- 影響度: 高(LCP 9.9s → 約 1.5s 前後の見込み)
- 対象: `src/app/(main)/page.tsx`

### 問題

LCP 要素はヒーローの `<h2>謎を解き明かそう</h2>`。framer-motion の `initial="hidden"`(`opacity: 0; transform: translateY(18px)`)付きで SSR されるため、HTML 自体は 1.2 秒で描画可能なのに、ハイドレーション完了(修正 2 の 4 秒渋滞の後)までテキストが不可視のまま。FCP 1.2s と LCP 9.9s の乖離の正体。

### 修正方法

ヒーローセクション(`motion.section` / `motion.div` / `motion.h2` / `motion.p`)だけ framer-motion をやめ、CSS `@keyframes` に置き換える。SSR された HTML の時点でアニメーションが始まり、JS 実行を待たずにペイントされる。

1. `src/app/globals.css`(または Tailwind の `extend.keyframes`)に追加:

   ```css
   @keyframes hero-fade-up {
     from { opacity: 0; transform: translateY(18px); }
     to { opacity: 1; transform: none; }
   }
   ```

2. ヒーロー内の各要素を通常のタグに戻し、クラスでアニメーションを適用。stagger は `animation-delay` で再現する:

   ```tsx
   <section className="flex min-h-[55svh] ...">
     <div className="... animate-[hero-fade-up_0.6s_ease-out_both]">謎解き・パズル お助けツール集</div>
     <h2 className="... animate-[hero-fade-up_0.6s_ease-out_0.15s_both]">謎を解き明かそう</h2>
     <p className="... animate-[hero-fade-up_0.6s_ease-out_0.3s_both]">NAZOMATICで、...</p>
   </section>
   ```

3. `prefers-reduced-motion` 対応を CSS 側に追加する(`@media (prefers-reduced-motion: reduce)` でアニメーション無効化)。
4. ツール一覧カードの `whileInView` / `whileHover` は LCP に影響しないため framer-motion のままでよい。

### 検証

- `npm run build` 後に本番相当で Lighthouse を再計測し、LCP が 2.5s を下回ること。
- JS 無効(DevTools で JavaScript をブロック)でもヒーローテキストが表示されること。

## 修正 2: Three.js 背景の遅延マウントと描画コスト削減

- 影響度: 高(TBT 2,060ms・TTI 12.8s の主因)
- 対象: `src/components/common/three-hero-background.tsx`、`src/app/(main)/page.tsx`

### 問題

`ThreeHeroBackground` が初期チャンクに含まれ、マウント直後に以下を同期実行する。4x スロットル環境で単一チャンクの scripting が 4,053ms に達し、ハイドレーションとメインスレッドを占有する。

- 約 24 個の浮遊オブジェクトを `ExtrudeGeometry`(ベベル付き・`curveSegments: 20`)で生成
- `PMREMGenerator` による環境マップ生成
- `requestAnimationFrame` の常時描画ループ(タブ非表示・スクロールでヒーローが画面外でも停止しない)

three.js 本体チャンク(転送 172KB、うち 84KB 未使用)も初期ロードに入っている。

### 修正方法

1. **動的インポート + アイドル時マウント。** `page.tsx` で直接 import せず、`next/dynamic` で分離し、ブラウザがアイドルになってからマウントする:

   ```tsx
   const ThreeHeroBackground = dynamic(
     () => import("@/components/common/three-hero-background").then((m) => m.ThreeHeroBackground),
     { ssr: false }
   );

   function DeferredHeroBackground() {
     const [ready, setReady] = useState(false);
     useEffect(() => {
       const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
       const id = idle(() => setReady(true));
       return () => (window.cancelIdleCallback ?? clearTimeout)(id as never);
     }, []);
     return ready ? <ThreeHeroBackground /> : null;
   }
   ```

   背景表示前は既存の `bg-[#0a0812]` 固定レイヤーが下地になるため、視覚的な欠落は出ない(CLS 0 を維持)。

2. **ジオメトリ生成コストの削減。** `gearGeo` の `curveSegments: 20` → `8`、`bevelSegments: 2` → `1` に下げる。モバイル(`window.innerWidth < 640`)ではさらにオブジェクト数 14 → 10 程度へ。見た目の劣化は遠景配置のためほぼ視認できない。

3. **描画ループの停止制御。** `IntersectionObserver` でヒーロー領域(またはビューポート先頭)の可視状態を監視し、画面外では `cancelAnimationFrame`。`document.visibilitychange` でタブ非表示時も停止する。復帰時は `clock.getDelta()` を一度読み捨ててからループ再開する(大きな dt によるワープ防止)。

### 検証

- Lighthouse 再計測で TBT < 600ms(理想 < 200ms)、TTI の大幅短縮。
- 背景アニメーションの見た目・クリックバースト・マウス追従が維持されていること。
- `prefers-reduced-motion: reduce` で従来どおり描画されないこと。

## 修正 3: lucide-react の全量インポートを解消する

- 影響度: 中(ページチャンク 132KB 中、約 37KB が未使用と検出)
- 対象: `src/app/(main)/page.tsx`、`src/components/common/header-component.tsx`、`src/components/common/article-header-component.tsx`

### 問題

3 ファイルで `import * as LucideIcons from "lucide-react"` としており、ツリーシェイキングが効かない。`src/lib/json/features.json` の `iconName` 文字列から動的にアイコンを引くための実装だが、全アイコンがバンドルに含まれる。

### 修正方法

使用アイコンだけの明示的なマップを 1 か所に作り、3 ファイルから参照する。

1. `src/lib/feature-icons.ts` を新設:

   ```ts
   import { Dices, Grid3x3, Star /* features.json の iconName を全列挙 */ } from "lucide-react";
   import type { LucideIcon } from "lucide-react";

   export const featureIcons: Record<string, LucideIcon> = {
     Dices,
     Grid3x3,
     Star,
     // ...
   };
   ```

2. 各ファイルの `LucideIcons[feature.iconName as keyof typeof LucideIcons]` を `featureIcons[feature.iconName]` に置き換える。未登録名のフォールバック(例: `HelpCircle`)を 1 つ決めておく。
3. `features.json` は top ページカード・ヘッダーナビ等の順序付き正本(`AGENTS.md` 参照)なので、JSON 側は変更しない。アイコン追加時は `feature-icons.ts` への登録を必須とし、その旨をこの節か `ai-coding-rules.md` に追記する。

### 検証

- `npm run build` の First Load JS が減少すること。
- 全ツールカード・ヘッダーアイコンナビのアイコンが欠けずに表示されること(`features.json` の全 `iconName` がマップに存在するかを目視または簡易スクリプトで確認)。

## 修正 4: AdSense / Funding Choices の読み込み遅延(収益影響の検討が必要)

- 影響度: 中(サードパーティで約 360KB の未使用 JS、メインスレッド約 500ms)
- 対象: AdSense スクリプトを読み込んでいるレイアウト/コンポーネント

### 問題

`adsbygoogle.js`・`show_ads_impl`(単体で 117KB 無駄)・Funding Choices(同意メッセージ)が初期ロードで走る。計測に現れた Noto Sans JP の Google Fonts CSS 2 本(89KB + 59KB)は Google の同意メッセージ側が読み込むもので、コードベース起因ではない。

### 修正方法

- `next/script` の `strategy="lazyOnload"`(ページロード完了後に読み込み)へ変更するのが最小の緩和策。すでに `afterInteractive` の場合も `lazyOnload` へ落とす。
- 広告枠に CSS で最小高さを確保し、遅延読み込みで CLS が発生しないことを確認する。

### 留意点

- 表示タイミングの遅れがインプレッション/収益に影響しうるため、適用前に判断が必要。修正 1〜3 だけでもスコア改善の大半は得られる。
- 同意メッセージ(Funding Choices)は法令要件のため遅延しすぎないこと。

## 修正 5: モバイルメニューボタンの accessible name(アクセシビリティ)

- 影響度: 低(アクセシビリティ唯一の失格項目 `button-name`)
- 対象: `src/components/common/header-component.tsx`

### 問題

ハンバーガーボタン `<button class="md:hidden text-white focus:outline-none">` にアクセシブルネームがなく、スクリーンリーダーで用途が伝わらない。

### 修正方法

```tsx
<button
  aria-label="メニューを開く"
  aria-expanded={isMenuOpen}
  className="md:hidden text-white focus:outline-none"
>
```

開閉状態に応じて `aria-label` を「メニューを閉じる」へ切り替えるか、`aria-expanded` の併用で状態を伝える。

## 対応しない項目

- **レンダーブロッキング CSS(約 320ms)**: Next.js 標準の CSS 配信によるもので、修正 1・2 適用後の LCP には実質影響しない。個別対応不要。
- **Google Fonts(Noto Sans JP)の重複読み込み**: コードベースに読み込み箇所がなく、Funding Choices 由来のためサイト側では制御できない。

## 実施順序と期待効果

1. 修正 1(CSS アニメ化)→ LCP 改善の大半
2. 修正 2(Three.js 遅延 + 軽量化)→ TBT/TTI 改善の大半
3. 修正 3(lucide マップ化)→ バンドル削減
4. 修正 5(aria-label)→ アクセシビリティ 100 点
5. 修正 4(広告遅延)→ 収益影響を判断してから

修正 1 + 2 でモバイルスコア 43 → 80 前後、全適用で 85+ を見込む。各修正後は `npm run lint` と Lighthouse 再計測(`npx lighthouse https://nazomatic.vercel.app/ --output=json --only-categories=performance,accessibility --chrome-flags="--headless=new"`)で確認する。
