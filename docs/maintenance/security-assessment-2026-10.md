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

15.5.28 は調査時点の npm の最新15系。公式の Maintenance LTS として選択したが、15系は長期据え置き先にはしない。公式サポート表と更新版を継続確認し、サポート終了前に16系以降へ移行する。

## アドバイザリの適用条件

- [公式サポート方針](https://nextjs.org/support-policy): 14系はサポート対象外。14系内の更新だけでは対応できない。
- [2026年10月の公式セキュリティ更新](https://nextjs.org/blog/nextjs-security-update-october-14-2026): 修正先は15.5.28 / 16.4.1。SVG画像最適化のRCEはglibc Linuxが条件であり、本システムは next/image を使用するため対応が必要。`use cache` のRCE、Server ActionsのDoSについては該当する利用箇所をソース内で確認していない。
- [2026年9月の公式更新](https://nextjs.org/blog/september-2026-security-release): remotePatterns を使う画像最適化はSSRF対策が必要。Pages Routerのself-host SSG/ISR、Cache Components + Draft Mode等の項目は、本システムの構成では該当条件を確認していない。
- [2026年5月の公式更新](https://vercel.com/changelog/next-js-may-2026-security-release): App Routerの認証迂回やキャッシュ関連の修正を含み、13/14系には更新先として15/16系を案内している。WAFのみを修正の代替にしない。
- [middleware迂回修正の追加対応](https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7cqf-hhc6): Turbopack等の適用条件がある。今回のEditor API多層認証は、特定CVEへの該当を断定するものではなくmiddlewareのみに依存する境界の改善。

Realtime / X の内部 Route Handler は既存の Bearer + HMAC + 有効期限 + Firestore nonce を呼び出す。今回の点検で認証呼び出し漏れは見つからなかった。`INTERNAL_API_ALLOW_UNSIGNED=true` は通常運用では設定しない。

## 依存監査の結果と未解消項目

`npm audit --json` のパッケージ単位集計（CVE数ではない）:

| 監査 | Critical | High | Moderate | 合計 |
|---|---:|---:|---:|---:|
| 変更前・全依存 | 1 | 17 | 9 | 27 |
| 変更後・全依存 | 0 | 7 | 2 | 9 |
| 変更後・omit=dev | 0 | 5 | 2 | 7 |

残りは次の2件と、それらに依存するパッケージへの波及指摘。**監査ゼロではない。**

- [bracesのスタック枯渇DoS（High）](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): Tailwind 3 / ESLint の glob 処理。調査時点の braces 3.0.3 に修正版がない。
- [postcss-selector-parserの計算量DoS（Moderate）](https://github.com/advisories/GHSA-rj75-hqrm-r3gf): Tailwind 3 / postcss-nested 6 に parser 6.1.5 が残る。修正先は7.1.6以降でメジャー更新になる。

これらはビルド時のパターン/CSS処理に使われ、公開APIの利用者が任意パターンやCSSをサーバーで解析させる経路は見つからなかった。`omit=dev` にも出るのは `tailwindcss-animate` の peer dependency によって Tailwind が含まれるためで、実際のHTTPリクエスト処理で使うことを意味しない。ビルド入力を第三者から受理する運用では別途対策が必要。

Tailwind 4への移行・見た目の回帰確認は別途必要。互換性を未検証のまま `npm audit fix --force` や parser のメジャー override は適用しない。Security checks は全指摘をログに残し、現時点では Critical のみ失敗条件にする。High/Moderateが解消したら閾値を引き下げる。Highの新規追加をCIが自動で阻止する構成ではない。

## 本番反映・運用で必要な確認

1. PRをマージして修正版を再デプロイし、Vercelの実際の配信版・Editor認証・画像表示を確認する。PR作成だけでは本番の脆弱性は解消しない。
2. Vercel側で Editor の連続認証失敗、`/api/realtime` / `/api/calendar` / `/api/blank25/manifest` の濫用に対するレート制限と利用量監視を設定する。複数インスタンスに効かないプロセス内カウンタは導入しない。閾値は実アクセス量と契約に合わせる。今回クラウド設定へのアクセス・変更は行っていない。
3. BasicにはHTTPSを使用し、Editorの長い固有パスワードと最小権限のGitHub tokenを使う。署名検証の無効化を避ける。秘密が漏洩した証拠がある場合は該当credentialをローテーションする。今回の調査だけで侵害や漏洩を断定しない。
4. 週次のDependabot / Security checks結果を確認し、Tailwind系未解消指摘とNext.jsのサポート期限を追跡する。

## 検証

- `npm ci --no-audit --no-fund`: 通常のpeer検証を有効にしたクリーンインストール成功。`npm ls react react-dom @react-three/fiber @react-three/drei @react-spring/three` も成功。
- `npm run lint` / `npm run build`: 成功。Next.js 15.5.28で全56静的ページを生成。
- `npm run test:security`: 2件成功。`npm run test:x-browser-posting`: 105件成功。
- ローカルproduction server: 認証なし・middleware迂回ヘッダー付きは401、不正Origin / cross-site mutationは403、不許可の画像URLは400。保護ヘッダー、Host転送ヘッダーを偽装したponpoppoの200応答、継承プロパティ名のproductId拒否、レポートの200応答を確認。
- Playwright Chromium: サイコロのWebGL描画、文字入力の反映、一時停止、ponpoppo表示でページ例外なし。広告リクエストはテスト時のみ遮断。
- Codex CLIレビューは実行環境の認証エラーで完了できず、別Codexエージェントで差分をレビュー。発見されたReact / fiber非互換を修正し、再レビューで解消を確認。

本番のFirebase/GitHub credentialを必要とする更新操作・外部サービスの書き込みは検証していない。
