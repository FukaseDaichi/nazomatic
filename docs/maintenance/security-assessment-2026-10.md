# セキュリティ調査（2026-10-21）

対象は commit `4842988` の Next.js 14.2.35 / React 18 / Node.js 24 構成。公式情報、package-lock、全 API の認証呼び出し、middleware、サーバー側 fetch を確認した。侵入有無や本番環境の設定・アクセスログの監査は含まない。

## 必要な対策と実施内容

| 優先度 | 対策 | 実装・判断 |
|---|---|---|
| 最優先 | サポート対象かつ修正済みの Next.js へ移行 | 15.5.28 / eslint-config-next 15.5.28。App RouterのReact 19に合わせ、React / DOM 19.3.1、fiber 9、drei 10、react-spring 10、React 19対応のlucide-reactと型定義を更新。非同期 params API に移行 |
| 最優先 | 画像最適化の RCE / SSRF 修正を取り込む | Next.js 更新、lockfile の sharp 0.35.5 を確認。remotePatterns は GitHub 全体から `FukaseDaichi/nazomatic-storage/**` に限定 |
| 高 | middleware に依存した Editor API の認証を解消 | manifest / publish の Route Handler 冒頭でも Basic 認証。定数時間比較、未設定503、認証失敗レスポンス no-store |
| 高 | Editor mutation の CSRF 対策 | Origin 不一致・空・null、Sec-Fetch-Site cross-site を拒否。ブラウザ以外の Origin なしクライアントは認証必須で許可 |
| 高 | Host / x-forwarded-* を信用した外向き fetch の除去 | ponpoppo は同梱 JSON を直接 import。任意 Host 宛てサーバー fetch を廃止し、productId は own property のみ参照 |
| 高 | 間接依存を更新 | npm audit fix で Firebase / gRPC / glob 等を更新。Next.js が固定する古い PostCSS は `overrides.next.postcss` で 8.5.31 以降へ固定。不要になれば override を削除 |
| 中 | 公開 API の内部エラーを隠す | BLANK25 manifest の予期しない Error.message はクライアントへ返さずサーバーログへ記録 |
| 中 | ブラウザ側の保護 | nosniff、frame-ancestors none / X-Frame-Options DENY、object-src none、base-uri self、Referrer-Policy。広告・音声入力・WebGL に影響する全面的な script-src 制限は導入していない |
| 中 | 再発検知 | Editor 認証の回帰テスト、全 PR / main・future push / 毎週の Security checks、Dependabot の npm / Actions 週次更新 |

15.5.28 は調査時点の npm の最新15系。公式の Maintenance LTS として選択したが、15系は長期据え置き先にはしない。公式サポート表と更新版を継続確認し、サポート終了前に16系以降へ移行する。15系のセキュリティ修正は2027-01-31までのため、2026-10-29に16.4.3へ移行した（`next lint` からESLint 9のCLIとflat configへ、`middleware` から `proxy` へ）。

## アドバイザリの適用条件

