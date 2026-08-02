# フロントエンド描画・読み込み設計

トップページと共通ヘッダー、広告の描画順序と読み込み方式をまとめます。ここに書かれた構造は Core Web Vitals を満たすための設計判断であり、崩すと LCP・TBT・CLS が悪化します。

## 三層の背景(トップページ)

トップページの背景は 3 つのレイヤーで構成し、three.js を使うのは中間の canvas だけです。

| レイヤー | 実体 | 描画タイミング |
|---|---|---|
| 下地 | `HeroBackdrop`(`src/app/(main)/page.tsx` 内で定義) | SSR された初期 HTML から表示 |
| 3D | `ThreeHeroBackground` の `<canvas>` | アイドル時にマウント |
| 前面グラデーション | `HeroBackdrop` の 2 枚目 | SSR された初期 HTML から表示 |

制約:

- **`HeroBackdrop` を `three-hero-background.tsx` へ移してはいけません。** 同モジュールを静的 import すると `import * as THREE from "three"` ごとページの初期チャンクに戻り、`next/dynamic` による分割が無効になります。
- `ThreeHeroBackground` は `next/dynamic`(`ssr: false`)で読み込み、`useIdleMount()`(`requestIdleCallback`、非対応時は `setTimeout`)でマウントを遅らせます。
- レイヤーの重なりは `z-0`(下地)、`z-[1]`(canvas)、`z-[2]`(グラデーション)で明示します。本文は `z-10` です。

## three.js 描画ループの停止条件

`src/components/common/three-hero-background.tsx` の `requestAnimationFrame` ループは次の条件で止めます。

- `document.hidden` が真の状態でマウントされたときは開始しない。可視化されたときに `visibilitychange` から開始する。
- タブが非表示になったら停止し、再表示で再開する。再開時は `clock.getDelta()` を一度読み捨ててから回す(停止中に溜まった delta でオブジェクトが飛ぶのを防ぐ)。
- `prefers-reduced-motion: reduce` のときは初期化自体を行わない。
- 追加したリスナは `useEffect` のクリーンアップで解除し、既存の geometry / material / renderer の `dispose` を壊さない。

## ヘッダーの出し分けは CSS だけで行う

`HeaderComponent` を使うのは**トップページのみ**です。他の公開ページは `ArticleHeaderComponent` を全幅で直接使います。

- `HeaderComponent` はモバイル用とデスクトップ用の**両方を常に描画**し、`sm` ブレークポイントの CSS(`sm:hidden` / `hidden sm:block`)だけで切り替えます。
- `ArticleHeaderComponent` は任意の `className` を受け取り、ルートの `<header>` に連結します。`HeaderComponent` からは `sm:hidden` を渡します。
- **`ArticleHeaderComponent` のルートに `sm:hidden` を直接書いてはいけません。** 他ページのヘッダーが消えます。

JavaScript で `window.innerWidth` を見て出し分けると、SSR では必ずデスクトップ用が出力され、モバイル幅でハイドレーション後にヘッダーが差し替わってレイアウトシフトが発生します。この理由で `useState` / `useEffect` による出し分けは廃止しました。

## 入場アニメーションは CSS で行う

ファーストビューに入る要素の入場アニメーションに framer-motion を使うと、ハイドレーションが終わるまで要素が不可視のままになり LCP が悪化します。該当箇所は Tailwind のキーフレームで実装します。

| キーフレーム | 用途 |
|---|---|
| `fade-up` | 下からのフェードイン。LCP 候補にならない小さい要素向け |
| `fade-down` | ヘッダーの入場 |
| `rise-up` | **LCP 要素向け**。`opacity` を動かさず `transform` のみ |

- いずれも `motion-reduce:animate-none` を併記して `prefers-reduced-motion` に対応します。
- stagger は `[animation-delay:...]` で表現します。
- スクロールで初めて現れる要素(ツール一覧のカードなど)は framer-motion の `whileInView` のままで構いません。

`opacity` を 0 から動かすアニメーションを LCP 要素に付けると、ブラウザはその要素を未描画として扱い、可視化されるまで LCP が計上されません。ファーストビューの大きなテキストには `rise-up` を使います。

## アイコンの参照方法

`src/lib/feature-icons.ts` が `features.json` の `iconName` と lucide アイコンの対応表の正本です。

- `import * as LucideIcons from "lucide-react"` と `require("lucide-react")[...]` は使いません。ツリーシェイキングが効かず、全アイコンがバンドルに入ります。
- 参照は `getFeatureIcon(iconName)` を使います。未登録名は開発時に警告を出して `HelpCircle` を返します。
- `features.json` にツールを追加したら `feature-icons.ts` にも登録します。

## 広告の読み込み

`src/components/googleAd/google-ad-component.tsx` の `<Script>` は `strategy="lazyOnload"` で読み込み、ページ読み込み完了後に実行します。

- `<ins>` には `minHeight` を指定して、後から挿入される広告によるレイアウトシフトを防ぎます。
- 広告は `(main)` レイアウトの最下部に置きます。
- `NEXT_PUBLIC_BASE_URL` が localhost のとき、PWA(standalone)のとき、X 経由セッションのときは表示しません。ローカルでの広告動作確認には `NEXT_PUBLIC_BASE_URL` を本番 URL にしたビルドが必要です。

## 変更時の確認

- 上記の構造を変えたら Lighthouse を**同一条件で 3〜5 回実行し中央値**で比較します。単発の値では判断しません。
- ローカルで測る場合は `npm run build` + `npm start` の本番ビルドを対象にします(`npm run dev` の値は当てになりません)。
- バンドルサイズは `next build` の First Load JS を変更前後で比較します。
- 計測時は対象 URL、コミット、Lighthouse とブラウザのバージョン、フォームファクタ、スロットル設定、キャッシュ状態を記録します。
