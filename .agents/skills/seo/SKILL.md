---
name: seo
description: Optimize for search engine visibility and ranking. Use when asked to "improve SEO", "optimize for search", "fix meta tags", "add structured data", "sitemap optimization", or "search engine optimization".
license: MIT
metadata:
  author: web-quality-skills
  version: "1.0"
---

# SEO optimization

Search engine optimization based on Lighthouse SEO audits and Google Search guidelines. Focus on technical SEO, on-page optimization, and structured data.

## このリポジトリでの適用（NAZOMATIC / Next.js 14 App Router）

補助資料の生 HTML 例は、以下の実装先に合わせて App Router の API に読み替える。

| 補助資料の例 | NAZOMATIC での実装先 |
|---|---|
| `<title>` / `<meta name="description">` | `src/app/**/{layout,page}.tsx` の `export const metadata` / `generateMetadata()` |
| `<link rel="canonical">` | `metadata.alternates.canonical`。共通生成は `src/lib/seo.ts` |
| `robots.txt` | `src/app/robots.ts` |
| `sitemap.xml` | `src/app/sitemap.ts`。URL の正本は `src/lib/json/features.json` の順序 |
| JSON-LD `<script>` | `src/components/common/json-ld-component.tsx` / `generateJsonLdArticle.ts` |

監査対象は、ローカルURLの指定がない限り本番 `https://nazomatic.vercel.app`。

## 依頼の範囲と完了条件

- 監査依頼では、対象ページの根拠・影響・推奨対応を報告して完了する。監査だけの依頼から実装や外部サービスの設定変更へ広げない。
- 修正依頼では、依頼範囲の実装と関連文書の更新、変更したメタデータ・クロール制御・構造化データなどの確認、今回の変更に起因する不具合の修正まで行い、確認結果と未解決事項を報告する。
- 公開・デプロイや Search Console など外部サービスへの変更は、ユーザーの依頼範囲に含まれる場合に扱う。

## 作業別の補助資料

必要な作業に対応する資料を参照する。全資料の読み込みを前提にしない。

| 作業 | 参照先 |
|---|---|
| SEO全体の監査項目・確認ツールを選ぶ | `.agents/skills/seo/references/audit.md` |
| robots・canonical・ページ送り・sitemap・URLを扱う | `.agents/skills/seo/references/technical-seo.md` |
| title・description・見出し・画像・内部リンクを扱う | `.agents/skills/seo/references/on-page-seo.md` |
| JSON-LDを追加・変更・検証する | `.agents/skills/seo/references/structured-data.md` |
| AI検索の表示やクローラー制御・llms.txtを検討する | `.agents/skills/seo/references/ai-search.md` |
| モバイル表示のSEO上の問題を確認する | `.agents/skills/seo/references/mobile-seo.md` |
| 多言語ページ・hreflang・言語宣言を扱う | `.agents/skills/seo/references/international-seo.md` |