- [公式サポート方針](https://nextjs.org/support-policy): 14系はサポート対象外。14系内の更新だけでは対応できない。
- [2026年10月の公式セキュリティ更新](https://nextjs.org/blog/nextjs-security-update-october-14-2026): 修正先は15.5.28 / 16.4.1。SVG画像最適化のRCEはglibc Linuxが条件であり、本システムは next/image を使用するため対応が必要。`use cache` のRCE、Server ActionsのDoSについては該当する利用箇所をソース内で確認していない。
- [2026年9月の公式更新](https://nextjs.org/blog/september-2026-security-release): remotePatterns を使う画像最適化はSSRF対策が必要。Pages Routerのself-host SSG/ISR、Cache Components + Draft Mode等の項目は、本システムの構成では該当条件を確認していない。
- [2026年5月の公式更新](https://vercel.com/changelog/next-js-may-2026-security-release): App Routerの認証迂回やキャッシュ関連の修正を含み、13/14系には更新先として15/16系を案内している。WAFのみを修正の代替にしない。
- [middleware迂回修正の追加対応](https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7cqf-hhc6): Turbopack等の適用条件がある。今回のEditor API多層認証は、特定CVEへの該当を断定するものではなくmiddlewareのみに依存する境界の改善。

Realtime の内部 Route Handler は既存の Bearer + HMAC + 有効期限 + Firestore nonce を呼び出す。今回の点検で認証呼び出し漏れは見つからなかった。`INTERNAL_API_ALLOW_UNSIGNED=true` は通常運用では設定しない。

## 依存監査の結果と未解消項目

`npm audit --json` のパッケージ単位集計（CVE数ではない）:

| 監査 | Critical | High | Moderate | 合計 |
|---|---:|---:|---:|---:|
| 変更前・全依存 | 1 | 17 | 9 | 27 |
| 変更後・全依存 | 0 | 7 | 2 | 9 |
| 変更後・omit=dev | 0 | 5 | 2 | 7 |

PR #91 時点で残ったのは次の2件と、それらに依存するパッケージへの波及指摘。以下の表・説明は当時の記録であり、Tailwind 4移行後の結果は後述する。

- [bracesのスタック枯渇DoS（High）](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): Tailwind 3 / ESLint の glob 処理。調査時点の braces 3.0.3 に修正版がない。
- [postcss-selector-parserの計算量DoS（Moderate）](https://github.com/advisories/GHSA-rj75-hqrm-r3gf): Tailwind 3 / postcss-nested 6 に parser 6.1.5 が残る。修正先は7.1.6以降でメジャー更新になる。

これらはビルド時のパターン/CSS処理に使われ、公開APIの利用者が任意パターンやCSSをサーバーで解析させる経路は見つからなかった。`omit=dev` にも出るのは `tailwindcss-animate` の peer dependency によって Tailwind が含まれるためで、実際のHTTPリクエスト処理で使うことを意味しない。ビルド入力を第三者から受理する運用では別途対策が必要。

PR #91 時点では Tailwind 4移行と見た目の回帰確認を別作業とし、CIはCriticalのみを失敗条件にした。今回の移行では `npm audit fix --force` や parser のメジャー override を使わず、以下の対応で残件を解消した。

## 本番反映・運用で必要な確認

1. PRをマージして修正版を再デプロイし、Vercelの実際の配信版・Editor認証・画像表示を確認する。PR作成だけでは本番の脆弱性は解消しない。
2. Vercel側で Editor の連続認証失敗、`/api/realtime` / `/api/calendar` / `/api/blank25/manifest` の濫用に対するレート制限と利用量監視を設定する。複数インスタンスに効かないプロセス内カウンタは導入しない。閾値は実アクセス量と契約に合わせる。今回クラウド設定へのアクセス・変更は行っていない。
3. BasicにはHTTPSを使用し、Editorの長い固有パスワードと最小権限のGitHub tokenを使う。署名検証の無効化を避ける。秘密が漏洩した証拠がある場合は該当credentialをローテーションする。今回の調査だけで侵害や漏洩を断定しない。
4. 週次のDependabot / Security checks結果を確認し、新規の依存指摘とNext.jsのサポート期限を追跡する。

## 検証

- `npm ci --no-audit --no-fund`: 通常のpeer検証を有効にしたクリーンインストール成功。`npm ls react react-dom @react-three/fiber @react-three/drei @react-spring/three` も成功。
- `npm run lint` / `npm run build`: 成功。Next.js 15.5.28で全56静的ページを生成。
- `npm run test:security`: 2件成功。
- ローカルproduction server: 認証なし・middleware迂回ヘッダー付きは401、不正Origin / cross-site mutationは403、不許可の画像URLは400。保護ヘッダー、Host転送ヘッダーを偽装したponpoppoの200応答、継承プロパティ名のproductId拒否、レポートの200応答を確認。
- Playwright Chromium: サイコロのWebGL描画、文字入力の反映、一時停止、ponpoppo表示でページ例外なし。広告リクエストはテスト時のみ遮断。
- Codex CLIレビューは実行環境の認証エラーで完了できず、別Codexエージェントで差分をレビュー。発見されたReact / fiber非互換を修正し、再レビューで解消を確認。

本番のFirebase/GitHub credentialを必要とする更新操作・外部サービスの書き込みは検証していない。

## Tailwind CSS 4移行による残件対応（2026-10-23）

- Tailwind CSS / `@tailwindcss/postcss` 4.3.3、`tailwind-merge` 3.7.0へ更新。Tailwind 3と`postcss-nested` / parser 6の依存経路を除去した。`tailwindcss-animate` 1.0.7はv4の`@plugin`で継続する。
- `tailwind.config.ts` を削除し、`src/app/globals.css` のCSSテーマ・ソース探索・class方式のdark variant・container・キーフレームへ移行。PostCSSの設定を専用プラグインへ切り替え、不要な直接依存のautoprefixerを削除した。shadcnのconfig参照も更新した。
- 既存の色、sRGBグラデーション、境界線、placeholder、カーソルを明示。変更された影・角丸・blur・outlineクラスと透過率指定を更新し、フォーム余白・行高・レスポンシブ配置を既存表示に揃えた。v3で未生成だった幅・列数・透過率クラスは、v4で突然有効にならないよう削除した。

同日のregistry情報を使ったパッケージ単位集計:

| 監査 | Critical | High | Moderate | 合計 |
|---|---:|---:|---:|---:|
| 今回の移行前・全依存 | 0 | 0 | 3 | 3 |
| 今回の移行前・omit=dev | 0 | 0 | 3 | 3 |
| Tailwind 4移行後・全依存 | 0 | 0 | 0 | 0 |
| Tailwind 4移行後・omit=dev | 0 | 0 | 0 | 0 |

PR #91 のHigh件数は現行のregistryでは再現しなかった。`braces@3.0.3` はESLintの依存に残るが、今回の監査では指摘されない。これはbracesを更新・除去したという意味ではない。Tailwindの更新で除去したのは、今回再現した`postcss-selector-parser`とその依存元への3件の指摘である。将来のアドバイザリ変更で件数は変わり得る。

Security checks は引き続き全指摘を表示し、失敗条件を `npm audit --audit-level=moderate` へ引き下げた。HighとModerateの新規指摘もCIを失敗させる。`npm run audit:production` も正常終了する構成になった。

画面確認・検証の詳細は [Tailwind 4移行の検証記録](./tailwind4-verification-2026-10.md) を参照。


## 依存PRの再点検（2026-10-24）

最新の `main@6a90cb1` を取得し、クリーンインストール後に再監査した。全依存・`--omit=dev` とも既知の脆弱性は0件で、今回のchrono-node更新後も0件。新しい強制overrideやフレームワークのメジャー移行は不要と判断した。

| PR | 対応と理由 |
|---|---|
| #93 Next.js 15.5.28 → 16.4.2 | 今回は採用しない。15.5.28は上記10月のセキュリティ修正済み。PRのCIは16系で削除された `next lint` により失敗。16系移行時はlint設定とReact rendererの互換性をまとめて確認する |
| #96 ESLint 8.57.1 → 10.13.0 | 今回は採用しない。`eslint-config-next@15.5.28` のpeer範囲はESLint 7/8/9で、10単独への更新は `npm ci` が `ERESOLVE` で失敗。lint基盤の移行として別途扱う |
| #95 chrono-node 2.10.1 → 2.10.3 | パッチ更新を `future` に統合。最低版も2.10.3へ更新。セキュリティ修正としては扱わず、日本語日付解析を確認したうえで元PRを重複として整理する |

Dependabotのバージョン更新PRとSecurity checksは有効だが、GitHubのDependabotアラートAPIは「無効」の403を返した。有効化APIも連携権限不足の403で失敗したため、管理権限での有効化は未完了。現行CIの週次npm監査とmoderate以上の失敗条件は維持する。

検証: `npm ci --no-audit --no-fund`、全依存監査、本番依存監査、`npm run lint`、`npm run test:security`（2件）、`npm run build`。日本語の日付・時刻、相対日、年跨ぎ、日付でない入力について、実際の `parseJapaneseDate` の7ケースも確認した。
