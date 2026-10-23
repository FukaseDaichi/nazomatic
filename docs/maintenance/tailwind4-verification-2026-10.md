# Tailwind CSS 4移行の検証記録

PR #91で別途対応としたTailwind 3依存の脆弱性と表示互換性を、ローカル環境で確認した記録。監査は2026-10-23、画面確認は同日から実施（Node.js 24.19.0、Next.js 15.5.28、Chromium、Playwright）。本番への反映は含まない。

## 変更

- Tailwind CSS / `@tailwindcss/postcss` 4.3.3、`tailwind-merge` 3.7.0へ更新。
- CSS設定へ一本化し、shadcnの設定参照も更新。`tailwindcss-animate`は既存版を`@plugin`で使用。
- 使用中の色・sRGB補間・class方式のdark variant・入場アニメーションとaccordionアニメーションを維持。
- `container`は中間ブレークポイントで幅を制限せず、1400px以上で最大1400pxにする既存仕様を維持。
- 影・角丸・blur・outline・透過率のクラス名を移行。フォームのラベル下余白、レスポンシブ文字サイズの行高、文字カウント、レポート一覧の間隔を明示。
- `w-90`、`lg:grid-cols-13`、`w-1/10`と一部の透過率指定はv3で未生成だったため削除。v4での新規適用による表示変化を避けた。
- `npm audit`のCI失敗条件をCriticalからModerateへ引き下げ。

## 依存監査

| 対象 | 移行前 Critical / High / Moderate | 移行後 Critical / High / Moderate |
|---|---|---|
| 全依存 | 0 / 0 / 3 | 0 / 0 / 0 |
| `--omit=dev` | 0 / 0 / 3 | 0 / 0 / 0 |

移行前後を同じregistry情報で比較した。PR #91当時のHighは現行の監査では再現しなかった。ESLint経由の`braces@3.0.3`は依存に残るが、今回の監査指摘はない。Tailwind 3 / `postcss-nested` / parser 6への依存経路は除去できた。`npm audit fix --force`、parserのメジャーoverride、ESLintのメジャー更新は行っていない。

## 表示・操作

移行前後のローカルdevelopment serverを、幅390px・1440px、高さ900px、reduced motion、同一Chromiumで撮影し、画像とDOMの位置・サイズ・色・角丸・フォントを比較した。17ルート×2画面幅の34組を確認した。変化した余白・列数・行高は修正後に撮り直した。実行時刻やチュートリアルのランダム表示は画像差分から切り分けた。

| 画面 | 確認内容 |
|---|---|
| `/` | ヘッダー、ヒーロー、機能カード、グラデーション |
| `/anagram`、`/character-pick-search`、`/shift-search` | 入力、検索条件、フォーム余白、タブ、結果領域 |
| `/shift-search/reports` | デスクトップ表・モバイルカード、注意書き、リンクなしカードの余白 |
| `/prefectures`、`/constellation`、`/alphabet` | 表・タブ・文字盤、既存のレスポンシブ列数 |
| `/graphpaper`、`/dice`、`/shiritori` | 操作領域、展開図、文字盤、文字カウント |
| `/calendar` | カレンダー枠・ヘルプ・フィルター、取得エラー時の表示 |
| `/blank25`、`/blank25/party`、`/blank25/party/rules` | 問題一覧枠、表彰台、ルールとチュートリアル |
| `/secret/christmas`、`/secret/ponpoppo/1` | 配色、フォーム、クイズ表示 |

追加で両画面幅の入力フォーカス、Radix Select開閉、しりとり結果Dialogの開閉を確認。モバイルのナビゲーションも開閉した。入力の16px以上を確認し、フォーカスリング・ポップアップ・ダイアログを撮影した。サイコロは外部フォント取得を許可してWebGL contextと実描画を確認し、これらの操作シナリオではページ例外0件だった。

静的比較では外部通信を遮断したため、サイコロの外部フォント取得は失敗する。これは移行前後共通で、上記の追加検証では成功した。広告の通信は表示・操作確認中も遮断した。

## コマンドとproduction確認

- `npm ci --no-audit --no-fund`: force / legacy-peer-depsなしで成功。
- `npm run lint`: 成功。
- `npm run build`: 成功、56静的ページを生成。
- `npm run test:security`: 2件成功。
- 移行時の`npm run test:x-browser-posting`: 105件成功。その後mainへ入ったPR #97でX投稿機能とテストが削除されたため、最終統合版では再実行対象外。
- `npm audit --json` / `npm audit --omit=dev --json` / `npm run audit:production`: 指摘0件、正常終了。
- `npm run start`後、レポート一覧・表彰台・ルールを両幅で撮り直し、移行前とmain領域の位置・幅・高さが一致、横はみ出しとページ例外なし。
- productionでも入力・Select・Dialog・WebGLの操作確認を再実行し、ページ例外0件。Dialogは開閉アニメーションと中央配置のtranslateが二重適用されないよう、配置もtransformに統一し、各幅22フレームで中心位置を確認した。
- 768px幅のcontainerが中間ブレークポイントで縮まないことと、`.dark`の付け外しで共通色が切り替わることを確認した。

## 検証範囲の制約

- Firebase / GitHubの本番credentialは未設定。カレンダーの実データ取得、BLANK25のstorage読込・Editor更新操作は検証していない。
- Christmasページの既存hydration警告は移行前後とも再現した。今回新しく発生したものではない。
- 実ブラウザ確認はChromiumのみ。Tailwind 4が要求するSafari 16.4 / Chrome 111 / Firefox 128以降を対応下限とする。
- ローカル画像・監査JSONは`local/tailwind4-verification/`に保存（Git管理対象外）。

## レビュー

Codex CLIの`codex review --uncommitted`は認証401で完了しなかった。別Codexエージェントによる差分レビューで、variantの適用順、container幅、inlineラベルとspace余白、v4で新規生成されるクラス、文字列置換時の空白・クラス名破損を確認し、指摘を修正した。
